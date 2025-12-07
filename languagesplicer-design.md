# LanguageSplicer Design

The purpose of LanguageSplicer is for the user to learn a foreign language to minimal fluency as efficiently as possible.
I consider this to be having solidly learned and internalized the most common 200 words and how to use them together, grammatically.
That is, to be able to recall, retain, and effectively use them.

The approach is to flash the user with vocabulary, grammar rules, and dialolg through an iterative process where 10 new words at added, per iteration.

## Language Preparation

A backend utility should exist to build the data set for each chosen language.

Each language data set should have 20 sets of the following:
- Alphabet
  Each character, the sound it makes, and what it's called.
- vocabulary
  words (normative form for languages with case)
  Each iteration includes the vocabulary of the previous iteration but adds the next 10 most common.
- grammars
  phrases and sentences to illustrate all possible grammars with the vocubulary of the iteration.
  All the vocabulary of the iteration and no other vocabulary must be used.
  For each grammar, there should be an example phrase or sentence plus an explanation.
- dialog
  A dialog is generated utilizing all the vocubulary and grammars.

Each language data set should be generated as a JSON file in the ~/languages folder, named after the language it is.
The answers should be generated for the user's languages.
This list of languages should be in the learner-languages.txt file (one per line).
  
## Learning

The user has a tab for each of:
- Vocabulary
- Grammar
- Dialog

The user may freely switch to which ever tab the user wants to train it, at any time.
However, the user must complete one iteration to move onto the next.

### Vocabulary

The user is flashed with each vocabulary word of the iteration.
The words are shown in random order.
Once a word was got correct 3 times in a row (for that word), it is considered mastered.
The exception to this is that any word mastered in a previous iteration only need be got correct once to be mastered in future iterations--unless the user gets it wrong, in which case it must be gotten correct 3 times like the others.
The vocabulary section is considered complete when all words are mastered.


### Grammar

The grammar tab works the same as the vocabulary except all must be gotten correct 3 times no matter what.

### Dialog

The dialog works the same as the grammar tab.

## Onboarding

A new learning should be allowed to setup a new account, providing email, password, native language, and first language the user wants to learn.
Thereafter, the user should come to the home screen.
A hamburger menu should be available to slide in a dialog where the user may change password or select a different language to learn.

## Learning

For each language, the user is first drilled with the letters of the alphabet for that language.
Once each letter is gotten correct 3 times, it is considered mastered.
When all letters are mastered, the alphabet is considered mastered.

Once the alphabet is mastered, the user is shown the three tabs.
The user may select any (but it should start at vocabulary else whereever the user left off, by default).

Generally speaking, each thing a user is being drilled on should have a random set of multiple choice options to choose from.

## Technical

The frontend should be a responsive PWA build using vanilla HTML/CCS/JS.
The backend should be in Node.js.
No database--everything kept in files on the server.
The user's progress should be kept in their own localstore (client-side).

- No typescript
- No using Javascript classes.  Instead use the following pattern:
```javascript
myobj = {
    attrib1:"", attrib2:""
}
myobj.method1 = function( p1, p2 ) {
    // code here
}
myobj.method2 = function( p1, p2 ) {
    // code here
}
```




