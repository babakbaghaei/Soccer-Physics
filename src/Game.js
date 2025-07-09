import { Engine, World, Bodies, Body, Events } from 'matter-js';
import { 
    CANVAS_WIDTH, CANVAS_HEIGHT, PIXELATION_SCALE_FACTOR, 
    ROUND_DURATION_SECONDS, FIELD_TYPES, WEATHER_EFFECTS 
} from './config/constants.js';
import { GameState } from './game/GameState.js';
import { Player } from './game/Player.js';
import { Ball } from './game/Ball.js';
import { Field } from './game/Field.js';
import { PowerUpManager } from './game/PowerUpManager.js';
import { AIPlayer } from './ai/AIPlayer.js';
import { Renderer } from './rendering/Renderer.js';
import { ParticleSystem } from './utils/ParticleSystem.js';
import { audioManager } from './utils/AudioManager.js';

export class Game {
    constructor(mainCanvas, lowResCanvas) {
        this.mainCanvas = mainCanvas;
        this.lowResCanvas = lowResCanvas;
        
        // Initialize game components
        this.gameState = new GameState();
        this.particleSystem = new ParticleSystem();
        this.renderer = new Renderer(mainCanvas, lowResCanvas);
        
        // Initialize Matter.js
        this.engine = Engine.create();
        this.world = this.engine.world;
        this.runner = null;
        
        // Initialize game objects
        this.field = new Field(this.world);
        this.ball = new Ball(CANVAS_WIDTH / 2, 100, this.world);
        this.players = [
            new Player(200, 450, 1, this.world),
            new Player(CANVAS_WIDTH - 200, 450, 2, this.world)
        ];
        this.powerUpManager = new PowerUpManager(this.world);
        this.aiPlayer = new AIPlayer(this.players[1], this.ball, this.players[0], this.field);
        
        // Input handling
        this.keysPressed = {};
        this.setupInputHandling();
        
        // Collision detection
        this.setupCollisions();
        
        // Game loop
        this.isRunning = false;
    }

    setupInputHandling() {
        window.addEventListener('keydown', (e) => {
            this.keysPressed[e.key.toLowerCase()] = true;
            audioManager.initAudioContext();
        });
        
        window.addEventListener('keyup', (e) => {
            this.keysPressed[e.key.toLowerCase()] = false;
        });
    }

    setupCollisions() {
        Events.on(this.engine, 'collisionStart', (event) => {
            const pairs = event.pairs;
            
            for (let i = 0; i < pairs.length; i++) {
                const pair = pairs[i];
                const bodyA = pair.bodyA;
                const bodyB = pair.bodyB;

                this.handleCollision(bodyA, bodyB);
            }
        });
    }

    handleCollision(bodyA, bodyB) {
        // Player-ball collision
        if ((bodyA.label === 'ball' && (bodyB.label === 'player1' || bodyB.label === 'player2')) ||
            (bodyB.label === 'ball' && (bodyA.label === 'player1' || bodyA.label === 'player2'))) {
            
            const ball = bodyA.label === 'ball' ? bodyA : bodyB;
            const playerBody = bodyA.label === 'ball' ? bodyB : bodyA;
            const player = this.players.find(p => p.body === playerBody);
            
            if (player && ball) {
                this.handlePlayerBallCollision(player, ball);
            }
        }

        // Ball-ground collision
        if ((bodyA.label === 'ball' && bodyB.label === 'ground') ||
            (bodyB.label === 'ball' && bodyA.label === 'ground')) {
            
            const ballBody = bodyA.label === 'ball' ? bodyA : bodyB;
            this.particleSystem.createImpactParticles(ballBody.position.x, ballBody.position.y + 15);
            audioManager.playSound('bounce');
        }

        // Ball-wall collision
        if (bodyA.label === 'ball' && bodyB.isStatic && bodyB.label !== 'ground') {
            audioManager.playSound('bounce');
        } else if (bodyB.label === 'ball' && bodyA.isStatic && bodyA.label !== 'ground') {
            audioManager.playSound('bounce');
        }

        // Ball-goal post collision
        if ((bodyA.label === 'ball' && (bodyB.label === 'goalPost1' || bodyB.label === 'goalPost2')) ||
            (bodyB.label === 'ball' && (bodyA.label === 'goalPost1' || bodyA.label === 'goalPost2'))) {
            
            this.gameState.triggerScreenShake(5, 15, PIXELATION_SCALE_FACTOR);
            audioManager.playSound('post');
        }

        // Player-player collision
        if ((bodyA.label === 'player1' && bodyB.label === 'player2') ||
            (bodyA.label === 'player2' && bodyB.label === 'player1')) {
            
            const player1 = this.players.find(p => p.body === bodyA);
            const player2 = this.players.find(p => p.body === bodyB);
            
            if (player1 && player2) {
                this.handlePlayerCollision(player1, player2);
            }
        }
    }

