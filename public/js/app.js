// Main Application Module
const app = {};

app.user = null;
app.targetLanguage = null;
app.availableLanguages = null;
app.currentIteration = 1;

app.init = function() {
    // Check if user is logged in
    app.user = storage.getUser();
    app.targetLanguage = storage.getLanguage();

    if (app.user && app.targetLanguage) {
        app.loadAvailableLanguages();
    } else {
        setTimeout(function() {
            ui.showScreen('login-screen');
        }, 1000);
    }

    app.setupEventListeners();
};

app.setupEventListeners = function() {
    // Login/Register
    document.getElementById('show-register').addEventListener('click', function(e) {
        e.preventDefault();
        ui.showScreen('register-screen');
        app.loadAvailableLanguages();
    });

    document.getElementById('show-login').addEventListener('click', function(e) {
        e.preventDefault();
        ui.showScreen('login-screen');
    });

    document.getElementById('login-form').addEventListener('submit', app.handleLogin);
    document.getElementById('register-form').addEventListener('submit', app.handleRegister);

    // Menu
    document.getElementById('menu-toggle').addEventListener('click', ui.openMenu);
    document.getElementById('learning-menu-toggle').addEventListener('click', ui.openMenu);
    document.getElementById('menu-close').addEventListener('click', ui.closeMenu);
    document.getElementById('overlay').addEventListener('click', function() {
        ui.closeMenu();
        ui.hideOverlay();
    });

    // Menu actions
    document.getElementById('logout-btn').addEventListener('click', app.handleLogout);
    document.getElementById('change-password-btn').addEventListener('click', function() {
        ui.showModal('change-password-modal');
    });
    document.getElementById('change-language-btn').addEventListener('click', function() {
        app.loadAvailableLanguagesForChange();
        ui.showModal('change-language-modal');
    });
    document.getElementById('reset-progress-btn').addEventListener('click', app.handleResetProgress);

    // Modals
    document.getElementById('cancel-change-password').addEventListener('click', function() {
        ui.hideModal('change-password-modal');
    });
    document.getElementById('cancel-change-language').addEventListener('click', function() {
        ui.hideModal('change-language-modal');
    });
    document.getElementById('change-password-form').addEventListener('submit', app.handleChangePassword);
    document.getElementById('change-language-form').addEventListener('submit', app.handleChangeLanguage);

    // Alphabet
    document.getElementById('start-learning').addEventListener('click', app.startLearning);
    document.getElementById('skip-alphabet').addEventListener('click', app.startLearning);

    // Tabs
    document.getElementById('tab-vocabulary').addEventListener('click', function() {
        app.switchTab('vocabulary');
    });
    document.getElementById('tab-grammar').addEventListener('click', function() {
        app.switchTab('grammar');
    });
    document.getElementById('tab-dialog').addEventListener('click', function() {
        app.switchTab('dialog');
    });

    // Next iteration
    document.getElementById('next-iteration').addEventListener('click', app.nextIteration);
};

app.loadAvailableLanguages = async function() {
    try {
        const response = await api.getLanguages();
        app.availableLanguages = response.languages;
        app.populateLanguageSelect();

        if (app.user && app.targetLanguage) {
            app.startApp();
        }
    } catch (error) {
        ui.showToast('Failed to load languages', 'error');
    }
};

app.populateLanguageSelect = function() {
    const select = document.getElementById('register-target-language');
    select.innerHTML = '<option value="">Select language to learn</option>';

    if (app.availableLanguages) {
        Object.keys(app.availableLanguages).forEach(function(lang) {
            const option = document.createElement('option');
            option.value = lang;
            option.textContent = lang.charAt(0).toUpperCase() + lang.slice(1);
            select.appendChild(option);
        });
    }
};

app.loadAvailableLanguagesForChange = function() {
    const select = document.getElementById('new-target-language');
    select.innerHTML = '<option value="">Select language to learn</option>';

    if (app.availableLanguages) {
        Object.keys(app.availableLanguages).forEach(function(lang) {
            const option = document.createElement('option');
            option.value = lang;
            option.textContent = lang.charAt(0).toUpperCase() + lang.slice(1);
            select.appendChild(option);
        });
    }
};

