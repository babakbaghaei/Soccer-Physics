// Power-Up System for PixelBall
class PowerUpSystem {
    constructor() {
        this.powerUps = [];
        this.activePowerUps = new Map(); // playerId -> {type, startTime, duration}
        this.spawnTimer = 0;
        this.spawnInterval = 8000; // 8 seconds between spawns
        this.powerUpTypes = {
            SPEED: {
                color: '#FFD700', // Gold
                effect: 'speed',
                duration: 5000, // 5 seconds
                multiplier: 2.0
            },
            SUPER_SHOT: {
                color: '#FF4500', // Red-Orange
                effect: 'superShot',
                duration: 8000, // 8 seconds
                multiplier: 1.0
            },
            LOW_GRAVITY: {
                color: '#00CED1', // Turquoise
                effect: 'lowGravity',
                duration: 6000, // 6 seconds
                multiplier: 0.5
            }
        };
    }

    update(deltaTime, world, players, ball) {
        this.spawnTimer += deltaTime;
        
        // Spawn new power-ups
        if (this.spawnTimer >= this.spawnInterval && this.powerUps.length < 3) {
            this.spawnPowerUp(world);
            this.spawnTimer = 0;
        }

        // Check for collisions
        this.checkCollisions(players, world);

        // Update active power-ups
        this.updateActivePowerUps();
    }

    spawnPowerUp(world) {
        const types = Object.keys(this.powerUpTypes);
        const randomType = types[Math.floor(Math.random() * types.length)];
        
        // Random position on field (avoid goals)
        const x = 100 + Math.random() * (CANVAS_WIDTH - 200);
        const y = GROUND_Y - 60; // Above ground
        
        const powerUpBody = Matter.Bodies.rectangle(x, y, 30, 30, {
            isSensor: true,
            isStatic: true,
            label: `powerup_${randomType}`,
            render: { fillStyle: this.powerUpTypes[randomType].color }
        });

        this.powerUps.push({
            body: powerUpBody,
            type: randomType,
            spawnTime: Date.now()
        });

        Matter.World.add(world, powerUpBody);
    }

    checkCollisions(players, world) {
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];
            
            players.forEach((player, playerIndex) => {
                const distance = Math.sqrt(
                    Math.pow(player.body.position.x - powerUp.body.position.x, 2) +
                    Math.pow(player.body.position.y - powerUp.body.position.y, 2)
                );

                if (distance < 40) { // Collision detected
                    this.activatePowerUp(playerIndex, powerUp.type);
                    Matter.World.remove(world, powerUp.body);
                    this.powerUps.splice(i, 1);
                    
                    // Play pickup sound
                    if (window.audioManager) {
                        window.audioManager.playSound('powerup');
                    }
                }
            });
        }
    }

    activatePowerUp(playerId, type) {
        const powerUpConfig = this.powerUpTypes[type];
        
        this.activePowerUps.set(playerId, {
            type: type,
            startTime: Date.now(),
            duration: powerUpConfig.duration,
            multiplier: powerUpConfig.multiplier
        });

        console.log(`Player ${playerId + 1} got ${type} power-up!`);
    }

    updateActivePowerUps() {
        const currentTime = Date.now();
        
        for (let [playerId, powerUp] of this.activePowerUps) {
            if (currentTime - powerUp.startTime >= powerUp.duration) {
                this.activePowerUps.delete(playerId);
                console.log(`Player ${playerId + 1} lost ${powerUp.type} power-up`);
            }
        }
    }

    getPlayerPowerUp(playerId) {
        return this.activePowerUps.get(playerId) || null;
    }

    drawPowerUps(ctx, scale) {
        this.powerUps.forEach(powerUp => {
            const x = powerUp.body.position.x * scale;
            const y = powerUp.body.position.y * scale;
            const size = 30 * scale;

            // Draw power-up with pulsing effect
            const pulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.005);
            
            ctx.fillStyle = this.powerUpTypes[powerUp.type].color;
            ctx.beginPath();
            ctx.arc(x, y, size * 0.5 * pulse, 0, Math.PI * 2);
            ctx.fill();

            // Draw symbol based on type
            ctx.fillStyle = '#000000';
            ctx.font = `${Math.floor(12 * scale)}px monospace`;
            ctx.textAlign = 'center';
            
            let symbol = '?';
            switch(powerUp.type) {
                case 'SPEED': symbol = '⚡'; break;
                case 'SUPER_SHOT': symbol = '🎯'; break;
                case 'LOW_GRAVITY': symbol = '🌙'; break;
            }
            
            ctx.fillText(symbol, x, y + 4 * scale);
        });
    }

    reset() {
        this.powerUps = [];
        this.activePowerUps.clear();
        this.spawnTimer = 0;
    }
}