    handlePlayerBallCollision(player, ballBody) {
        // Update possession
        this.gameState.updatePossession(player.team);
        
        // Check for special moves
        const isJump = player.getVelocity().y < -0.5;
        const isHeader = ballBody.position.y < player.getPosition().y - 20;
        const isChip = this.checkChipConditions(player, ballBody);
        
        if (isChip) {
            this.executeChipShot(player);
        } else if (isHeader) {
            this.ball.hit(player, 'header');
        } else if (player.shootPower > 1) {
            this.ball.hit(player, 'strong');
        } else {
            this.ball.hit(player, 'normal');
        }
        
        // Play sound
        audioManager.playSound('kick');
        
        // Increment stats
        this.gameState.incrementStat(player.team, 'shots');
    }

    checkChipConditions(player, ballBody) {
        const isBallOnGround = Math.abs(ballBody.position.y + 15 - 580) < 25; // GROUND_Y
        const isPlayerFalling = player.getVelocity().y < -0.2;
        return isBallOnGround && isPlayerFalling && player.hasJumped;
    }

    executeChipShot(player) {
        const direction = player.team === 1 ? -1 : 1;
        Body.setVelocity(this.ball.body, { x: direction * 10, y: -16 });
        Body.setAngularVelocity(this.ball.body, direction * 0.5);
        this.gameState.chipMessageTimer = 40;
        this.ball.hit(player, 'chip');
    }

    handlePlayerCollision(player1, player2) {
        if (player1.hasShield) {
            const forceX = player1.team === 1 ? 15 : -15;
            Body.setVelocity(player2.body, { x: forceX, y: -10 });
            this.particleSystem.createImpactParticles(player2.getPosition().x, player2.getPosition().y, 5, '#00CED1');
        } else if (player2.hasShield) {
            const forceX = player2.team === 1 ? 15 : -15;
            Body.setVelocity(player1.body, { x: forceX, y: -10 });
            this.particleSystem.createImpactParticles(player1.getPosition().x, player1.getPosition().y, 5, '#00CED1');
        }
    }

    handlePlayerInput() {
        const player = this.players[0]; // Human player
        
        // Movement
        if (this.keysPressed['a'] || this.keysPressed['arrowleft']) {
            player.move(-1, !player.isGrounded);
        }
        if (this.keysPressed['d'] || this.keysPressed['arrowright']) {
            player.move(1, !player.isGrounded);
        }
        
        // Jump
        if (this.keysPressed['w'] || this.keysPressed['arrowup'] || this.keysPressed[' ']) {
            player.jump();
            if (player.isGrounded) {
                this.gameState.incrementStat(player.team, 'jumps');
                audioManager.playSound('jump');
            }
        }
        
        // Special shot
        if (this.keysPressed['s']) {
            if (Math.abs(player.getPosition().x - this.ball.getPosition().x) < 50) {
                Body.setVelocity(this.ball.body, { x: 0, y: -10 });
                Body.setAngularVelocity(this.ball.body, 0);
            }
        }
    }