app.handleLogin = async function(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await api.login(email, password);
        storage.saveUser(email, response.userId, response.nativeLanguage);
        app.user = storage.getUser();

        // Check if user has a selected language
        app.targetLanguage = storage.getLanguage();
        if (!app.targetLanguage) {
            // Show language selection
            ui.showToast('Please select a language to learn', 'success');
            await app.loadAvailableLanguages();
            ui.showScreen('register-screen');
            document.getElementById('register-email').value = email;
            document.getElementById('register-email').disabled = true;
            document.getElementById('register-password').parentElement.style.display = 'none';
            document.getElementById('register-native-language').parentElement.style.display = 'none';
        } else {
            await app.loadAvailableLanguages();
            app.startApp();
        }
    } catch (error) {
        ui.showToast(error.message || 'Login failed', 'error');
    }
};

app.handleRegister = async function(e) {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const nativeLanguage = document.getElementById('register-native-language').value;
    const targetLanguage = document.getElementById('register-target-language').value;

    if (!targetLanguage) {
        ui.showToast('Please select a language to learn', 'error');
        return;
    }

    try {
        const response = await api.register(email, password, nativeLanguage);
        storage.saveUser(email, response.userId, nativeLanguage);
        storage.saveLanguage(targetLanguage);
        app.user = storage.getUser();
        app.targetLanguage = targetLanguage;
        app.startApp();
    } catch (error) {
        ui.showToast(error.message || 'Registration failed', 'error');
    }
};

app.handleLogout = function() {
    storage.clearUser();
    ui.closeMenu();
    ui.showScreen('login-screen');
    app.user = null;
    app.targetLanguage = null;
};

app.handleChangePassword = async function(e) {
    e.preventDefault();
    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;

    try {
        await api.changePassword(app.user.email, oldPassword, newPassword);
        ui.showToast('Password changed successfully', 'success');
        ui.hideModal('change-password-modal');
        document.getElementById('change-password-form').reset();
    } catch (error) {
        ui.showToast(error.message || 'Failed to change password', 'error');
    }
};

app.handleChangeLanguage = function(e) {
    e.preventDefault();
    const newLanguage = document.getElementById('new-target-language').value;

    if (!newLanguage) {
        ui.showToast('Please select a language', 'error');
        return;
    }

    storage.saveLanguage(newLanguage);
    app.targetLanguage = newLanguage;
    ui.hideModal('change-language-modal');
    ui.closeMenu();
    ui.showToast('Language changed successfully', 'success');
    app.startApp();
};

app.handleResetProgress = function() {
    if (confirm('Are you sure you want to reset all progress for ' + app.targetLanguage + '? This cannot be undone.')) {
        storage.resetProgress(app.targetLanguage);
        ui.closeMenu();
        ui.showToast('Progress reset successfully', 'success');
        app.startApp();
    }
};

app.startApp = async function() {
    const progress = storage.getProgress(app.targetLanguage);

    // Update menu
    document.getElementById('current-language-display').textContent =
        `Learning: ${app.targetLanguage.charAt(0).toUpperCase() + app.targetLanguage.slice(1)}`;
    document.getElementById('current-iteration-display').textContent =
        `Iteration: ${progress.currentIteration}/${config.iterationCount}`;

    if (!progress.alphabetComplete) {
        ui.showScreen('alphabet-screen');
        await alphabet.init(app.targetLanguage, app.user.nativeLanguage);
    } else {
        app.currentIteration = progress.currentIteration;
        ui.showScreen('learning-screen');
        await app.loadIteration(app.currentIteration);
    }
};

app.startLearning = function() {
    const targetLang = app.targetLanguage;
    storage.setAlphabetComplete(targetLang);
    ui.showScreen('learning-screen');
    app.loadIteration(1);
};

app.loadIteration = async function(iteration) {
    app.currentIteration = iteration;
    document.getElementById('learning-progress').textContent = `Iteration ${iteration}`;

    await vocabulary.init(app.targetLanguage, app.user.nativeLanguage, iteration);
    await grammar.init(app.targetLanguage, app.user.nativeLanguage, iteration);
    await dialog.init(app.targetLanguage, app.user.nativeLanguage, iteration);

    app.switchTab('vocabulary');
};

app.switchTab = function(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(function(tab) {
        tab.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(function(content) {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-content`).classList.add('active');

    // Update title
    document.getElementById('learning-title').textContent =
        tabName.charAt(0).toUpperCase() + tabName.slice(1);
};

app.nextIteration = function() {
    if (app.currentIteration < config.iterationCount) {
        app.currentIteration++;
        storage.setCurrentIteration(app.targetLanguage, app.currentIteration);
        app.loadIteration(app.currentIteration);
    } else {
        ui.showToast('Congratulations! You completed all iterations!', 'success');
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', app.init);
} else {
    app.init();
}
