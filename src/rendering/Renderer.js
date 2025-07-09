import { 
    CANVAS_WIDTH, CANVAS_HEIGHT, PIXELATION_SCALE_FACTOR, 
    COLORS, GROUND_Y, GROUND_THICKNESS, GOAL_HEIGHT, GOAL_WIDTH 
} from '../config/constants.js';

export class Renderer {
    constructor(mainCanvas, lowResCanvas) {
        this.mainCanvas = mainCanvas;
        this.mainCtx = mainCanvas.getContext('2d');
        this.lowResCanvas = lowResCanvas;
        this.lowResCtx = lowResCanvas.getContext('2d');
        
        this.sunPosition = { x: 100, y: 100 };
        this.cloudPositions = [
            { x: 150, y: 120, width: 80, height: 30, speed: 0.3 },
            { x: 400, y: 80, width: 100, height: 40, speed: 0.2 },
            { x: 650, y: 150, width: 70, height: 25, speed: 0.4 }
        ];
    }

    render(gameState, field, ball, players, powerUpManager, particleSystem) {
        this.updateShake(gameState);
        this.clearCanvas();
        this.drawBackground();
        this.drawSky();
        field.drawGrass(this.lowResCtx, PIXELATION_SCALE_FACTOR);
        field.drawNets(this.lowResCtx, PIXELATION_SCALE_FACTOR);
        this.drawBodies(gameState, ball, players, powerUpManager);
        this.drawParticles(particleSystem);
        this.drawUI(gameState);
        this.drawToMainCanvas();
    }

    updateShake(gameState) {
        gameState.updateShake();
    }

    clearCanvas() {
        this.lowResCtx.clearRect(0, 0, this.lowResCanvas.width, this.lowResCanvas.height);
    }

    drawBackground() {
        this.lowResCtx.fillStyle = COLORS.SKY_BLUE;
        this.lowResCtx.fillRect(0, 0, this.lowResCanvas.width, this.lowResCanvas.height);
    }

    drawSky() {
        this.drawSun();
        this.drawClouds();
    }

    drawSun() {
        const sunX = this.sunPosition.x * PIXELATION_SCALE_FACTOR;
        const sunY = this.sunPosition.y * PIXELATION_SCALE_FACTOR;
        const sunRadius = 25 * PIXELATION_SCALE_FACTOR;

        this.lowResCtx.fillStyle = '#FFD700';
        this.lowResCtx.beginPath();
        this.lowResCtx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        this.lowResCtx.fill();
    }

    drawClouds() {
        this.cloudPositions.forEach(cloud => {
            cloud.x += cloud.speed;
            if (cloud.x > CANVAS_WIDTH + cloud.width) {
                cloud.x = -cloud.width;
                cloud.y = 50 + Math.random() * 100;
            }

            this.drawCloud(
                cloud.x * PIXELATION_SCALE_FACTOR,
                cloud.y * PIXELATION_SCALE_FACTOR,
                cloud.width * PIXELATION_SCALE_FACTOR,
                cloud.height * PIXELATION_SCALE_FACTOR
            );
        });
    }

    drawCloud(x, y, width, height) {
        this.lowResCtx.fillStyle = COLORS.WHITE;
        const baseCircleRadius = height * 0.6;

        // Cloud 1
        this.lowResCtx.beginPath();
        this.lowResCtx.arc(x + width * 0.25, y + height * 0.5, baseCircleRadius * 0.8, 0, Math.PI * 2);
        this.lowResCtx.fill();

        // Cloud 2
        this.lowResCtx.beginPath();
        this.lowResCtx.arc(x + width * 0.5, y + height * 0.4, baseCircleRadius, 0, Math.PI * 2);
        this.lowResCtx.fill();

        // Cloud 3
        this.lowResCtx.beginPath();
        this.lowResCtx.arc(x + width * 0.75, y + height * 0.55, baseCircleRadius * 0.9, 0, Math.PI * 2);
        this.lowResCtx.fill();
    }

    drawBodies(gameState, ball, players, powerUpManager) {
        this.lowResCtx.save();
        this.lowResCtx.translate(gameState.shakeOffsetX, gameState.shakeOffsetY);

        // Draw players
        players.forEach(player => this.drawPlayer(player));

        // Draw ball
        this.drawBall(ball);

        // Draw power-ups
        powerUpManager.getPowerUps().forEach(powerUp => this.drawPowerUp(powerUp));

        // Draw static bodies (walls, ground, goal posts)
        this.drawStaticBodies();

        this.lowResCtx.restore();
    }

    drawPlayer(player) {
        const pos = player.getPosition();
        const x = pos.x * PIXELATION_SCALE_FACTOR;
        const y = pos.y * PIXELATION_SCALE_FACTOR;
        const width = 40 * PIXELATION_SCALE_FACTOR;
        const height = 40 * PIXELATION_SCALE_FACTOR;

        // Draw player body
        this.lowResCtx.fillStyle = player.color;
        this.lowResCtx.fillRect(x - width/2, y - height/2, width, height);

        // Draw shield effect
        if (player.hasShield) {
            this.lowResCtx.strokeStyle = '#00CED1';
            this.lowResCtx.lineWidth = Math.max(2, Math.floor(3 * PIXELATION_SCALE_FACTOR));
            this.lowResCtx.strokeRect(x - width/2, y - height/2, width, height);
        }

        // Draw magnet effect
        if (player.hasMagnet) {
            this.lowResCtx.fillStyle = '#FF69B4';
            this.lowResCtx.globalAlpha = 0.3;
            this.lowResCtx.beginPath();
            this.lowResCtx.arc(x, y, 25 * PIXELATION_SCALE_FACTOR, 0, Math.PI * 2);
            this.lowResCtx.fill();
            this.lowResCtx.globalAlpha = 1;
        }
    }