// Enhanced Physics System
class PhysicsSystem {
    constructor() {
        this.ballTrail = [];
        this.particles = [];
    }

    updateBallPhysics(ball) {
        // More realistic ball physics
        const velocity = ball.velocity;
        
        // Air resistance
        const airResistance = 0.99;
        Matter.Body.setVelocity(ball, {
            x: velocity.x * airResistance,
            y: velocity.y
        });

        // Ball spin affects trajectory slightly
        const spin = ball.angularVelocity;
        if (Math.abs(spin) > 0.1) {
            Matter.Body.applyForce(ball, ball.position, {
                x: spin * 0.001,
                y: 0
            });
        }

        // Update ball trail
        this.ballTrail.push({
            x: ball.position.x,
            y: ball.position.y,
            time: Date.now()
        });

        // Keep trail short
        if (this.ballTrail.length > 8) {
            this.ballTrail.shift();
        }
    }

    createImpactParticles(x, y, count = 8, color = '#A0522D') {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3 + 1;
            
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - Math.random() * 2,
                life: Math.random() * 40 + 20,
                maxLife: Math.random() * 40 + 20,
                size: Math.random() * 3 + 1,
                color: color
            });
        }
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1; // Gravity
            p.vx *= 0.98; // Air resistance
            p.life--;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    drawParticles(ctx, scale) {
        this.particles.forEach(p => {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(
                p.x * scale - (p.size * scale / 2),
                p.y * scale - (p.size * scale / 2),
                p.size * scale,
                p.size * scale
            );
        });
        ctx.globalAlpha = 1.0;
    }

    drawBallTrail(ctx, scale) {
        if (this.ballTrail.length < 2) return;

        const currentTime = Date.now();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();

        for (let i = 0; i < this.ballTrail.length; i++) {
            const trail = this.ballTrail[i];
            const age = currentTime - trail.time;
            const alpha = Math.max(0, 1 - age / 500); // Fade over 500ms
            
            if (alpha > 0) {
                if (i === 0) {
                    ctx.moveTo(trail.x * scale, trail.y * scale);
                } else {
                    ctx.lineTo(trail.x * scale, trail.y * scale);
                }
            }
        }
        ctx.stroke();
    }
}

// Enhanced Game State Manager
class GameStateManager {
    constructor() {
        this.state = 'PLAYING'; // PLAYING, GOAL_SCORED, PAUSED
        this.lastGoalScorer = null;
        this.ballRespawnTimer = 0;
        this.ballRespawnDelay = 2000; // 2 seconds
    }

    handleGoalScored(scoringTeam, ball) {
        this.state = 'GOAL_SCORED';
        this.lastGoalScorer = scoringTeam;
        this.ballRespawnTimer = 0;
        
        // Hide ball
        Matter.Body.setPosition(ball, { x: -1000, y: -1000 });
        Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    }

    update(deltaTime, ball) {
        if (this.state === 'GOAL_SCORED') {
            this.ballRespawnTimer += deltaTime;
            
            if (this.ballRespawnTimer >= this.ballRespawnDelay) {
                this.respawnBall(ball);
                this.state = 'PLAYING';
            }
        }
    }

    respawnBall(ball) {
        // Ball appears from the side of who got scored on
        let spawnX;
        if (this.lastGoalScorer === 1) {
            // Team 1 scored, spawn from team 2's side
            spawnX = CANVAS_WIDTH * 0.75;
        } else {
            // Team 2 scored, spawn from team 1's side
            spawnX = CANVAS_WIDTH * 0.25;
        }

        // Ball appears and falls
        Matter.Body.setPosition(ball, { x: spawnX, y: 100 });
        Matter.Body.setVelocity(ball, { x: 0, y: 0 });
        
        console.log(`Ball respawned from ${this.lastGoalScorer === 1 ? 'Team 2' : 'Team 1'} side`);
    }
}

// Export for use in main game
window.PowerUpSystem = PowerUpSystem;
window.PhysicsSystem = PhysicsSystem;
window.GameStateManager = GameStateManager;