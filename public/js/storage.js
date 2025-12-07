// LocalStorage Module - manages client-side data persistence
const storage = {};

storage.saveUser = function(email, userId, nativeLanguage) {
    localStorage.setItem('user', JSON.stringify({
        email: email,
        userId: userId,
        nativeLanguage: nativeLanguage
    }));
};

storage.getUser = function() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
};

storage.clearUser = function() {
    localStorage.removeItem('user');
};

storage.saveLanguage = function(targetLanguage) {
    localStorage.setItem('targetLanguage', targetLanguage);
};

storage.getLanguage = function() {
    return localStorage.getItem('targetLanguage');
};

storage.saveProgress = function(targetLanguage, progress) {
    const key = `progress_${targetLanguage}`;
    localStorage.setItem(key, JSON.stringify(progress));
};

storage.getProgress = function(targetLanguage) {
    const key = `progress_${targetLanguage}`;
    const progressStr = localStorage.getItem(key);
    if (progressStr) {
        return JSON.parse(progressStr);
    }

    // Initialize default progress
    return {
        alphabetComplete: false,
        alphabetMastery: {},
        currentIteration: 1,
        iterations: {}
    };
};

storage.updateAlphabetMastery = function(targetLanguage, character, correctCount) {
    const progress = storage.getProgress(targetLanguage);
    progress.alphabetMastery[character] = correctCount;
    storage.saveProgress(targetLanguage, progress);
};

storage.setAlphabetComplete = function(targetLanguage) {
    const progress = storage.getProgress(targetLanguage);
    progress.alphabetComplete = true;
    storage.saveProgress(targetLanguage, progress);
};

storage.updateIterationProgress = function(targetLanguage, iteration, section, itemId, correctCount) {
    const progress = storage.getProgress(targetLanguage);

    if (!progress.iterations[iteration]) {
        progress.iterations[iteration] = {
            vocabulary: {},
            grammar: {},
            dialog: {}
        };
    }

    progress.iterations[iteration][section][itemId] = correctCount;
    storage.saveProgress(targetLanguage, progress);
};

storage.isIterationComplete = function(targetLanguage, iteration) {
    const progress = storage.getProgress(targetLanguage);
    const iterData = progress.iterations[iteration];

    if (!iterData) return false;

    // Check if all sections have all items mastered
    const vocabComplete = Object.keys(iterData.vocabulary).length >= 10 &&
                          Object.values(iterData.vocabulary).every(c => c >= 3);
    const grammarComplete = Object.values(iterData.grammar).every(c => c >= 3);
    const dialogComplete = Object.values(iterData.dialog).every(c => c >= 3);

    return vocabComplete && grammarComplete && dialogComplete;
};

storage.setCurrentIteration = function(targetLanguage, iteration) {
    const progress = storage.getProgress(targetLanguage);
    progress.currentIteration = iteration;
    storage.saveProgress(targetLanguage, progress);
};

storage.resetProgress = function(targetLanguage) {
    const key = `progress_${targetLanguage}`;
    localStorage.removeItem(key);
};
