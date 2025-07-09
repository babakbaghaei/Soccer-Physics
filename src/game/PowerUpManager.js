import { POWER_UP_TYPES, CANVAS_WIDTH, GROUND_Y } from '../config/constants.js';

export class PowerUpManager {
    constructor(world) {
        this.world = world;
        this.powerUps = [];
        this.activePowerUps = { team1: null, team2: null };
        this.spawnTimer = 0;
        this.spawnInterval = 10000; // 10 seconds
    }

    update() {
        this.spawnTimer++;
        
        // Spawn new power-up every spawnInterval frames
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnPowerUp();
            this.spawnTimer = 0;
        }

        // Remove expired power-ups
        this.powerUps = this.powerUps.filter(powerUp => {
            if (powerUp.expiryTime && Date.now() > powerUp.expiryTime) {
                World.remove(this.world, powerUp.body);
                return false;
            }
            return true;
        });
    }

    spawnPowerUp() {
        const powerUpType = POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)];
        const x = Math.random() * (CANVAS_WIDTH - 100) + 50;
        const y = Math.random() * (GROUND_Y - 150) + 50;
        
        const powerUpBody = Bodies.circle(x, y, 15, {
            isStatic: true,
            render: { fillStyle: powerUpType.color },
            label: 'powerUp',
            powerUpType: powerUpType
        });
        
        const powerUp = {
            body: powerUpBody,
            type: powerUpType,
            expiryTime: Date.now() + 15000 // 15 seconds
        };
        
        this.powerUps.push(powerUp);
        World.add(this.world, powerUpBody);
        
        return powerUp;
    }

    collectPowerUp(powerUp, player) {
        const team = player.team === 1 ? 'team1' : 'team2';
        
        // Cancel previous power-up if exists
        if (this.activePowerUps[team]) {
            clearTimeout(this.activePowerUps[team].timeout);
            player.deactivatePowerUp(this.activePowerUps[team].type);
        }
        
        // Apply new power-up
        player.applyPowerUp(powerUp.type, powerUp.type.duration);
        
        // Store active power-up
        this.activePowerUps[team] = {
            type: powerUp.type.type,
            timeout: setTimeout(() => {
                player.deactivatePowerUp(powerUp.type.type);
                this.activePowerUps[team] = null;
            }, powerUp.type.duration)
        };
        
        // Remove power-up from world
        World.remove(this.world, powerUp.body);
        this.powerUps = this.powerUps.filter(p => p !== powerUp);
        
        return powerUp.type;
    }

    checkCollision(player) {
        const playerPos = player.getPosition();
        const playerRadius = 20; // PLAYER_SIZE / 2
        
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];
            const powerUpPos = powerUp.body.position;
            const powerUpRadius = 15;
            
            const distance = Math.sqrt(
                Math.pow(playerPos.x - powerUpPos.x, 2) + 
                Math.pow(playerPos.y - powerUpPos.y, 2)
            );
            
            if (distance < playerRadius + powerUpRadius) {
                return this.collectPowerUp(powerUp, player);
            }
        }
        
        return null;
    }

    getPowerUps() {
        return this.powerUps;
    }

    getActivePowerUps() {
        return this.activePowerUps;
    }

    clear() {
        this.powerUps.forEach(powerUp => {
            World.remove(this.world, powerUp.body);
        });
        this.powerUps = [];
        
        // Clear active power-ups
        Object.keys(this.activePowerUps).forEach(team => {
            if (this.activePowerUps[team]) {
                clearTimeout(this.activePowerUps[team].timeout);
                this.activePowerUps[team] = null;
            }
        });
    }
}