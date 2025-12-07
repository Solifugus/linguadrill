const { Pool } = require('pg');
const crypto = require('crypto');

// Database configuration
// Use environment variables or defaults
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'linguadrill',
    user: process.env.DB_USER || 'linguadrill',
    password: process.env.DB_PASSWORD || 'linguadrill',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Database operations
const db = {
    // Initialize database
    init: async function() {
        try {
            await pool.query('SELECT NOW()');
            console.log('Database connected successfully');
            return true;
        } catch (error) {
            console.error('Database connection failed:', error.message);
            return false;
        }
    },

    // Hash password
    hashPassword: function(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    },

    // Create user
    createUser: async function(email, password, nativeLanguage) {
        const client = await pool.connect();
        try {
            const passwordHash = db.hashPassword(password);
            const query = `
                INSERT INTO users (email, password_hash, native_language)
                VALUES ($1, $2, $3)
                RETURNING id, email, native_language, created_at
            `;
            const result = await client.query(query, [email.toLowerCase(), passwordHash, nativeLanguage || 'English']);
            return { success: true, user: result.rows[0] };
        } catch (error) {
            if (error.code === '23505') { // Unique violation
                return { success: false, error: 'User already exists' };
            }
            console.error('Create user error:', error);
            return { success: false, error: 'Database error' };
        } finally {
            client.release();
        }
    },

    // Authenticate user
    authenticateUser: async function(email, password) {
        const client = await pool.connect();
        try {
            const passwordHash = db.hashPassword(password);
            const query = `
                SELECT id, email, native_language, created_at
                FROM users
                WHERE email = $1 AND password_hash = $2
            `;
            const result = await client.query(query, [email.toLowerCase(), passwordHash]);

            if (result.rows.length === 0) {
                return { success: false, error: 'Invalid credentials' };
            }

            // Update last login
            await client.query(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [result.rows[0].id]
            );

            return { success: true, user: result.rows[0] };
        } catch (error) {
            console.error('Authentication error:', error);
            return { success: false, error: 'Database error' };
        } finally {
            client.release();
        }
    },

    // Change password
    changePassword: async function(email, oldPassword, newPassword) {
        const client = await pool.connect();
        try {
            const oldHash = db.hashPassword(oldPassword);
            const newHash = db.hashPassword(newPassword);

            // Verify old password
            const checkQuery = 'SELECT id FROM users WHERE email = $1 AND password_hash = $2';
            const checkResult = await client.query(checkQuery, [email.toLowerCase(), oldHash]);

            if (checkResult.rows.length === 0) {
                return { success: false, error: 'Invalid current password' };
            }

            // Update password
            const updateQuery = 'UPDATE users SET password_hash = $1 WHERE email = $2';
            await client.query(updateQuery, [newHash, email.toLowerCase()]);

            return { success: true };
        } catch (error) {
            console.error('Change password error:', error);
            return { success: false, error: 'Database error' };
        } finally {
            client.release();
        }
    },

    // Get user by email
    getUserByEmail: async function(email) {
        const client = await pool.connect();
        try {
            const query = 'SELECT id, email, native_language, created_at FROM users WHERE email = $1';
            const result = await client.query(query, [email.toLowerCase()]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        } finally {
            client.release();
        }
    },

    // Close pool
    close: async function() {
        await pool.end();
    }
};

module.exports = db;
