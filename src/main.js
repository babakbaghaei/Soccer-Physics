import { Game } from './Game.js';
import { audioManager } from './utils/AudioManager.js';

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

        // Music control
        const musicButton = document.getElementById('musicToggle');
        if (musicButton) {
            musicButton.addEventListener('click', () => {
                audioManager.toggleBackgroundMusic();
            });
        }
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