// Vocabulary Learning Module
const vocabulary = {};

vocabulary.data = null;
vocabulary.mastery = {};
vocabulary.iteration = 1;
vocabulary.isStarted = false;
vocabulary.lastShown = null;

vocabulary.init = async function(targetLang, learnerLang, iteration) {
    vocabulary.iteration = iteration;
    vocabulary.isStarted = false;
    try {
        const response = await api.getIteration(targetLang, learnerLang, iteration);
        vocabulary.data = response.vocabulary;
        const progress = storage.getProgress(targetLang);
        vocabulary.mastery = (progress.iterations[iteration] || {}).vocabulary || {};
        vocabulary.showPreview();
    } catch (error) {
        ui.showToast('Failed to load vocabulary', 'error');
    }
};

vocabulary.showPreview = function() {
    const preview = document.getElementById('vocabulary-preview');
    const learning = document.getElementById('vocabulary-learning');
    const complete = document.getElementById('vocabulary-complete');

    // Check if already completed
    const allMastered = vocabulary.data.every(function(word) {
        return (vocabulary.mastery[word.word] || 0) >= 3;
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

    // Populate preview list
    const list = document.getElementById('vocabulary-list');
    list.innerHTML = '';

    vocabulary.data.forEach(function(word) {
        const item = document.createElement('div');
        item.className = 'preview-item';

        const wordDiv = document.createElement('div');
        wordDiv.className = 'preview-item-word';
        wordDiv.textContent = word.word;

        const translationDiv = document.createElement('div');
        translationDiv.className = 'preview-item-translation';
        translationDiv.textContent = word.translation;

        const partOfSpeech = document.createElement('div');
        partOfSpeech.className = 'preview-item-explanation';
        partOfSpeech.textContent = `(${word.partOfSpeech})`;

        item.appendChild(wordDiv);
        item.appendChild(translationDiv);
        item.appendChild(partOfSpeech);
        list.appendChild(item);
    });

    // Setup start button
    const startBtn = document.getElementById('vocabulary-start');
    startBtn.onclick = vocabulary.startLearning;
};

vocabulary.startLearning = function() {
    vocabulary.isStarted = true;
    document.getElementById('vocabulary-preview').classList.add('hidden');
    document.getElementById('vocabulary-learning').classList.remove('hidden');
    vocabulary.render();
};

vocabulary.render = function() {
    if (!vocabulary.data || !vocabulary.isStarted) return;

    const learning = document.getElementById('vocabulary-learning');
    const complete = document.getElementById('vocabulary-complete');

    const allMastered = vocabulary.data.every(function(word) {
        return (vocabulary.mastery[word.word] || 0) >= 3;
    });

    if (allMastered) {
        learning.classList.add('hidden');
        complete.classList.remove('hidden');
        return;
    }

    learning.classList.remove('hidden');
    complete.classList.add('hidden');

    vocabulary.updateProgress();

    const unmastered = vocabulary.data.filter(function(word) {
        return (vocabulary.mastery[word.word] || 0) < 3;
    });

    if (unmastered.length > 0) {
        let current;
        if (unmastered.length === 1) {
            // If only one item left, show it
            current = unmastered[0];
        } else {
            // Pick a random item that's different from the last shown
            const available = unmastered.filter(function(word) {
                return !vocabulary.lastShown || word.word !== vocabulary.lastShown.word;
            });
            current = available[Math.floor(Math.random() * available.length)];
        }
        vocabulary.lastShown = current;
        vocabulary.showWord(current);
    }
};

vocabulary.updateProgress = function() {
    const mastered = vocabulary.data.filter(function(word) {
        return (vocabulary.mastery[word.word] || 0) >= 3;
    }).length;

    const total = vocabulary.data.length;
    const percentage = (mastered / total) * 100;

    document.getElementById('vocabulary-progress-bar').style.width = percentage + '%';
    document.getElementById('vocabulary-progress-text').textContent = `${mastered}/${total} mastered`;
};

vocabulary.showWord = function(word) {
    const wordDisplay = document.getElementById('vocabulary-word');
    wordDisplay.textContent = word.word;

    // Add audio button if available
    if (word.audioUrl) {
        const audioBtn = audio.createButton(word.audioUrl);
        wordDisplay.parentElement.appendChild(audioBtn);
    }

    const distractors = vocabulary.data
        .filter(function(w) { return w.word !== word.word; })
        .sort(function() { return Math.random() - 0.5; })
        .slice(0, 3)
        .map(function(w) { return w.translation; });

    const optionsContainer = document.getElementById('vocabulary-options');
    optionsContainer.innerHTML = '';
    const options = ui.createOptions(
        word.translation,
        distractors,
        function(button, isCorrect) {
            vocabulary.handleAnswer(word, isCorrect, button);
        }
    );
    optionsContainer.appendChild(options);
};

vocabulary.handleAnswer = function(word, isCorrect, button) {
    const targetLang = storage.getLanguage();
    const currentMastery = vocabulary.mastery[word.word] || 0;

    if (isCorrect) {
        vocabulary.mastery[word.word] = currentMastery + 1;
        storage.updateIterationProgress(targetLang, vocabulary.iteration, 'vocabulary', word.word, vocabulary.mastery[word.word]);

        ui.handleOptionSelect(button, true, function() {
            vocabulary.render();
        });
    } else {
        vocabulary.mastery[word.word] = 0;
        storage.updateIterationProgress(targetLang, vocabulary.iteration, 'vocabulary', word.word, 0);

        ui.handleOptionSelect(button, false, function() {
            vocabulary.render();
        });
    }
};
