import { Game } from './Game.js';

class GameApp {
    constructor() {
        this.game = null;
        this.init();
    }

    init() {
        // Create canvases
        const mainCanvas = document.getElementById('gameCanvas');
        const lowResCanvas = document.createElement('canvas');
        
        // Set up low-res canvas
        lowResCanvas.width = 800 * 0.25; // CANVAS_WIDTH * PIXELATION_SCALE_FACTOR
        lowResCanvas.height = 600 * 0.25; // CANVAS_HEIGHT * PIXELATION_SCALE_FACTOR
        
        // Create game instance
        this.game = new Game(mainCanvas, lowResCanvas);
        
        // Set up UI controls
        this.setupUIControls();
        
        // Start the game
        this.game.start();
        
        console.log('Game initialized successfully!');
    }

    setupUIControls() {
        // Weather controls
        const weatherButtons = document.querySelectorAll('[data-weather]');
        weatherButtons.forEach(button => {
            button.addEventListener('click', () => {
                const weather = button.dataset.weather;
                this.game.setWeather(weather);
                this.showMessage(`آب و هوا: ${this.getWeatherName(weather)}`);
            });
        });

        // Field type controls
        const fieldButtons = document.querySelectorAll('[data-field]');
        fieldButtons.forEach(button => {
            button.addEventListener('click', () => {
                const fieldType = button.dataset.field;
                this.game.setFieldType(fieldType);
                this.showMessage(`زمین: ${this.getFieldName(fieldType)}`);
            });
        });

        // Game controls
        const pauseButton = document.getElementById('pauseBtn');
        if (pauseButton) {
            pauseButton.addEventListener('click', () => {
                if (this.game.isRunning) {
                    this.game.pause();
                    pauseButton.textContent = 'ادامه';
                } else {
                    this.game.resume();
                    pauseButton.textContent = 'توقف';
                }
            });
        }

        const restartButton = document.getElementById('restartBtn');
        if (restartButton) {
            restartButton.addEventListener('click', () => {
                this.restartGame();
            });
        }
    }

    getWeatherName(weather) {
        const names = {
            clear: 'صاف',
            rain: 'باران',
            snow: 'برف',
            storm: 'طوفان'
        };
        return names[weather] || weather;
    }

    getFieldName(fieldType) {
        const names = {
            normal: 'معمولی',
            ice: 'یخ',
            sand: 'شن',
            moon: 'ماه'
        };
        return names[fieldType] || fieldType;
    }

    showMessage(message) {
        const messageDisplay = document.getElementById('gameMessage');
        if (messageDisplay) {
            messageDisplay.textContent = message;
            messageDisplay.classList.add('has-text');
            setTimeout(() => {
                messageDisplay.textContent = '';
                messageDisplay.classList.remove('has-text');
            }, 2000);
        }
    }

    restartGame() {
        if (this.game) {
            this.game.destroy();
        }
        
        const mainCanvas = document.getElementById('gameCanvas');
        const lowResCanvas = document.createElement('canvas');
        lowResCanvas.width = 800 * 0.25;
        lowResCanvas.height = 600 * 0.25;
        
        this.game = new Game(mainCanvas, lowResCanvas);
        this.setupUIControls();
        this.game.start();
        
        this.showMessage('بازی مجدداً شروع شد!');
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GameApp();
});

// Handle window resize
window.addEventListener('resize', () => {
    // Handle responsive design if needed
});

// Handle page visibility change (pause when tab is not active)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Optionally pause the game when tab is not active
        // if (window.gameApp && window.gameApp.game) {
        //     window.gameApp.game.pause();
        // }
    }
});