    update() {
        if (!this.isRunning) return;

        // Update game state
        this.gameState.gameTimeRemaining = Math.max(0, this.gameState.gameTimeRemaining - 1/60);
        
        if (this.gameState.gameTimeRemaining <= 0) {
            this.endGame();
            return;
        }

        // Update game objects
        this.players.forEach(player => player.update());
        this.ball.update();
        this.powerUpManager.update();
        this.aiPlayer.update();

        // Handle input
        this.handlePlayerInput();

        // Check power-up collisions
        this.players.forEach(player => {
            const powerUp = this.powerUpManager.checkCollision(player);
            if (powerUp) {
                audioManager.playSound('powerup');
            }
        });

        // Apply magnet effects
        this.players.forEach(player => {
            if (player.hasMagnet) {
                player.applyMagnetForce(this.ball);
            }
        });

        // Check for goals
        const scoringTeam = this.field.checkGoal(this.ball);
        if (scoringTeam && !this.gameState.isGoalScored()) {
            this.handleGoal(scoringTeam);
        }

        // Apply weather effects
        this.applyWeatherEffects();

        // Update physics
        Engine.update(this.engine, 1000 / 60);
    }

    handleGoal(scoringTeam) {
        this.gameState.setGoalScored(scoringTeam);
        this.gameState.triggerScreenShake(10, 30, PIXELATION_SCALE_FACTOR);
        audioManager.playSound('goal');
        
        // Reset positions after a short delay
        setTimeout(() => {
            this.resetPositions();
        }, 2000);
    }

    resetPositions() {
        this.ball.reset();
        this.players[0].setPosition(200, 450);
        this.players[1].setPosition(CANVAS_WIDTH - 200, 450);
    }

    applyWeatherEffects() {
        const weather = WEATHER_EFFECTS[this.gameState.currentWeather];
        this.ball.applyWindForce(weather.windForce);
        this.ball.applyRandomForce();
        
        // Create weather particles
        if (Math.random() < weather.particles / 1000) {
            this.particleSystem.createWeatherParticle(weather, CANVAS_WIDTH);
        }
    }

    setWeather(weather) {
        this.gameState.currentWeather = weather;
        const effect = WEATHER_EFFECTS[weather];
        
        // Apply weather effects to physics
        this.ball.body.friction *= effect.friction;
        this.ball.body.frictionAir *= effect.friction;
        
        this.players.forEach(player => {
            player.body.friction *= effect.friction;
            player.body.frictionAir *= effect.friction;
        });
    }

    setFieldType(type) {
        this.gameState.fieldType = type;
        const fieldConfig = FIELD_TYPES[type];
        
        // Apply field effects to physics
        this.ball.body.friction = fieldConfig.friction;
        this.ball.body.frictionAir = fieldConfig.frictionAir;
        this.engine.gravity.y = fieldConfig.gravityY;
        
        this.players.forEach(player => {
            player.body.friction = fieldConfig.friction;
            player.body.frictionAir = fieldConfig.frictionAir;
        });
    }

    render() {
        this.renderer.render(
            this.gameState,
            this.field,
            this.ball,
            this.players,
            this.powerUpManager,
            this.particleSystem
        );
    }

    start() {
        this.isRunning = true;
        this.gameState.gameTimeRemaining = ROUND_DURATION_SECONDS;
        this.gameState.startTime = Date.now();
        
        this.runner = setInterval(() => {
            this.update();
            this.render();
        }, 1000 / 60);
    }

    endGame() {
        this.isRunning = false;
        if (this.runner) {
            clearInterval(this.runner);
            this.runner = null;
        }
        
        this.gameState.endTime = Date.now();
        this.showGameStats();
    }

    showGameStats() {
        const stats = this.gameState.gameStats;
        const totalTime = (this.gameState.endTime - this.gameState.startTime) / 1000;
        
        console.log('=== Game Statistics ===');
        console.log(`Total Time: ${Math.floor(totalTime)}s`);
        console.log('Team 1:', stats.team1);
        console.log('Team 2:', stats.team2);
        console.log('Possession Time:', stats.totalPossessionTime);
    }

    pause() {
        this.isRunning = false;
        if (this.runner) {
            clearInterval(this.runner);
            this.runner = null;
        }
    }

    resume() {
        if (!this.isRunning) {
            this.start();
        }
    }

    destroy() {
        this.pause();
        this.particleSystem.clear();
        this.powerUpManager.clear();
        World.clear(this.world, false);
        Engine.clear(this.engine);
    }
}