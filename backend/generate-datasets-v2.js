const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const OpenAI = require('openai');

// Load configuration
let configPath = './config-phrases-test.json';
if (!fs.existsSync(configPath)) {
    configPath = './config.json';
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

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
        let cleaned = text.trim();
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```\n/, '').replace(/\n```$/, '');
        }
        return JSON.parse(cleaned.trim());
    },

    // Extract individual words from a phrase
    extractWordsFromPhrase: function(phrase) {
        // Remove punctuation
        const cleaned = phrase.replace(/[.,!?;:"'()\[\]{}]/g, '');

        // Split on whitespace
        const words = cleaned.split(/\s+/);

        // Return unique words (case-insensitive)
        const seen = new Set();
        const unique = [];

        words.forEach(function(word) {
            const lower = word.toLowerCase();
            if (lower && !seen.has(lower)) {
                seen.add(lower);
                unique.push(lower);
            }
        });

        return unique;
    },

    // Build iterations from phrases by extracting words deterministically
    buildIterations: function(phrases, minWords) {
        const iterations = [];
        let usedPhrases = 0;
        const allPreviousWords = new Set();

        while (usedPhrases < phrases.length) {
            const iterationPhrases = [];
            const iterationWords = new Set();

            // Add phrases until we have enough unique NEW words
            while (usedPhrases < phrases.length) {
                const phraseObj = phrases[usedPhrases];
                const phraseText = phraseObj.phrase;

                // Extract words from this phrase
                const phraseWords = utils.extractWordsFromPhrase(phraseText);

                // Count how many NEW words this phrase contributes
                const newWords = phraseWords.filter(function(w) {
                    return !allPreviousWords.has(w) && !iterationWords.has(w);
                });

                iterationPhrases.push(phraseObj);
                newWords.forEach(function(w) {
                    iterationWords.add(w);
                });
                usedPhrases++;

                // Stop when we have enough words for this iteration
                if (iterationWords.size >= minWords) {
                    break;
                }
            }

            // Update global word set
            iterationWords.forEach(function(w) {
                allPreviousWords.add(w);
            });

            iterations.push({
                phrases: iterationPhrases,
                extractedWords: Array.from(iterationWords).sort()
            });
        }

        return {
            iterations: iterations,
            totalPhrases: phrases.length,
            totalIterations: iterations.length
        };
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

// V2 Generator - Deterministic vocabulary extraction
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
    {"character": "а", "name": "а", "sound": "ah (like 'a' in father)"}
  ]
}`;

        const response = await ai.chat(systemPrompt, userPrompt);
        return utils.parseJSON(response).alphabet;
    },

    generateAll200Phrases: async function(targetLang, learnerLang) {
        console.log(`\nGenerating 200 most common phrases for ${targetLang}...`);

        const systemPrompt = `You are a language education expert specializing in ${targetLang}.`;
        const userPrompt = `Generate the 200 most common everyday phrases in ${targetLang}.
These should be practical phrases people use in daily conversation, ordered from most to least common.

Examples: greetings, common questions, polite expressions, basic needs, etc.

Return ONLY valid JSON in this exact format:
{
  "phrases": [
    {"phrase": "Привіт", "translation": "Hello"},
    {"phrase": "Як справи?", "translation": "How are you?"},
    {"phrase": "Дякую", "translation": "Thank you"}
  ]
}

Generate ALL 200 phrases in order of frequency.`;

        const response = await ai.chat(systemPrompt, userPrompt);
        return utils.parseJSON(response).phrases;
    },

    translateVocabulary: async function(words, targetLang, learnerLang) {
        console.log(`  Translating ${words.length} vocabulary words...`);

        const systemPrompt = `You are a language translation expert for ${targetLang}.`;
        const userPrompt = `Translate these ${targetLang} words to ${learnerLang}.
Provide the normative/dictionary form, translation, and part of speech.

Words: ${words.join(', ')}

Return ONLY valid JSON in this exact format:
{
  "vocabulary": [
    {"word": "як", "translation": "how", "partOfSpeech": "adverb"}
  ]
}`;

        const response = await ai.chat(systemPrompt, userPrompt);
        return utils.parseJSON(response).vocabulary;
    },

    generateGrammarFromPhrases: async function(targetLang, learnerLang, phrases, vocabulary) {
        console.log(`  Generating grammar rules from phrases...`);

        const phrasesText = phrases.map(p => `"${p.phrase}" (${p.translation})`).join(', ');
        const vocabList = vocabulary.map(v => v.word).join(', ');

        const systemPrompt = `You are a language education expert.`;
        const userPrompt = `Analyze these ${targetLang} phrases: ${phrasesText}

Extract 5-8 different grammar patterns. Use ONLY vocabulary from: ${vocabList}

Return ONLY valid JSON in this exact format:
{
  "grammarRules": [
    {
      "rule": "Question formation",
      "example": "Як справи?",
      "translation": "How are things?",
      "explanation": "Questions often start with question words."
    }
  ]
}`;

        const response = await ai.chat(systemPrompt, userPrompt);
        return utils.parseJSON(response).grammarRules;
    },

    generateDialogFromPhrases: async function(targetLang, learnerLang, phrases, vocabulary) {
        console.log(`  Generating dialog from phrases...`);

        const phrasesText = phrases.map(p => `"${p.phrase}"`).join(', ');
        const vocabList = vocabulary.map(v => v.word).join(', ');

        const systemPrompt = `You are a strict language education expert. You MUST only use provided phrases and vocabulary.`;
        const userPrompt = `Create a natural conversation in ${targetLang}.

REQUIRED: You MUST use ALL of these original phrases: ${phrasesText}

ALLOWED VOCABULARY (for additional lines only): ${vocabList}

Rules:
1. Include ALL ${phrases.length} original phrases
2. Add 2-3 additional lines using ONLY the allowed vocabulary
3. Total: ${phrases.length + 2} to ${phrases.length + 3} dialog lines
4. NO new words outside the allowed vocabulary

Return ONLY valid JSON:
{
  "dialog": [
    {"speaker": "Person A", "text": "Привіт", "translation": "Hello"}
  ]
}`;

        const response = await ai.chat(systemPrompt, userPrompt);
        return utils.parseJSON(response).dialog;
    },

    generateLanguageDataset: async function(targetLang, learnerLang) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Generating V2 dataset for ${targetLang} (learner: ${learnerLang})`);
        console.log(`${'='.repeat(60)}`);

        const dataset = {
            language: targetLang,
            learnerLanguage: learnerLang,
            generationMethod: 'phrase-based-v2',
            alphabet: null,
            iterations: []
        };

        // Step 1: Generate alphabet
        dataset.alphabet = await generator.generateAlphabet(targetLang, learnerLang);
        await utils.sleep(1000);

        // Step 2: Generate all 200 phrases upfront
        const allPhrases = await generator.generateAll200Phrases(targetLang, learnerLang);
        console.log(`  Generated ${allPhrases.length} phrases`);
        await utils.sleep(1000);

        // Step 3: Use JavaScript to deterministically extract words and build iterations
        console.log('\nBuilding iterations from phrases...');
        const iterationData = utils.buildIterations(allPhrases, config.wordsPerIteration);
        console.log(`  Created ${iterationData.totalIterations} iterations from ${iterationData.totalPhrases} phrases`);

        // Step 4: For each iteration, get translations and generate grammar/dialog
        for (let i = 0; i < iterationData.iterations.length && i < config.iterationCount; i++) {
            const iterInfo = iterationData.iterations[i];
            const iterNum = i + 1;

            console.log(`\n=== Iteration ${iterNum}/${config.iterationCount} ===`);
            console.log(`  Phrases: ${iterInfo.phrases.length}, Words: ${iterInfo.extractedWords.length}`);

            // Translate vocabulary
            const vocabulary = await generator.translateVocabulary(
                iterInfo.extractedWords,
                targetLang,
                learnerLang
            );
            await utils.sleep(1000);

            // Generate grammar rules
            const grammarRules = await generator.generateGrammarFromPhrases(
                targetLang,
                learnerLang,
                iterInfo.phrases,
                vocabulary
            );
            await utils.sleep(1000);

            // Generate dialog using original phrases + vocabulary
            const dialog = await generator.generateDialogFromPhrases(
                targetLang,
                learnerLang,
                iterInfo.phrases,
                vocabulary
            );
            await utils.sleep(1000);

            dataset.iterations.push({
                iteration: iterNum,
                vocabulary: vocabulary,
                grammar: grammarRules,
                dialog: dialog
            });
        }

        return dataset;
    }
};

