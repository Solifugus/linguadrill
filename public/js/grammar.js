// Grammar Learning Module
const grammar = {};

grammar.data = null;
grammar.mastery = {};
grammar.iteration = 1;
grammar.isStarted = false;
grammar.lastShown = null;

grammar.init = async function(targetLang, learnerLang, iteration) {
    grammar.iteration = iteration;
    grammar.isStarted = false;
    try {
        const response = await api.getIteration(targetLang, learnerLang, iteration);
        grammar.data = response.grammar;
        const progress = storage.getProgress(targetLang);
        grammar.mastery = (progress.iterations[iteration] || {}).grammar || {};
        grammar.showPreview();
    } catch (error) {
        ui.showToast('Failed to load grammar', 'error');
    }
};

grammar.showPreview = function() {
    const preview = document.getElementById('grammar-preview');
    const learning = document.getElementById('grammar-learning');
    const complete = document.getElementById('grammar-complete');

    const allMastered = grammar.data.every(function(rule) {
        return (grammar.mastery[rule.rule] || 0) >= 3;
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

    const list = document.getElementById('grammar-list');
    list.innerHTML = '';

    grammar.data.forEach(function(rule) {
        const item = document.createElement('div');
        item.className = 'preview-item';

        const ruleDiv = document.createElement('div');
        ruleDiv.className = 'preview-item-word';
        ruleDiv.textContent = rule.rule;

        const exampleDiv = document.createElement('div');
        exampleDiv.className = 'preview-item-translation';
        exampleDiv.textContent = `Example: ${rule.example}`;

        const translationDiv = document.createElement('div');
        translationDiv.className = 'preview-item-explanation';
        translationDiv.textContent = rule.translation;

        item.appendChild(ruleDiv);
        item.appendChild(exampleDiv);
        item.appendChild(translationDiv);
        list.appendChild(item);
    });

    const startBtn = document.getElementById('grammar-start');
    startBtn.onclick = grammar.startLearning;
};

grammar.startLearning = function() {
    grammar.isStarted = true;
    document.getElementById('grammar-preview').classList.add('hidden');
    document.getElementById('grammar-learning').classList.remove('hidden');
    grammar.render();
};

grammar.render = function() {
    if (!grammar.data || !grammar.isStarted) return;

    const learning = document.getElementById('grammar-learning');
    const complete = document.getElementById('grammar-complete');

    const allMastered = grammar.data.every(function(rule) {
        return (grammar.mastery[rule.rule] || 0) >= 3;
    });

    if (allMastered) {
        learning.classList.add('hidden');
        complete.classList.remove('hidden');
        return;
    }

    learning.classList.remove('hidden');
    complete.classList.add('hidden');

    grammar.updateProgress();

    const unmastered = grammar.data.filter(function(rule) {
        return (grammar.mastery[rule.rule] || 0) < 3;
    });

    if (unmastered.length > 0) {
        let current;
        if (unmastered.length === 1) {
            // If only one item left, show it
            current = unmastered[0];
        } else {
            // Pick a random item that's different from the last shown
            const available = unmastered.filter(function(rule) {
                return !grammar.lastShown || rule.rule !== grammar.lastShown.rule;
            });
            current = available[Math.floor(Math.random() * available.length)];
        }
        grammar.lastShown = current;
        grammar.showRule(current);
    }
};

grammar.updateProgress = function() {
    const mastered = grammar.data.filter(function(rule) {
        return (grammar.mastery[rule.rule] || 0) >= 3;
    }).length;

    const total = grammar.data.length;
    const percentage = (mastered / total) * 100;

    document.getElementById('grammar-progress-bar').style.width = percentage + '%';
    document.getElementById('grammar-progress-text').textContent = `${mastered}/${total} mastered`;
};

grammar.showRule = function(rule) {
    document.getElementById('grammar-rule').textContent = rule.rule;
    const exampleDisplay = document.getElementById('grammar-example');
    exampleDisplay.textContent = rule.example;

    // Add audio button if available
    if (rule.audioUrl) {
        const audioBtn = audio.createButton(rule.audioUrl);
        exampleDisplay.parentElement.appendChild(audioBtn);
    }

    const distractors = grammar.data
        .filter(function(r) { return r.rule !== rule.rule; })
        .sort(function() { return Math.random() - 0.5; })
        .slice(0, 3)
        .map(function(r) { return r.translation; });

    const optionsContainer = document.getElementById('grammar-options');
    optionsContainer.innerHTML = '';
    const options = ui.createOptions(
        rule.translation,
        distractors,
        function(button, isCorrect) {
            grammar.handleAnswer(rule, isCorrect, button);
        }
    );
    optionsContainer.appendChild(options);
};

grammar.handleAnswer = function(rule, isCorrect, button) {
    const targetLang = storage.getLanguage();
    const currentMastery = grammar.mastery[rule.rule] || 0;

    if (isCorrect) {
        grammar.mastery[rule.rule] = currentMastery + 1;
        storage.updateIterationProgress(targetLang, grammar.iteration, 'grammar', rule.rule, grammar.mastery[rule.rule]);

        ui.handleOptionSelect(button, true, function() {
            grammar.render();
        });
    } else {
        grammar.mastery[rule.rule] = 0;
        storage.updateIterationProgress(targetLang, grammar.iteration, 'grammar', rule.rule, 0);

        ui.handleOptionSelect(button, false, function() {
            grammar.render();
        });
    }
};
