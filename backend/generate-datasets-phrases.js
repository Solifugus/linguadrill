const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Load configuration - use test config if it exists, otherwise use main config
let configPath = './config-phrases-test.json';
if (!fs.existsSync(configPath)) {
    configPath = './config.json';
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: config.openaiApiKey
});

// Utility functions (reused from original)
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

// Phrase-based generator
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

    generateIterationPhrases: async function(targetLang, learnerLang, iterationNum, previousVocab) {
        console.log(`\nGenerating phrases for iteration ${iterationNum}...`);

        const startIdx = (iterationNum - 1) * 10 + 1;
        const endIdx = iterationNum * 10;

        const systemPrompt = `You are a language education expert specializing in ${targetLang}.`;
        const userPrompt = `Generate the ${startIdx} through ${endIdx} most common everyday phrases in ${targetLang}.
These should be practical phrases people use in daily conversation.

${previousVocab.length > 0 ? `Previously learned words (can reuse but don't focus on): ${previousVocab.join(', ')}` : ''}

For each phrase:
1. The phrase in ${targetLang}
2. Translation to ${learnerLang}
3. List of NEW vocabulary words from the phrase (in normative form) with translations

Return ONLY valid JSON in this exact format:
{
  "phrases": [
    {
      "phrase": "Як справи?",
      "translation": "How are you?",
      "newVocab": [
        {"word": "як", "translation": "how", "partOfSpeech": "adverb"},
        {"word": "справи", "translation": "affairs/things", "partOfSpeech": "noun"}
      ]
    }
  ]
}

IMPORTANT: Extract at least 8-12 NEW vocabulary words total across all phrases. Each phrase should contribute new vocabulary.`;

        const response = await ai.chat(systemPrompt, userPrompt);
        return utils.parseJSON(response).phrases;
    },

    extractVocabulary: function(phrases) {
        const vocabMap = {};

        phrases.forEach(function(phrase) {
            if (phrase.newVocab) {
                phrase.newVocab.forEach(function(word) {
                    if (!vocabMap[word.word]) {
                        vocabMap[word.word] = word;
                    }
                });
            }
        });

        return Object.values(vocabMap);
    },

    generateGrammar: async function(targetLang, learnerLang, phrases, vocabulary) {
        console.log(`  Generating grammar rules from phrases...`);

        const phrasesText = phrases.map(p => p.phrase).join(', ');
        const vocabList = vocabulary.map(v => v.word).join(', ');

        const systemPrompt = `You are a language education expert. Create grammar examples for ${targetLang}.`;
        const userPrompt = `Based on these phrases: ${phrasesText}

Extract and explain 5-8 different grammar patterns. Use ONLY vocabulary from: ${vocabList}

Each rule should:
1. Identify a grammar concept (word order, verb forms, cases, particles, etc.)
2. Provide an example using the learned vocabulary
3. Give clear explanation in ${learnerLang}
4. Include translation

Return ONLY valid JSON in this exact format:
{
  "grammarRules": [
    {
      "rule": "Question formation with 'як'",
      "example": "Як справи?",
      "translation": "How are things?",
      "explanation": "Questions often start with question words like 'як' (how). The verb can be implied."
    }
  ]
}`;

        const response = await ai.chat(systemPrompt, userPrompt);
        return utils.parseJSON(response).grammarRules;
    },

    generateDialogFromPhrases: async function(targetLang, learnerLang, phrases, vocabulary) {
        console.log(`  Generating dialog using phrases...`);

        const originalPhrases = phrases.map(p => `"${p.phrase}" (${p.translation})`).join(', ');
        const vocabList = vocabulary.map(v => v.word).join(', ');

        const systemPrompt = `You are a strict language education expert. You must ONLY use the provided vocabulary words.`;
        const userPrompt = `Create a conversation in ${targetLang} using ONLY these elements:

REQUIRED PHRASES (must include ALL of these):
${originalPhrases}

ALLOWED VOCABULARY (you may ONLY use these words):
${vocabList}

CRITICAL RULES:
1. MUST include ALL ${phrases.length} original phrases in the dialog
2. Additional lines can ONLY use words from the allowed vocabulary list above
3. DO NOT introduce ANY new words not in the vocabulary list
4. If you cannot make a natural sentence with only these words, use simpler constructions
5. Generate 8-12 total dialog lines
6. Each line needs speaker and translation

Return ONLY valid JSON in this exact format:
{
  "dialog": [
    {"speaker": "Person A", "text": "Як справи?", "translation": "How are you?"},
    {"speaker": "Person B", "text": "Добре, дякую", "translation": "Good, thank you"}
  ]
}

VERIFY: Every word in the "text" field must appear in either the required phrases or allowed vocabulary list.`;

        const response = await ai.chat(systemPrompt, userPrompt);
        return utils.parseJSON(response).dialog;
    },

    generateIteration: async function(targetLang, learnerLang, iterationNum, previousVocab) {
        console.log(`\n=== Iteration ${iterationNum}/${config.iterationCount} ===`);

        // Step 1: Generate phrases and extract vocabulary
        const phrases = await generator.generateIterationPhrases(
            targetLang,
            learnerLang,
            iterationNum,
            previousVocab
        );

        await utils.sleep(1000);

        // Step 2: Extract vocabulary from phrases
        const newVocabulary = generator.extractVocabulary(phrases);
        console.log(`  Extracted ${newVocabulary.length} new vocabulary words`);

        // Step 3: Generate grammar rules based on phrases
        const grammarRules = await generator.generateGrammar(
            targetLang,
            learnerLang,
            phrases,
            newVocabulary
        );

        await utils.sleep(1000);

        // Step 4: Generate dialog using original phrases + learned vocab
        const dialog = await generator.generateDialogFromPhrases(
            targetLang,
            learnerLang,
            phrases,
            newVocabulary
        );

        // Update cumulative vocabulary
        const allWords = previousVocab.concat(newVocabulary.map(v => v.word));

        return {
            iteration: iterationNum,
            vocabulary: newVocabulary,
            grammar: grammarRules,
            dialog: dialog,
            cumulativeWords: allWords
        };
    },

    generateLanguageDataset: async function(targetLang, learnerLang) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Generating PHRASE-BASED dataset for ${targetLang} (learner: ${learnerLang})`);
        console.log(`${'='.repeat(60)}`);

        const dataset = {
            language: targetLang,
            learnerLanguage: learnerLang,
            generationMethod: 'phrase-based',
            alphabet: null,
            iterations: []
        };

        // Generate alphabet
        dataset.alphabet = await generator.generateAlphabet(targetLang, learnerLang);
        await utils.sleep(1000);

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
            await utils.sleep(1000);
        }

        return dataset;
    }
};

// Main execution
const main = async function() {
    console.log('LanguageSplicer PHRASE-BASED Dataset Generator');
    console.log('='.repeat(60) + '\n');

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

                // Save to file with "phrases" prefix
                const filename = `${targetLang.toLowerCase().replace(/\s+/g, '-')}-${learnerLang.toLowerCase().replace(/\s+/g, '-')}-phrases.json`;
                const filepath = path.join(config.languagesDir, filename);
                utils.saveJSON(filepath, dataset);

                console.log(`\n✓ Completed: ${targetLang} for ${learnerLang} learners (phrase-based)`);

                // Longer pause between languages
                await utils.sleep(2000);
            } catch (error) {
                console.error(`\n✗ Failed to generate ${targetLang} for ${learnerLang}:`, error.message);
            }
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Phrase-based dataset generation complete!');
    console.log(`Files saved to: ${config.languagesDir}/`);
    console.log('='.repeat(60));
};

// Run the generator
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
