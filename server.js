const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./backend/database');

// Configuration
const PORT = 8080;
const LANGUAGES_DIR = './languages';
const AUDIO_DIR = './audio';
const PUBLIC_DIR = './public';

// Utility functions
const utils = {
    ensureDir: function(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    },

    hashPassword: function(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    },

    generateUserId: function() {
        return crypto.randomBytes(16).toString('hex');
    },

    readJSON: function(filePath) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    },

    writeJSON: function(filePath, data) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    },

    sendJSON: function(res, statusCode, data) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    },

    sendError: function(res, statusCode, message) {
        utils.sendJSON(res, statusCode, { error: message });
    },

    parseBody: async function(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(error);
                }
            });
            req.on('error', reject);
        });
    },

    getMimeType: function(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.webmanifest': 'application/manifest+json',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
};

// User management now handled by database module
// No file-based user storage needed

// Language dataset management
const languages = {
    getAvailableLanguages: function() {
        const files = fs.readdirSync(LANGUAGES_DIR);
        const datasets = {};

        files.forEach(file => {
            if (file.endsWith('.json')) {
                const parts = file.replace('.json', '').split('-');
                if (parts.length >= 2) {
                    const targetLang = parts[0];
                    const learnerLang = parts.slice(1).join('-');

                    if (!datasets[targetLang]) {
                        datasets[targetLang] = [];
                    }
                    datasets[targetLang].push(learnerLang);
                }
            }
        });

        return datasets;
    },

    getDataset: function(targetLang, learnerLang) {
        const baseName = `${targetLang.toLowerCase()}-${learnerLang.toLowerCase().replace(/\s+/g, '-')}`;

        // Priority: v3 > v2 > phrases > word-based
        const v3File = path.join(LANGUAGES_DIR, `${baseName}-v3.json`);
        const v2File = path.join(LANGUAGES_DIR, `${baseName}-v2.json`);
        const phrasesFile = path.join(LANGUAGES_DIR, `${baseName}-phrases.json`);
        const wordFile = path.join(LANGUAGES_DIR, `${baseName}.json`);

        if (fs.existsSync(v3File)) {
            console.log(`Loading V3 dataset: ${baseName}-v3.json`);
            return utils.readJSON(v3File);
        }

        if (fs.existsSync(v2File)) {
            console.log(`Loading V2 dataset: ${baseName}-v2.json`);
            return utils.readJSON(v2File);
        }

        if (fs.existsSync(phrasesFile)) {
            console.log(`Loading phrase-based dataset: ${baseName}-phrases.json`);
            return utils.readJSON(phrasesFile);
        }

        if (fs.existsSync(wordFile)) {
            console.log(`Loading word-based dataset: ${baseName}.json`);
            return utils.readJSON(wordFile);
        }

        return null;
    },

    getAlphabet: function(targetLang, learnerLang) {
        const dataset = languages.getDataset(targetLang, learnerLang);
        if (!dataset) return null;
        return dataset.alphabet;
    },

    getIteration: function(targetLang, learnerLang, iterationNum) {
        const dataset = languages.getDataset(targetLang, learnerLang);
        if (!dataset) return null;

        const iteration = dataset.iterations.find(it => it.iteration === iterationNum);
        return iteration || null;
    }
};

// API Routes
const routes = {
    // POST /api/register
    register: async function(req, res) {
        try {
            const body = await utils.parseBody(req);
            const { email, password, nativeLanguage } = body;

            if (!email || !password) {
                return utils.sendError(res, 400, 'Missing required fields');
            }

            // Default to English if no language specified
            const result = await db.createUser(email, password, nativeLanguage || 'English');
            if (!result.success) {
                return utils.sendError(res, 400, result.error);
            }

            utils.sendJSON(res, 201, {
                success: true,
                userId: result.user.id,
                nativeLanguage: result.user.native_language,
                message: 'User created successfully'
            });
        } catch (error) {
            console.error('Register error:', error);
            utils.sendError(res, 500, 'Internal server error');
        }
    },

    // POST /api/login
    login: async function(req, res) {
        try {
            const body = await utils.parseBody(req);
            const { email, password } = body;

            if (!email || !password) {
                return utils.sendError(res, 400, 'Missing email or password');
            }

            const result = await db.authenticateUser(email, password);
            if (!result.success) {
                return utils.sendError(res, 401, result.error);
            }

            utils.sendJSON(res, 200, {
                success: true,
                userId: result.user.id,
                nativeLanguage: result.user.native_language
            });
        } catch (error) {
            console.error('Login error:', error);
            utils.sendError(res, 500, 'Internal server error');
        }
    },

    // POST /api/change-password
    changePassword: async function(req, res) {
        try {
            const body = await utils.parseBody(req);
            const { email, oldPassword, newPassword } = body;

            if (!email || !oldPassword || !newPassword) {
                return utils.sendError(res, 400, 'Missing required fields');
            }

            const result = await db.changePassword(email, oldPassword, newPassword);
            if (!result.success) {
                return utils.sendError(res, 400, result.error);
            }

            utils.sendJSON(res, 200, {
                success: true,
                message: 'Password changed successfully'
            });
        } catch (error) {
            console.error('Change password error:', error);
            utils.sendError(res, 500, 'Internal server error');
        }
    },

    // GET /api/languages
    getLanguages: function(req, res) {
        try {
            const available = languages.getAvailableLanguages();
            utils.sendJSON(res, 200, { languages: available });
        } catch (error) {
            console.error('Get languages error:', error);
            utils.sendError(res, 500, 'Internal server error');
        }
    },

    // GET /api/language/{targetLang}/{learnerLang}/alphabet
    getAlphabet: function(req, res, targetLang, learnerLang) {
        try {
            const alphabet = languages.getAlphabet(targetLang, learnerLang);
            if (!alphabet) {
                return utils.sendError(res, 404, 'Language dataset not found');
            }
            utils.sendJSON(res, 200, { alphabet: alphabet });
        } catch (error) {
            console.error('Get alphabet error:', error);
            utils.sendError(res, 500, 'Internal server error');
        }
    },

    // GET /api/language/{targetLang}/{learnerLang}/iteration/{num}
    getIteration: function(req, res, targetLang, learnerLang, iterationNum) {
        try {
            const iteration = languages.getIteration(targetLang, learnerLang, parseInt(iterationNum));
            if (!iteration) {
                return utils.sendError(res, 404, 'Iteration not found');
            }
            utils.sendJSON(res, 200, iteration);
        } catch (error) {
            console.error('Get iteration error:', error);
            utils.sendError(res, 500, 'Internal server error');
        }
    }
};

