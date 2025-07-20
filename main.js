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
        mainMenu.style.display = 'none';
        scoreBoard.style.display = 'flex';
        controlsInfo.style.display = 'block';
        gameContainer.style.display = 'block';

        game = new Game();
        game.init();
    });

    exitGameBtn.addEventListener('click', () => {
        window.close();
    });
});