// Main execution
const main = async function() {
    console.log('LanguageSplicer V2 Dataset Generator');
    console.log('(Deterministic phrase-to-vocabulary extraction)');
    console.log('='.repeat(60) + '\n');

    // Validate API key
    if (!config.openaiApiKey || config.openaiApiKey === 'YOUR_OPENAI_API_KEY_HERE') {
        console.error('ERROR: Please set your OpenAI API key in config.json');
        process.exit(1);
    }

    // Ensure languages directory exists
    utils.ensureDir(config.languagesDir);

    // Generate datasets
    for (const targetLang of config.targetLanguages) {
        for (const learnerLang of config.learnerLanguages) {
            try {
                const dataset = await generator.generateLanguageDataset(targetLang, learnerLang);

                const filename = `${targetLang.toLowerCase().replace(/\s+/g, '-')}-${learnerLang.toLowerCase().replace(/\s+/g, '-')}-v2.json`;
                const filepath = path.join(config.languagesDir, filename);
                utils.saveJSON(filepath, dataset);

                console.log(`\n✓ Completed: ${targetLang} for ${learnerLang} learners (V2)`);
                await utils.sleep(2000);
            } catch (error) {
                console.error(`\n✗ Failed to generate ${targetLang} for ${learnerLang}:`, error.message);
                console.error(error.stack);
            }
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('V2 dataset generation complete!');
    console.log(`Files saved to: ${config.languagesDir}/`);
    console.log('='.repeat(60));
};

// Run the generator
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