    drawBall(ball) {
        const pos = ball.getPosition();
        const x = pos.x * PIXELATION_SCALE_FACTOR;
        const y = pos.y * PIXELATION_SCALE_FACTOR;
        const radius = 15 * PIXELATION_SCALE_FACTOR;

        // Draw ball body
        this.lowResCtx.fillStyle = COLORS.WHITE;
        this.lowResCtx.beginPath();
        this.lowResCtx.arc(x, y, radius, 0, Math.PI * 2);
        this.lowResCtx.fill();

        // Draw ball pattern
        this.lowResCtx.fillStyle = COLORS.BLACK;
        this.lowResCtx.beginPath();
        const angle = ball.body.angle;
        this.lowResCtx.moveTo(x, y);
        this.lowResCtx.arc(x, y, radius, angle, angle + Math.PI / 3);
        this.lowResCtx.closePath();
        this.lowResCtx.fill();

        // Draw ball outline
        this.lowResCtx.strokeStyle = COLORS.BLACK;
        this.lowResCtx.lineWidth = Math.max(1, Math.floor(1 * PIXELATION_SCALE_FACTOR));
        this.lowResCtx.beginPath();
        this.lowResCtx.arc(x, y, radius, 0, Math.PI * 2);
        this.lowResCtx.stroke();
    }

    drawPowerUp(powerUp) {
        const pos = powerUp.body.position;
        const x = pos.x * PIXELATION_SCALE_FACTOR;
        const y = pos.y * PIXELATION_SCALE_FACTOR;
        const radius = 15 * PIXELATION_SCALE_FACTOR;

        // Draw power-up body
        this.lowResCtx.fillStyle = powerUp.type.color;
        this.lowResCtx.beginPath();
        this.lowResCtx.arc(x, y, radius, 0, Math.PI * 2);
        this.lowResCtx.fill();

        // Draw power-up symbol
        this.lowResCtx.fillStyle = COLORS.WHITE;
        this.lowResCtx.font = `${Math.max(8, Math.floor(12 * PIXELATION_SCALE_FACTOR))}px Arial`;
        this.lowResCtx.textAlign = 'center';
        
        const symbol = this.getPowerUpSymbol(powerUp.type.type);
        this.lowResCtx.fillText(symbol, x, y + 3 * PIXELATION_SCALE_FACTOR);
    }

    getPowerUpSymbol(type) {
        const symbols = {
            speed: '⚡',
            strength: '💪',
            shield: '🛡️',
            magnet: '🧲'
        };
        return symbols[type] || '?';
    }

    drawStaticBodies() {
        // This would draw walls, ground, goal posts
        // Implementation depends on how static bodies are stored
    }

    drawParticles(particleSystem) {
        particleSystem.updateParticles();
        particleSystem.drawParticles(this.lowResCtx, PIXELATION_SCALE_FACTOR);
    }

    drawUI(gameState) {
        // Draw score
        this.lowResCtx.fillStyle = COLORS.WHITE;
        this.lowResCtx.font = `${Math.max(16, Math.floor(24 * PIXELATION_SCALE_FACTOR))}px Arial`;
        this.lowResCtx.textAlign = 'center';
        this.lowResCtx.fillText(`${gameState.team1Score} - ${gameState.team2Score}`, 
            this.lowResCtx.canvas.width / 2, 30);

        // Draw time
        const minutes = Math.floor(gameState.gameTimeRemaining / 60);
        const seconds = gameState.gameTimeRemaining % 60;
        this.lowResCtx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, 
            this.lowResCtx.canvas.width / 2, 60);

        // Draw chip message
        if (gameState.chipMessageTimer > 0) {
            this.lowResCtx.save();
            this.lowResCtx.font = `${Math.max(32, Math.floor(48 * PIXELATION_SCALE_FACTOR))}px Arial`;
            this.lowResCtx.fillStyle = `rgba(255,255,0,${Math.min(1, gameState.chipMessageTimer / 20)})`;
            this.lowResCtx.strokeStyle = COLORS.BLACK;
            this.lowResCtx.lineWidth = Math.max(3, Math.floor(4 * PIXELATION_SCALE_FACTOR));
            this.lowResCtx.strokeText('چیپ!', this.lowResCtx.canvas.width / 2, this.lowResCtx.canvas.height / 2);
            this.lowResCtx.fillText('چیپ!', this.lowResCtx.canvas.width / 2, this.lowResCtx.canvas.height / 2);
            this.lowResCtx.restore();
            gameState.chipMessageTimer--;
        }
    }

    drawToMainCanvas() {
        this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        this.mainCtx.imageSmoothingEnabled = false;
        this.mainCtx.mozImageSmoothingEnabled = false;
        this.mainCtx.webkitImageSmoothingEnabled = false;
        this.mainCtx.msImageSmoothingEnabled = false;

        this.mainCtx.drawImage(
            this.lowResCanvas,
            0, 0, this.lowResCanvas.width, this.lowResCanvas.height,
            0, 0, this.mainCanvas.width, this.mainCanvas.height
        );
    }
}