import { Game } from './src/game.js';

window.addEventListener('DOMContentLoaded', () => {
    const mainMenu = document.getElementById('mainMenu');
    const startGameBtn = document.getElementById('startGame');
    const exitGameBtn = document.getElementById('exitGame');
    const gameContainer = document.getElementById('game-container');
    const scoreBoard = document.getElementById('scoreBoard');
    const controlsInfo = document.getElementById('controlsInfo');

    let game = null;

    startGameBtn.addEventListener('click', () => {
        console.log("Start Game button clicked!");
        mainMenu.style.display = 'none';
        scoreBoard.style.display = 'flex';
        controlsInfo.style.display = 'block';
        gameContainer.style.display = 'block'; // Ensure container is visible before init

        try {
            game = new Game();
            game.init();
        } catch (error) {
            console.error("Failed to initialize game:", error);
            // Optionally, show an error message to the user
        }
    });

    exitGameBtn.addEventListener('click', () => {
        window.close();
    });
});
