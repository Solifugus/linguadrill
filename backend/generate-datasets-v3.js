const fs = require('fs');
const path = require('path');
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

    extractWordsFromText: function(text) {
        const cleaned = text.replace(/[.,!?;:"'()\[\]{}]/g, '');
        const words = cleaned.split(/\s+/);

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

    buildIterationsFromDialog: function(dialogLines, minWords) {
        const iterations = [];
        let usedLines = 0;
        const allPreviousWords = new Set();

        while (usedLines < dialogLines.length) {
            const iterationLines = [];
            const iterationWords = new Set();

            while (usedLines < dialogLines.length) {
                const line = dialogLines[usedLines];
                const lineWords = utils.extractWordsFromText(line.text);

                const newWords = lineWords.filter(function(w) {
                    return !allPreviousWords.has(w) && !iterationWords.has(w);
                });

                iterationLines.push(line);
                newWords.forEach(function(w) {
                    iterationWords.add(w);
                });
                usedLines++;

                if (iterationWords.size >= minWords) {
                    break;
                }
            }

            iterationWords.forEach(function(w) {
                allPreviousWords.add(w);
            });

            iterations.push({
                dialogLines: iterationLines,
                extractedWords: Array.from(iterationWords).sort()
            });
        }

        return {
            iterations: iterations,
            totalLines: dialogLines.length,
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

// V3 Generator - Dialog-first approach
const generator = {
    generateAlphabet: async function(targetLang, learnerLang) {
        console.log(`\nGenerating alphabet for ${targetLang}...`);

        const systemPrompt = `You are a language education expert.`;
        const userPrompt = `Generate the complete alphabet for ${targetLang}.
For each character, provide:
1. The character itself
2. Its name in ${targetLang}
3. The sound it makes (pronunciation guide in ${learnerLang})

Return ONLY valid JSON:
{
  "alphabet": [
    {"character": "а", "name": "а", "sound": "ah (like 'a' in father)"}
  ]
}`;

        const response = await ai.chat(systemPrompt, userPrompt);
        return utils.parseJSON(response).alphabet;
    },

    generate200DialogLines: async function(targetLang, learnerLang) {
        console.log(`\nGenerating 200 common conversational exchanges for ${targetLang}...`);

        const systemPrompt = `You are a ${targetLang} language expert.`;
        const userPrompt = `Create a long, natural conversation in ${targetLang} with 200 lines.

The conversation should:
1. Use the most common everyday phrases and expressions
2. Start with very basic greetings and simple exchanges
3. Progress to slightly more complex but still common conversations
4. Cover practical scenarios: greetings, introductions, asking questions, shopping, directions, etc.
5. Be a realistic back-and-forth dialog between 2-3 people

Each line should have:
- speaker: "Person A" or "Person B" or "Person C"
- text: the ${targetLang} text
- translation: ${learnerLang} translation

Return ONLY valid JSON:
{
  "dialog": [
    {"speaker": "Person A", "text": "Привіт", "translation": "Hello"},
    {"speaker": "Person B", "text": "Привіт! Як справи?", "translation": "Hello! How are you?"}
  ]
}

Generate ALL 200 lines covering the most common conversational phrases.`;

        const response = await ai.chat(systemPrompt, userPrompt);
        return utils.parseJSON(response).dialog;
    },

    translateVocabulary: async function(words, targetLang, learnerLang) {
        console.log(`  Translating ${words.length} vocabulary words...`);

        const systemPrompt = `You are a ${targetLang} language expert.`;
        const userPrompt = `Translate these ${targetLang} words to ${learnerLang}.
Provide the normative/dictionary form, translation, and part of speech.

Words: ${words.join(', ')}

Return ONLY valid JSON:
{
  "vocabulary": [
    {"word": "привіт", "translation": "hello", "partOfSpeech": "interjection"}
  ]
}`;

        const response = await ai.chat(systemPrompt, userPrompt);
        const vocab = utils.parseJSON(response).vocabulary;

        // Deduplicate vocabulary
        const seen = new Set();
        const deduplicated = [];
        vocab.forEach(function(v) {
            if (!seen.has(v.word.toLowerCase())) {
                seen.add(v.word.toLowerCase());
                deduplicated.push(v);
            }
        });

        return deduplicated;
    },

    generateGrammarFromDialog: async function(targetLang, learnerLang, dialogLines, vocabulary) {
        console.log(`  Generating grammar rules from dialog...`);

        const dialogText = dialogLines.map(d => `"${d.text}" (${d.translation})`).join(', ');
        const vocabList = vocabulary.map(v => v.word).join(', ');

        const systemPrompt = `You are a language education expert.`;
        const userPrompt = `Analyze these ${targetLang} dialog lines: ${dialogText}

Extract 5-8 grammar patterns found in these lines.

Return ONLY valid JSON:
{
  "grammarRules": [
    {
      "rule": "Basic greeting structure",
      "example": "Привіт",
      "translation": "Hello",
      "explanation": "Simple one-word greetings are common in Ukrainian."
    }
  ]
}`;

        const response = await ai.chat(systemPrompt, userPrompt);
        return utils.parseJSON(response).grammarRules;
    },

    generateLanguageDataset: async function(targetLang, learnerLang) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Generating V3 dataset for ${targetLang} (learner: ${learnerLang})`);
        console.log(`${'='.repeat(60)}`);

        const dataset = {
            language: targetLang,
            learnerLanguage: learnerLang,
            generationMethod: 'dialog-first-v3',
            alphabet: null,
            iterations: []
        };

        // Step 1: Generate alphabet
        dataset.alphabet = await generator.generateAlphabet(targetLang, learnerLang);
        await utils.sleep(1000);

        // Step 2: Generate 200 dialog lines upfront
        const allDialogLines = await generator.generate200DialogLines(targetLang, learnerLang);
        console.log(`  Generated ${allDialogLines.length} dialog lines`);
        await utils.sleep(1000);

        // Step 3: Build iterations from dialog lines
        console.log('\nBuilding iterations from dialog...');
        const iterationData = utils.buildIterationsFromDialog(allDialogLines, config.wordsPerIteration);
        console.log(`  Created ${iterationData.totalIterations} iterations from ${iterationData.totalLines} dialog lines`);

        // Step 4: For each iteration, translate vocabulary and generate grammar
        for (let i = 0; i < iterationData.iterations.length && i < config.iterationCount; i++) {
            const iterInfo = iterationData.iterations[i];
            const iterNum = i + 1;

            console.log(`\n=== Iteration ${iterNum}/${config.iterationCount} ===`);
            console.log(`  Dialog lines: ${iterInfo.dialogLines.length}, Words: ${iterInfo.extractedWords.length}`);

            // Translate vocabulary
            const vocabulary = await generator.translateVocabulary(
                iterInfo.extractedWords,
                targetLang,
                learnerLang
            );
            await utils.sleep(1000);

            // Generate grammar rules from the dialog
            const grammarRules = await generator.generateGrammarFromDialog(
                targetLang,
                learnerLang,
                iterInfo.dialogLines,
                vocabulary
            );
            await utils.sleep(1000);

            dataset.iterations.push({
                iteration: iterNum,
                vocabulary: vocabulary,
                grammar: grammarRules,
                dialog: iterInfo.dialogLines
            });
        }

        return dataset;
    }
};

// Main execution
const main = async function() {
    console.log('LinguaDrill V3 Dataset Generator');
    console.log('(Dialog-first with deterministic vocabulary extraction)');
    console.log('='.repeat(60) + '\n');

    if (!config.openaiApiKey || config.openaiApiKey === 'YOUR_OPENAI_API_KEY_HERE') {
        console.error('ERROR: Please set your OpenAI API key in config.json');
        process.exit(1);
    }

    utils.ensureDir(config.languagesDir);

    for (const targetLang of config.targetLanguages) {
        for (const learnerLang of config.learnerLanguages) {
            try {
                const dataset = await generator.generateLanguageDataset(targetLang, learnerLang);

                const filename = `${targetLang.toLowerCase().replace(/\s+/g, '-')}-${learnerLang.toLowerCase().replace(/\s+/g, '-')}-v3.json`;
                const filepath = path.join(config.languagesDir, filename);
                utils.saveJSON(filepath, dataset);

                console.log(`\n✓ Completed: ${targetLang} for ${learnerLang} learners (V3)`);
                await utils.sleep(2000);
            } catch (error) {
                console.error(`\n✗ Failed to generate ${targetLang} for ${learnerLang}:`, error.message);
            }
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('V3 dataset generation complete!');
    console.log('='.repeat(60));
};

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
