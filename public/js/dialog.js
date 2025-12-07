// Dialog Learning Module
const dialog = {};

dialog.data = null;
dialog.mastery = {};
dialog.iteration = 1;
dialog.isStarted = false;
dialog.currentIndex = 0;

dialog.init = async function(targetLang, learnerLang, iteration) {
    dialog.iteration = iteration;
    dialog.isStarted = false;
    dialog.currentIndex = 0;
    try {
        const response = await api.getIteration(targetLang, learnerLang, iteration);
        dialog.data = response.dialog;
        const progress = storage.getProgress(targetLang);
        dialog.mastery = (progress.iterations[iteration] || {}).dialog || {};
        dialog.showPreview();
    } catch (error) {
        ui.showToast('Failed to load dialog', 'error');
    }
};

dialog.showPreview = function() {
    const preview = document.getElementById('dialog-preview');
    const learning = document.getElementById('dialog-learning');
    const complete = document.getElementById('dialog-complete');

    const allMastered = dialog.data.every(function(line) {
        return (dialog.mastery[line.text] || 0) >= 3;
    });

    if (allMastered) {
        preview.classList.add('hidden');
        learning.classList.add('hidden');
        complete.classList.remove('hidden');
        return;
    }

    preview.classList.remove('hidden');
    learning.classList.add('hidden');
    complete.classList.add('hidden');

    const list = document.getElementById('dialog-list');
    list.innerHTML = '';

    dialog.data.forEach(function(line) {
        const item = document.createElement('div');
        item.className = 'preview-item';

        const speakerDiv = document.createElement('div');
        speakerDiv.className = 'preview-item-explanation';
        speakerDiv.textContent = line.speaker;

        const textDiv = document.createElement('div');
        textDiv.className = 'preview-item-word';
        textDiv.textContent = line.text;

        const translationDiv = document.createElement('div');
        translationDiv.className = 'preview-item-translation';
        translationDiv.textContent = line.translation;

        item.appendChild(speakerDiv);
        item.appendChild(textDiv);
        item.appendChild(translationDiv);
        list.appendChild(item);
    });

    const startBtn = document.getElementById('dialog-start');
    startBtn.onclick = dialog.startLearning;
};

dialog.startLearning = function() {
    dialog.isStarted = true;
    document.getElementById('dialog-preview').classList.add('hidden');
    document.getElementById('dialog-learning').classList.remove('hidden');
    dialog.render();
};

dialog.render = function() {
    if (!dialog.data || !dialog.isStarted) return;

    const learning = document.getElementById('dialog-learning');
    const complete = document.getElementById('dialog-complete');

    const allMastered = dialog.data.every(function(line) {
        return (dialog.mastery[line.text] || 0) >= 3;
    });

    if (allMastered) {
        learning.classList.add('hidden');
        complete.classList.remove('hidden');
        return;
    }

    learning.classList.remove('hidden');
    complete.classList.add('hidden');

    dialog.updateProgress();

    // Show dialog lines sequentially, in order
    // Find the first unmastered line from current position
    let foundUnmastered = false;
    for (let i = 0; i < dialog.data.length; i++) {
        const idx = (dialog.currentIndex + i) % dialog.data.length;
        const line = dialog.data[idx];

        if ((dialog.mastery[line.text] || 0) < 3) {
            dialog.currentIndex = idx;
            dialog.showLine(line);
            foundUnmastered = true;
            break;
        }
    }

    if (foundUnmastered) {
        // Move to next line for next time
        dialog.currentIndex = (dialog.currentIndex + 1) % dialog.data.length;
    }
};

dialog.updateProgress = function() {
    const mastered = dialog.data.filter(function(line) {
        return (dialog.mastery[line.text] || 0) >= 3;
    }).length;

    const total = dialog.data.length;
    const percentage = (mastered / total) * 100;

    document.getElementById('dialog-progress-bar').style.width = percentage + '%';
    document.getElementById('dialog-progress-text').textContent = `${mastered}/${total} mastered`;
};

dialog.showLine = function(line) {
    document.getElementById('dialog-speaker').textContent = line.speaker;
    document.getElementById('dialog-text').textContent = line.text;

    const distractors = dialog.data
        .filter(function(l) { return l.text !== line.text; })
        .sort(function() { return Math.random() - 0.5; })
        .slice(0, 3)
        .map(function(l) { return l.translation; });

    const optionsContainer = document.getElementById('dialog-options');
    optionsContainer.innerHTML = '';
    const options = ui.createOptions(
        line.translation,
        distractors,
        function(button, isCorrect) {
            dialog.handleAnswer(line, isCorrect, button);
        }
    );
    optionsContainer.appendChild(options);
};

dialog.handleAnswer = function(line, isCorrect, button) {
    const targetLang = storage.getLanguage();
    const currentMastery = dialog.mastery[line.text] || 0;

    if (isCorrect) {
        dialog.mastery[line.text] = currentMastery + 1;
        storage.updateIterationProgress(targetLang, dialog.iteration, 'dialog', line.text, dialog.mastery[line.text]);

        ui.handleOptionSelect(button, true, function() {
            dialog.render();
        });
    } else {
        dialog.mastery[line.text] = 0;
        storage.updateIterationProgress(targetLang, dialog.iteration, 'dialog', line.text, 0);

        ui.handleOptionSelect(button, false, function() {
            dialog.render();
        });
    }
};
