// Audio playback module
const audio = {
    currentAudio: null,

    play: function(audioUrl) {
        // Stop any currently playing audio
        if (audio.currentAudio) {
            audio.currentAudio.pause();
            audio.currentAudio = null;
        }

        if (!audioUrl) {
            console.warn('No audio URL provided');
            return null;
        }

        // Create and play new audio
        const audioElement = new Audio(audioUrl);
        audio.currentAudio = audioElement;

        audioElement.play().catch(function(error) {
            console.error('Audio playback error:', error);
        });

        return audioElement;
    },

    createButton: function(audioUrl) {
        const button = document.createElement('button');
        button.className = 'audio-btn';
        button.innerHTML = '🔊';
        button.title = 'Play audio';

        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const audioElement = audio.play(audioUrl);

            if (audioElement) {
                button.classList.add('playing');

                audioElement.addEventListener('ended', function() {
                    button.classList.remove('playing');
                });

                audioElement.addEventListener('error', function() {
                    button.classList.remove('playing');
                });
            }
        });

        return button;
    },

    addToElement: function(element, audioUrl) {
        if (!audioUrl) return;

        const button = audio.createButton(audioUrl);
        element.appendChild(button);
    }
};
