class AudioManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {}; // To store sound generation functions or buffers

        // Attempt to initialize AudioContext on user interaction in game.js
        // For now, we'll assume it will be initialized externally.

        // Define procedural sounds
        this.defineSounds();
    }

    // Call this method once a user interaction has occurred
    initAudioContext() {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log("AudioContext initialized.");
            } catch (e) {
                console.error("Web Audio API is not supported in this browser.", e);
            }
        }
    }

    defineSounds() {
        // --- Jump Sound ---
        // A simple rising tone
        this.sounds['jump'] = () => {
            if (!this.audioContext) return;
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.type = 'square'; // Retro sound
            oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4
            oscillator.frequency.linearRampToValueAtTime(880, this.audioContext.currentTime + 0.1); // Up to A5

            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime); // Start with some volume
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15); // Fade out quickly

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.15);
        };

        // --- Kick/Hit Sound ---
        // A short, sharp noise
        this.sounds['kick'] = () => {
            if (!this.audioContext) return;
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime); // Lower pitch
            gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.1);
        };

        // --- Bounce Sound ---
        // A quick blip
        this.sounds['bounce'] = () => {
            if (!this.audioContext) return;
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.08);

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.08);
        };

        // --- Goal Sound ---
        // A simple ascending arpeggio or a cheerful sequence
        this.sounds['goal'] = () => {
            if (!this.audioContext) return;
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            let startTime = this.audioContext.currentTime;

            notes.forEach((noteFrequency, index) => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(noteFrequency, startTime + index * 0.1);
                gainNode.gain.setValueAtTime(0.3, startTime + index * 0.1);
                gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + index * 0.1 + 0.15);

                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                oscillator.start(startTime + index * 0.1);
                oscillator.stop(startTime + index * 0.1 + 0.15);
            });
        };

        // --- Power-up Sound ---
        // A magical/pickup sound
        this.sounds['powerup'] = () => {
            if (!this.audioContext) return;
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(660, this.audioContext.currentTime); // E5
            oscillator.frequency.linearRampToValueAtTime(1320, this.audioContext.currentTime + 0.2); // E6

            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.3);
        };
    }

    playSound(soundName) {
        if (!this.audioContext) {
            // console.warn("AudioContext not initialized. Cannot play sound.");
            // Try to initialize it now, assuming user interaction might have just happened
            this.initAudioContext();
            if (!this.audioContext) { // Still not initialized
                console.warn("AudioContext failed to initialize. Sound not played:", soundName);
                return;
            }
        }
        if (this.sounds[soundName]) {
            this.sounds[soundName]();
        } else {
            console.warn(`Sound "${soundName}" not found.`);
        }
    }
}

// Export a single instance of the AudioManager
const audioManager = new AudioManager();
window.audioManager = audioManager; // Make it available globally
export default audioManager;
