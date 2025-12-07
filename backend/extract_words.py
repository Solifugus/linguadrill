#!/usr/bin/env python3
"""
Word extraction utility for LanguageSplicer
Extracts individual words from phrases using language-specific tokenization
"""

import json
import sys
import re

def extract_words_from_phrase(phrase, language):
    """
    Extract individual words from a phrase.
    Returns a list of unique words in the order they appear.
    """
    # Remove punctuation
    cleaned = re.sub(r'[.,!?;:\"\'()\[\]{}]', '', phrase)

    # Split on whitespace
    words = cleaned.split()

    # Return unique words while preserving order
    seen = set()
    unique_words = []
    for word in words:
        word_lower = word.lower()
        if word_lower and word_lower not in seen:
            seen.add(word_lower)
            unique_words.append(word_lower)

    return unique_words

def build_iterations(phrases, min_words_per_iteration=10):
    """
    Build iterations by grouping phrases until we have at least min_words_per_iteration unique words.

    Args:
        phrases: List of phrase objects with 'phrase' and 'translation' fields
        min_words_per_iteration: Minimum unique words to extract per iteration

    Returns:
        List of iteration objects with phrases and extracted vocabulary
    """
    iterations = []
    used_phrases = 0
    all_previous_words = set()

    while used_phrases < len(phrases):
        iteration_phrases = []
        iteration_words = set()

        # Add phrases until we have enough unique NEW words
        while used_phrases < len(phrases):
            phrase_obj = phrases[used_phrases]
            phrase_text = phrase_obj['phrase']

            # Extract words from this phrase
            phrase_words = extract_words_from_phrase(phrase_text, phrase_obj.get('language', 'unknown'))

            # Count how many NEW words this phrase contributes
            new_words = [w for w in phrase_words if w not in all_previous_words and w not in iteration_words]

            iteration_phrases.append(phrase_obj)
            iteration_words.update(new_words)
            used_phrases += 1

            # Stop when we have enough words for this iteration
            if len(iteration_words) >= min_words_per_iteration:
                break

        # Update global word set
        all_previous_words.update(iteration_words)

        iterations.append({
            'phrases': iteration_phrases,
            'extractedWords': sorted(list(iteration_words))
        })

    return iterations

def main():
    """
    Read phrases from stdin, build iterations, output to stdout
    Expected input format: JSON array of phrase objects
    """
    if len(sys.argv) > 1:
        min_words = int(sys.argv[1])
    else:
        min_words = 10

    # Read input from stdin
    input_data = json.loads(sys.stdin.read())
    phrases = input_data['phrases']

    # Build iterations
    iterations = build_iterations(phrases, min_words)

    # Output as JSON
    result = {
        'iterations': iterations,
        'totalPhrases': len(phrases),
        'totalIterations': len(iterations)
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
