const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Load configuration
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: config.openaiApiKey
});

// Utility functions
const utils = {
    ensureDir: function(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    },

    saveJSON: function(filePath, data) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`Saved: ${filePath}`);
    },

    sleep: function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    parseJSON: function(text) {
        // Remove markdown code blocks if present
        let cleaned = text.trim();
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```\n/, '').replace(/\n```$/, '');
        }
        return JSON.parse(cleaned.trim());
    }
};

// OpenAI API interaction
const ai = {
    chat: async function(systemPrompt, userPrompt) {
        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7
            });
            return response.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI API Error:', error.message);
            throw error;
        }
    }
};

// Language data generator
const generator = {
    generateAlphabet: async function(targetLang, learnerLang) {
        console.log(`\nGenerating alphabet for ${targetLang}...`);

        const systemPrompt = `You are a language education expert. Generate accurate alphabet data for ${targetLang}.`;
        const userPrompt = `Generate the complete alphabet for ${targetLang}.
For each character, provide:
1. The character itself
2. Its name in ${targetLang}
3. The sound it makes (pronunciation guide in ${learnerLang})

Return ONLY valid JSON in this exact format:
{
  "alphabet": [
    {"character": "а", "name": "а", "sound": "ah (like 'a' in father)"},
    {"character": "б", "name": "бе", "sound": "b (like 'b' in boy)"}
  ]
}`;

        const response = await ai.chat(systemPrompt, userPrompt);
        return utils.parseJSON(response).alphabet;
    },

    generateVocabulary: async function(targetLang, learnerLang, iterationNum, previousWords) {
        console.log(`\nGenerating vocabulary for iteration ${iterationNum}...`);

        const startIdx = (iterationNum - 1) * config.wordsPerIteration + 1;
        const endIdx = iterationNum * config.wordsPerIteration;

        const systemPrompt = `You are a language education expert. Generate the most common words in ${targetLang}.`;
        const userPrompt = `Generate words ranked ${startIdx}-${endIdx} of the most common words in ${targetLang}.
These should be the most frequently used words in everyday conversation.

${previousWords.length > 0 ? `Previously included words (do NOT repeat these): ${previousWords.join(', ')}` : ''}

For each word, provide:
1. The word in ${targetLang} (normative/dictionary form)
2. Translation to ${learnerLang}
3. Part of speech

Return ONLY valid JSON in this exact format:
{
  "words": [
    {"word": "я", "translation": "I", "partOfSpeech": "pronoun"},
    {"word": "бути", "translation": "to be", "partOfSpeech": "verb"}
  ]
}`;

        const response = await ai.chat(systemPrompt, userPrompt);
        return utils.parseJSON(response).words;
    },

    generateGrammar: async function(targetLang, learnerLang, vocabularyWords) {
        console.log(`  Generating grammar rules...`);

        const wordList = vocabularyWords.map(w => w.word).join(', ');

        const systemPrompt = `You are a language education expert. Create grammar examples for ${targetLang}.`;
        const userPrompt = `Create grammar rule examples for ${targetLang} using ONLY these words: ${wordList}

Generate 5-8 different grammar rules with examples. Each rule should:
1. Demonstrate a specific grammar concept (word order, verb conjugation, cases, etc.)
2. Include an example phrase/sentence using ONLY the provided vocabulary
3. Include a clear explanation in ${learnerLang}
4. Include translation to ${learnerLang}

Return ONLY valid JSON in this exact format:
{
  "grammarRules": [
    {
      "rule": "Subject-Verb word order",
      "example": "я бути",
      "translation": "I am",
      "explanation": "In Ukrainian, the subject typically comes before the verb."
    }
  ]
}`;

        const response = await ai.chat(systemPrompt, userPrompt);
        return utils.parseJSON(response).grammarRules;
    },

    generateDialog: async function(targetLang, learnerLang, vocabularyWords, grammarRules) {
        console.log(`  Generating dialog...`);

        const wordList = vocabularyWords.map(w => w.word).join(', ');

        const systemPrompt = `You are a language education expert. Create realistic dialog in ${targetLang}.`;
        const userPrompt = `Create a natural dialog/conversation in ${targetLang} using ONLY these words: ${wordList}

The dialog should:
1. Use ALL the vocabulary words provided
2. Demonstrate the grammar rules learned in this iteration
3. Be a realistic conversation (2-4 exchanges)
4. Each line should have a translation to ${learnerLang}

Return ONLY valid JSON in this exact format:
{
  "dialog": [
    {"speaker": "Person A", "text": "я бути", "translation": "I am"},
    {"speaker": "Person B", "text": "ти бути", "translation": "You are"}
  ]
}`;

        const response = await ai.chat(systemPrompt, userPrompt);
        return utils.parseJSON(response).dialog;
    },

    generateIteration: async function(targetLang, learnerLang, iterationNum, previousWords) {
        console.log(`\n=== Iteration ${iterationNum}/${config.iterationCount} ===`);

        // Generate vocabulary for this iteration
        const newWords = await generator.generateVocabulary(
            targetLang,
            learnerLang,
            iterationNum,
            previousWords
        );

        await utils.sleep(1000); // Rate limiting

        // All words including previous iterations
        const allWords = [...previousWords].concat(newWords.map(w => w.word));

        // Get all vocabulary objects for this iteration
        const allVocabulary = newWords; // Only store new words per iteration

        // Generate grammar rules
        const grammarRules = await generator.generateGrammar(
            targetLang,
            learnerLang,
            newWords
        );

        await utils.sleep(1000); // Rate limiting

        // Generate dialog
        const dialog = await generator.generateDialog(
            targetLang,
            learnerLang,
            newWords,
            grammarRules
        );

        return {
            iteration: iterationNum,
            vocabulary: allVocabulary,
            grammar: grammarRules,
            dialog: dialog,
            cumulativeWords: allWords
        };
    },

    generateLanguageDataset: async function(targetLang, learnerLang) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Generating dataset for ${targetLang} (learner: ${learnerLang})`);
        console.log(`${'='.repeat(60)}`);

        const dataset = {
            language: targetLang,
            learnerLanguage: learnerLang,
            alphabet: null,
            iterations: []
        };

        // Generate alphabet
        dataset.alphabet = await generator.generateAlphabet(targetLang, learnerLang);
        await utils.sleep(1000); // Rate limiting

        // Generate all iterations
        let cumulativeWords = [];
        for (let i = 1; i <= config.iterationCount; i++) {
            const iteration = await generator.generateIteration(
                targetLang,
                learnerLang,
                i,
                cumulativeWords
            );

            dataset.iterations.push({
                iteration: iteration.iteration,
                vocabulary: iteration.vocabulary,
                grammar: iteration.grammar,
                dialog: iteration.dialog
            });

            cumulativeWords = iteration.cumulativeWords;
            await utils.sleep(1000); // Rate limiting
        }

        return dataset;
    }
};

// Main execution
const main = async function() {
    console.log('LanguageSplicer Dataset Generator');
    console.log('=================================\n');

    // Validate API key
    if (!config.openaiApiKey || config.openaiApiKey === 'YOUR_OPENAI_API_KEY_HERE') {
        console.error('ERROR: Please set your OpenAI API key in config.json');
        process.exit(1);
    }

    // Ensure languages directory exists
    utils.ensureDir(config.languagesDir);

    // Generate datasets for each target language and learner language combination
    for (const targetLang of config.targetLanguages) {
        for (const learnerLang of config.learnerLanguages) {
            try {
                const dataset = await generator.generateLanguageDataset(targetLang, learnerLang);

                // Save to file
                const filename = `${targetLang.toLowerCase().replace(/\s+/g, '-')}-${learnerLang.toLowerCase().replace(/\s+/g, '-')}.json`;
                const filepath = path.join(config.languagesDir, filename);
                utils.saveJSON(filepath, dataset);

                console.log(`\n✓ Completed: ${targetLang} for ${learnerLang} learners`);

                // Longer pause between languages
                await utils.sleep(2000);
            } catch (error) {
                console.error(`\n✗ Failed to generate ${targetLang} for ${learnerLang}:`, error.message);
            }
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Dataset generation complete!');
    console.log(`Files saved to: ${config.languagesDir}/`);
    console.log('='.repeat(60));
};

// Run the generator
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