// Request router
const router = function(req, res) {
    const url = req.url;
    const method = req.method;

    console.log(`${method} ${url}`);

    // Enable CORS for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API Routes
    if (url.startsWith('/api/')) {
        if (method === 'POST' && url === '/api/register') {
            return routes.register(req, res);
        }
        if (method === 'POST' && url === '/api/login') {
            return routes.login(req, res);
        }
        if (method === 'POST' && url === '/api/change-password') {
            return routes.changePassword(req, res);
        }
        if (method === 'GET' && url === '/api/languages') {
            return routes.getLanguages(req, res);
        }

        // Pattern: /api/language/{targetLang}/{learnerLang}/alphabet
        const alphabetMatch = url.match(/^\/api\/language\/([^\/]+)\/([^\/]+)\/alphabet$/);
        if (method === 'GET' && alphabetMatch) {
            return routes.getAlphabet(req, res, alphabetMatch[1], alphabetMatch[2]);
        }

        // Pattern: /api/language/{targetLang}/{learnerLang}/iteration/{num}
        const iterationMatch = url.match(/^\/api\/language\/([^\/]+)\/([^\/]+)\/iteration\/(\d+)$/);
        if (method === 'GET' && iterationMatch) {
            return routes.getIteration(req, res, iterationMatch[1], iterationMatch[2], iterationMatch[3]);
        }

        return utils.sendError(res, 404, 'API endpoint not found');
    }

    // Serve audio files
    if (url.startsWith('/audio/')) {
        const audioDir = path.resolve(AUDIO_DIR);
        const audioPath = path.join(audioDir, url.replace('/audio/', ''));
        const resolvedAudioPath = path.resolve(audioPath);

        // Security: prevent directory traversal
        if (!resolvedAudioPath.startsWith(audioDir)) {
            return utils.sendError(res, 403, 'Forbidden');
        }

        fs.readFile(audioPath, (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404);
                    res.end('404 Audio Not Found');
                } else {
                    res.writeHead(500);
                    res.end('500 Internal Server Error');
                }
                return;
            }

            res.writeHead(200, { 'Content-Type': utils.getMimeType(audioPath) });
            res.end(data);
        });
        return;
    }

    // Serve static files
    const publicDir = path.resolve(PUBLIC_DIR);
    let filePath = path.join(publicDir, url === '/' ? 'index.html' : url);
    const resolvedPath = path.resolve(filePath);

    // Security: prevent directory traversal
    if (!resolvedPath.startsWith(publicDir)) {
        return utils.sendError(res, 403, 'Forbidden');
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end('500 Internal Server Error');
            }
            return;
        }

        res.writeHead(200, { 'Content-Type': utils.getMimeType(filePath) });
        res.end(data);
    });
};

// Initialize server
const init = async function() {
    console.log('Initializing LinguaDrill Server...');

    // Initialize database connection
    const dbConnected = await db.init();
    if (!dbConnected) {
        console.error('WARNING: Database connection failed. Server will run but authentication may not work.');
        console.error('Make sure PostgreSQL is running and configured correctly.');
    }

    // Ensure required directories exist
    utils.ensureDir(PUBLIC_DIR);

    // Create server
    const server = http.createServer(router);

    server.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}/`);
        console.log(`Database: ${dbConnected ? 'Connected' : 'Not Connected'}`);
        console.log(`Available languages: ${Object.keys(languages.getAvailableLanguages()).join(', ')}`);
    });
};

// Start server
init();
