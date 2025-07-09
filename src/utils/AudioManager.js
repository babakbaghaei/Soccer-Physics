class AudioManager {
    constructor() {
        this.audioContext = null;
        this.sounds = new Map();
        this.isInitialized = false;
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