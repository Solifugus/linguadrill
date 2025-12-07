// Alphabet Learning Module
const alphabet = {};

alphabet.data = null;
alphabet.currentIndex = 0;
alphabet.mastery = {};

alphabet.init = async function(targetLang, learnerLang) {
    try {
        const response = await api.getAlphabet(targetLang, learnerLang);
        alphabet.data = response.alphabet;
        const progress = storage.getProgress(targetLang);
        alphabet.mastery = progress.alphabetMastery || {};
        alphabet.currentIndex = 0;
        alphabet.render();
    } catch (error) {
        ui.showToast('Failed to load alphabet', 'error');
    }
};

alphabet.render = function() {
    if (!alphabet.data || alphabet.data.length === 0) return;

    const card = document.getElementById('alphabet-card');
    const complete = document.getElementById('alphabet-complete');

    // Check if all mastered
    const allMastered = alphabet.data.every(function(letter) {
        return (alphabet.mastery[letter.character] || 0) >= 3;
    });

    if (allMastered) {
        card.classList.add('hidden');
        complete.classList.remove('hidden');
        return;
    }

    card.classList.remove('hidden');
    complete.classList.add('hidden');

    // Find next unmastered or least mastered
    const unmastered = alphabet.data.filter(function(letter) {
        return (alphabet.mastery[letter.character] || 0) < 3;
    });

    if (unmastered.length > 0) {
        const current = unmastered[Math.floor(Math.random() * unmastered.length)];
        alphabet.showCharacter(current);
    }

    // Update progress
    const mastered = alphabet.data.filter(function(letter) {
        return (alphabet.mastery[letter.character] || 0) >= 3;
    }).length;
    document.getElementById('alphabet-progress').textContent = `${mastered}/${alphabet.data.length}`;
};

alphabet.showCharacter = function(letter) {
    const characterDisplay = document.getElementById('alphabet-character');
    characterDisplay.textContent = letter.character;

    // Add audio button if available
    if (letter.audioUrl) {
        const audioBtn = audio.createButton(letter.audioUrl);
        characterDisplay.parentElement.appendChild(audioBtn);
    }

    const distractors = alphabet.data
        .filter(function(l) { return l.character !== letter.character; })
        .sort(function() { return Math.random() - 0.5; })
        .slice(0, 3)
        .map(function(l) { return l.sound; });

    const optionsContainer = document.getElementById('alphabet-options');
    optionsContainer.innerHTML = '';
    const options = ui.createOptions(
        letter.sound,
        distractors,
        function(button, isCorrect) {
            alphabet.handleAnswer(letter, isCorrect, button);
        }
    );
    optionsContainer.appendChild(options);
};

alphabet.handleAnswer = function(letter, isCorrect, button) {
    const targetLang = storage.getLanguage();
    const currentMastery = alphabet.mastery[letter.character] || 0;

    if (isCorrect) {
        alphabet.mastery[letter.character] = currentMastery + 1;
        storage.updateAlphabetMastery(targetLang, letter.character, alphabet.mastery[letter.character]);

        ui.handleOptionSelect(button, true, function() {
            alphabet.render();
        });
    } else {
        alphabet.mastery[letter.character] = 0;
        storage.updateAlphabetMastery(targetLang, letter.character, 0);

        ui.handleOptionSelect(button, false, function() {
            alphabet.render();
        });
    }
};
