class AudioManager {
    constructor() {
        this.audioContext = null;
        this.sounds = new Map();
        this.isInitialized = false;
        this.backgroundMusic = null;
        this.isMusicPlaying = false;
        this.musicGain = null;
    }

    async initAudioContext() {
        if (this.isInitialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await this.audioContext.resume();
            this.isInitialized = true;
            console.log('Audio context initialized');
        } catch (error) {
            console.warn('Audio context initialization failed:', error);
        }
    }

    createRetroBackgroundMusic() {
        if (!this.audioContext) return;

        // Create gain node for music volume control
        this.musicGain = this.audioContext.createGain();
        this.musicGain.gain.setValueAtTime(0.2, this.audioContext.currentTime); // Lower volume
        this.musicGain.connect(this.audioContext.destination);

        // Create retro-style background music using oscillators
        const createRetroMelody = () => {
            // Retro game music melody (8-bit style)
            const melody = [
                // Main theme
                { note: 262, duration: 0.3 }, // C4
                { note: 330, duration: 0.3 }, // E4
                { note: 392, duration: 0.3 }, // G4
                { note: 523, duration: 0.6 }, // C5
                { note: 392, duration: 0.3 }, // G4
                { note: 330, duration: 0.3 }, // E4
                { note: 262, duration: 0.6 }, // C4
                { note: 0, duration: 0.3 },   // Rest
                
                // Variation
                { note: 349, duration: 0.3 }, // F4
                { note: 440, duration: 0.3 }, // A4
                { note: 523, duration: 0.3 }, // C5
                { note: 659, duration: 0.6 }, // E5
                { note: 523, duration: 0.3 }, // C5
                { note: 440, duration: 0.3 }, // A4
                { note: 349, duration: 0.6 }, // F4
                { note: 0, duration: 0.3 },   // Rest
                
                // Bass line
                { note: 131, duration: 0.3 }, // C3
                { note: 165, duration: 0.3 }, // E3
                { note: 196, duration: 0.3 }, // G3
                { note: 262, duration: 0.6 }, // C4
                { note: 196, duration: 0.3 }, // G3
                { note: 165, duration: 0.3 }, // E3
                { note: 131, duration: 0.6 }, // C3
                { note: 0, duration: 0.3 }    // Rest
            ];

            let currentTime = this.audioContext.currentTime;
            
            melody.forEach(({ note, duration }, index) => {
                if (note > 0) {
                    const oscillator = this.audioContext.createOscillator();
                    const gainNode = this.audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(this.musicGain);
                    
                    oscillator.frequency.setValueAtTime(note, currentTime);
                    
                    // Use different waveforms for variety
                    if (index < 8) {
                        oscillator.type = 'triangle'; // Main melody
                    } else if (index < 16) {
                        oscillator.type = 'square';   // Variation
                    } else {
                        oscillator.type = 'sawtooth'; // Bass
                    }
                    
                    // Different volume levels for different parts
                    let volume = 0.08;
                    if (index >= 16) volume = 0.05; // Bass quieter
                    
                    gainNode.gain.setValueAtTime(volume, currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);
                    
                    oscillator.start(currentTime);
                    oscillator.stop(currentTime + duration);
                }
                currentTime += duration;
            });

            // Schedule next melody
            setTimeout(() => {
                if (this.isMusicPlaying) {
                    createRetroMelody();
                }
            }, (currentTime - this.audioContext.currentTime) * 1000);
        };

        createRetroMelody();
    }

    toggleBackgroundMusic() {
        if (!this.isInitialized) {
            this.initAudioContext().then(() => this.toggleBackgroundMusic());
            return;
        }

        if (this.isMusicPlaying) {
            this.stopBackgroundMusic();
        } else {
            this.startBackgroundMusic();
        }
    }

    startBackgroundMusic() {
        if (!this.isInitialized) return;
        
        this.isMusicPlaying = true;
        this.createRetroBackgroundMusic();
        
        // Update button text
        const musicButton = document.getElementById('musicToggle');
        if (musicButton) {
            musicButton.textContent = '🔊 موسیقی';
        }
    }

    stopBackgroundMusic() {
        this.isMusicPlaying = false;
        
        // Update button text
        const musicButton = document.getElementById('musicToggle');
        if (musicButton) {
            musicButton.textContent = '🔇 موسیقی';
        }
    }

    setMusicVolume(volume) {
        if (this.musicGain) {
            this.musicGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
        }
    }

    createSound(frequency, duration, type = 'sine') {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    playSound(soundType) {
        if (!this.isInitialized) return;

        const sounds = {
            kick: () => this.createSound(200, 0.1, 'square'),
            bounce: () => this.createSound(150, 0.05, 'sine'),
            goal: () => {
                this.createSound(400, 0.2, 'sine');
                setTimeout(() => this.createSound(600, 0.2, 'sine'), 200);
                setTimeout(() => this.createSound(800, 0.3, 'sine'), 400);
            },
            post: () => this.createSound(300, 0.15, 'triangle'),
            jump: () => this.createSound(250, 0.1, 'sawtooth'),
            powerup: () => {
                this.createSound(500, 0.1, 'sine');
                setTimeout(() => this.createSound(700, 0.1, 'sine'), 100);
            }
        };

        const sound = sounds[soundType];
        if (sound) {
            sound();
        }
    }
}

export const audioManager = new AudioManager();