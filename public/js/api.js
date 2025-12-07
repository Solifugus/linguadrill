// API Module - handles all HTTP requests to backend
const api = {};

api.request = async function(method, endpoint, body) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${config.apiBaseUrl}${endpoint}`, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

api.register = async function(email, password, nativeLanguage, targetLanguage) {
    return await api.request('POST', '/register', {
        email: email,
        password: password,
        nativeLanguage: nativeLanguage
    });
};

api.login = async function(email, password) {
    return await api.request('POST', '/login', {
        email: email,
        password: password
    });
};

api.changePassword = async function(email, oldPassword, newPassword) {
    return await api.request('POST', '/change-password', {
        email: email,
        oldPassword: oldPassword,
        newPassword: newPassword
    });
};

api.getLanguages = async function() {
    return await api.request('GET', '/languages', null);
};

api.getAlphabet = async function(targetLang, learnerLang) {
    const endpoint = `/language/${targetLang}/${learnerLang}/alphabet`;
    return await api.request('GET', endpoint, null);
};

api.getIteration = async function(targetLang, learnerLang, iterationNum) {
    const endpoint = `/language/${targetLang}/${learnerLang}/iteration/${iterationNum}`;
    return await api.request('GET', endpoint, null);
};
