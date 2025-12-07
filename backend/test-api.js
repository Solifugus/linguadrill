const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:8080';
const TEST_USER = {
    email: 'test@example.com',
    password: 'testpass123',
    newPassword: 'newpass456',
    nativeLanguage: 'English'
};

// HTTP request helper
const request = function(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        body: JSON.parse(data)
                    });
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        body: data
                    });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
};

// Test suite
const tests = {
    results: [],
    passed: 0,
    failed: 0,

    assert: function(testName, condition, message) {
        if (condition) {
            console.log(`✓ ${testName}`);
            tests.passed++;
            tests.results.push({ test: testName, passed: true });
        } else {
            console.log(`✗ ${testName}: ${message}`);
            tests.failed++;
            tests.results.push({ test: testName, passed: false, error: message });
        }
    },

    summary: function() {
        console.log('\n' + '='.repeat(60));
        console.log(`Test Results: ${tests.passed} passed, ${tests.failed} failed`);
        console.log('='.repeat(60));
    }
};

// Test functions
const testAPI = {
    // Test 1: Register new user
    testRegister: async function() {
        console.log('\n--- Test 1: User Registration ---');
        try {
            const res = await request('POST', '/api/register', TEST_USER);
            tests.assert('Register returns 201', res.statusCode === 201, `Got ${res.statusCode}`);
            tests.assert('Register returns userId', !!res.body.userId, 'No userId in response');
            tests.assert('Register success flag', res.body.success === true, 'Success is not true');
            return res.body.userId;
        } catch (error) {
            tests.assert('Register request', false, error.message);
            return null;
        }
    },

    // Test 2: Register duplicate user (should fail)
    testDuplicateRegister: async function() {
        console.log('\n--- Test 2: Duplicate Registration (should fail) ---');
        try {
            const res = await request('POST', '/api/register', TEST_USER);
            tests.assert('Duplicate register returns 400', res.statusCode === 400, `Got ${res.statusCode}`);
            tests.assert('Duplicate register has error', !!res.body.error, 'No error message');
        } catch (error) {
            tests.assert('Duplicate register request', false, error.message);
        }
    },

    // Test 3: Login with correct credentials
    testLogin: async function() {
        console.log('\n--- Test 3: User Login ---');
        try {
            const res = await request('POST', '/api/login', {
                email: TEST_USER.email,
                password: TEST_USER.password
            });
            tests.assert('Login returns 200', res.statusCode === 200, `Got ${res.statusCode}`);
            tests.assert('Login returns userId', !!res.body.userId, 'No userId in response');
            tests.assert('Login returns nativeLanguage', res.body.nativeLanguage === TEST_USER.nativeLanguage, 'Wrong native language');
        } catch (error) {
            tests.assert('Login request', false, error.message);
        }
    },

    // Test 4: Login with wrong password (should fail)
    testWrongPassword: async function() {
        console.log('\n--- Test 4: Login with Wrong Password (should fail) ---');
        try {
            const res = await request('POST', '/api/login', {
                email: TEST_USER.email,
                password: 'wrongpassword'
            });
            tests.assert('Wrong password returns 401', res.statusCode === 401, `Got ${res.statusCode}`);
            tests.assert('Wrong password has error', !!res.body.error, 'No error message');
        } catch (error) {
            tests.assert('Wrong password request', false, error.message);
        }
    },

    // Test 5: Change password
    testChangePassword: async function() {
        console.log('\n--- Test 5: Change Password ---');
        try {
            const res = await request('POST', '/api/change-password', {
                email: TEST_USER.email,
                oldPassword: TEST_USER.password,
                newPassword: TEST_USER.newPassword
            });
            tests.assert('Change password returns 200', res.statusCode === 200, `Got ${res.statusCode}`);
            tests.assert('Change password success', res.body.success === true, 'Success is not true');

            // Test login with new password
            const loginRes = await request('POST', '/api/login', {
                email: TEST_USER.email,
                password: TEST_USER.newPassword
            });
            tests.assert('Login with new password works', loginRes.statusCode === 200, `Got ${loginRes.statusCode}`);
        } catch (error) {
            tests.assert('Change password request', false, error.message);
        }
    },

    // Test 6: Get available languages
    testGetLanguages: async function() {
        console.log('\n--- Test 6: Get Available Languages ---');
        try {
            const res = await request('GET', '/api/languages', null);
            tests.assert('Get languages returns 200', res.statusCode === 200, `Got ${res.statusCode}`);
            tests.assert('Get languages returns object', !!res.body.languages, 'No languages in response');
            tests.assert('Ukrainian is available', !!res.body.languages.ukrainian, 'Ukrainian not found');
            tests.assert('Korean is available', !!res.body.languages.korean, 'Korean not found');
            console.log(`   Available languages: ${Object.keys(res.body.languages).join(', ')}`);
        } catch (error) {
            tests.assert('Get languages request', false, error.message);
        }
    },

    // Test 7: Get alphabet
    testGetAlphabet: async function() {
        console.log('\n--- Test 7: Get Alphabet ---');
        try {
            const res = await request('GET', '/api/language/ukrainian/english/alphabet', null);
            tests.assert('Get alphabet returns 200', res.statusCode === 200, `Got ${res.statusCode}`);
            tests.assert('Alphabet has data', Array.isArray(res.body.alphabet), 'Alphabet is not an array');
            tests.assert('Alphabet not empty', res.body.alphabet.length > 0, 'Alphabet is empty');
            tests.assert('Alphabet has character field', !!res.body.alphabet[0].character, 'No character field');
            console.log(`   Alphabet has ${res.body.alphabet.length} letters`);
        } catch (error) {
            tests.assert('Get alphabet request', false, error.message);
        }
    },

    // Test 8: Get iteration
    testGetIteration: async function() {
        console.log('\n--- Test 8: Get Iteration ---');
        try {
            const res = await request('GET', '/api/language/ukrainian/english/iteration/1', null);
            tests.assert('Get iteration returns 200', res.statusCode === 200, `Got ${res.statusCode}`);
            tests.assert('Iteration has vocabulary', Array.isArray(res.body.vocabulary), 'No vocabulary array');
            tests.assert('Iteration has grammar', Array.isArray(res.body.grammar), 'No grammar array');
            tests.assert('Iteration has dialog', Array.isArray(res.body.dialog), 'No dialog array');
            tests.assert('Vocabulary has 10 words', res.body.vocabulary.length === 10, `Got ${res.body.vocabulary.length} words`);
            console.log(`   Iteration 1 has ${res.body.vocabulary.length} vocabulary words`);
        } catch (error) {
            tests.assert('Get iteration request', false, error.message);
        }
    },

    // Test 9: Get non-existent iteration (should fail)
    testGetInvalidIteration: async function() {
        console.log('\n--- Test 9: Get Invalid Iteration (should fail) ---');
        try {
            const res = await request('GET', '/api/language/ukrainian/english/iteration/999', null);
            tests.assert('Invalid iteration returns 404', res.statusCode === 404, `Got ${res.statusCode}`);
        } catch (error) {
            tests.assert('Invalid iteration request', false, error.message);
        }
    },

    // Test 10: Get non-existent language (should fail)
    testGetInvalidLanguage: async function() {
        console.log('\n--- Test 10: Get Invalid Language (should fail) ---');
        try {
            const res = await request('GET', '/api/language/klingon/english/alphabet', null);
            tests.assert('Invalid language returns 404', res.statusCode === 404, `Got ${res.statusCode}`);
        } catch (error) {
            tests.assert('Invalid language request', false, error.message);
        }
    }
};

// Main test runner
const runTests = async function() {
    console.log('='.repeat(60));
    console.log('LanguageSplicer Backend API Tests');
    console.log('='.repeat(60));

    // Wait for server to be ready
    console.log('\nWaiting for server to be ready...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        // Run all tests in sequence
        await testAPI.testRegister();
        await testAPI.testDuplicateRegister();
        await testAPI.testLogin();
        await testAPI.testWrongPassword();
        await testAPI.testChangePassword();
        await testAPI.testGetLanguages();
        await testAPI.testGetAlphabet();
        await testAPI.testGetIteration();
        await testAPI.testGetInvalidIteration();
        await testAPI.testGetInvalidLanguage();

        tests.summary();
        process.exit(tests.failed > 0 ? 1 : 0);
    } catch (error) {
        console.error('\nFatal test error:', error);
        process.exit(1);
    }
};

// Run tests
runTests();
