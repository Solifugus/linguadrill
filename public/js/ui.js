// UI Module - handles all UI interactions and screen management
const ui = {};

ui.showScreen = function(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(function(screen) {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
};

ui.showToast = function(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast';
    if (type) {
        toast.classList.add(type);
    }
    toast.classList.remove('hidden');

    setTimeout(function() {
        toast.classList.add('hidden');
    }, 3000);
};

ui.showOverlay = function() {
    document.getElementById('overlay').classList.remove('hidden');
};

ui.hideOverlay = function() {
    document.getElementById('overlay').classList.add('hidden');
};

ui.showModal = function(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
    ui.showOverlay();
};

ui.hideModal = function(modalId) {
    document.getElementById(modalId).classList.add('hidden');
    ui.hideOverlay();
};

ui.openMenu = function() {
    document.getElementById('side-menu').classList.add('open');
    ui.showOverlay();
};

ui.closeMenu = function() {
    document.getElementById('side-menu').classList.remove('open');
    ui.hideOverlay();
};

ui.shuffle = function(array) {
    const shuffled = array.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = temp;
    }
    return shuffled;
};

ui.createOptions = function(correct, distractors, onSelect) {
    const options = [correct].concat(distractors);
    const shuffled = ui.shuffle(options);

    const container = document.createElement('div');
    container.className = 'options';

    shuffled.forEach(function(option) {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = option.text || option;
        button.onclick = function() {
            const isCorrect = (option === correct || (option.text && option.text === correct.text));
            onSelect(button, isCorrect);
        };
        container.appendChild(button);
    });

    return container;
};

ui.handleOptionSelect = function(button, isCorrect, onCorrect, onIncorrect) {
    const buttons = button.parentElement.querySelectorAll('.option-btn');
    buttons.forEach(function(btn) {
        btn.disabled = true;
    });

    if (isCorrect) {
        button.classList.add('correct');
        setTimeout(function() {
            buttons.forEach(function(btn) {
                btn.disabled = false;
                btn.classList.remove('correct', 'incorrect');
            });
            if (onCorrect) onCorrect();
        }, 1000);
    } else {
        button.classList.add('incorrect');
        setTimeout(function() {
            buttons.forEach(function(btn) {
                btn.disabled = false;
                btn.classList.remove('incorrect');
            });
            if (onIncorrect) onIncorrect();
        }, 1000);
    }
};
