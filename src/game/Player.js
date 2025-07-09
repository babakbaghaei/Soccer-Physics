import { 
    PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_DENSITY, PLAYER_FRICTION, 
    PLAYER_RESTITUTION, JUMP_FORCE, MOVE_FORCE, AIR_MOVE_FORCE_MULTIPLIER,
    COLORS 
} from '../config/constants.js';

export class Player {
    constructor(x, y, team, world) {
        this.team = team;
        this.body = this.createBody(x, y);
        this.isGrounded = false;
        this.hasJumped = false;
        this.color = team === 1 ? COLORS.PLAYER_1 : COLORS.PLAYER_2;
        
        // Power-up states
        this.hasShield = false;
        this.hasMagnet = false;
        this.shootPower = 1;
        this.moveForce = MOVE_FORCE;
        this.airMoveForce = MOVE_FORCE * AIR_MOVE_FORCE_MULTIPLIER;
        
        // AI properties
        this.isAI = team === 2;
        this.lastDecision = 0;
        this.decisionCooldown = 0;
        
        World.add(world, this.body);
    }

    createBody(x, y) {
        return Bodies.rectangle(x, y, PLAYER_WIDTH, PLAYER_HEIGHT, {
            density: PLAYER_DENSITY,
            friction: PLAYER_FRICTION,
            restitution: PLAYER_RESTITUTION,
            label: this.team === 1 ? 'player1' : 'player2'
        });
    }

    update() {
        // Update grounded state
        this.isGrounded = this.body.velocity.y > -0.1 && this.body.velocity.y < 0.1;
        
        // Reset jump flag when grounded
        if (this.isGrounded) {
            setTimeout(() => { this.hasJumped = false; }, 50);
        }
    }

    jump() {
        if (this.isGrounded && !this.hasJumped) {
            Body.setVelocity(this.body, { 
                x: this.body.velocity.x, 
                y: -JUMP_FORCE 
            });
            this.hasJumped = true;
        }
    }

    move(direction, isInAir = false) {
        const force = isInAir ? this.airMoveForce : this.moveForce;
        const moveForce = direction * force;
        
        Body.applyForce(this.body, this.body.position, { 
            x: moveForce, 
            y: 0 
        });
    }

    applyPowerUp(powerUpType, duration) {
        switch (powerUpType.type) {
            case 'speed':
                this.moveForce = MOVE_FORCE * 2;
                this.airMoveForce = MOVE_FORCE * AIR_MOVE_FORCE_MULTIPLIER * 2;
                break;
            case 'strength':
                this.shootPower = 2;
                break;
            case 'shield':
                this.hasShield = true;
                break;
            case 'magnet':
                this.hasMagnet = true;
                break;
        }

        // Reset after duration
        setTimeout(() => {
            this.deactivatePowerUp(powerUpType.type);
        }, duration);
    }

    deactivatePowerUp(powerUpType) {
        switch (powerUpType) {
            case 'speed':
                this.moveForce = MOVE_FORCE;
                this.airMoveForce = MOVE_FORCE * AIR_MOVE_FORCE_MULTIPLIER;
                break;
            case 'strength':
                this.shootPower = 1;
                break;
            case 'shield':
                this.hasShield = false;
                break;
            case 'magnet':
                this.hasMagnet = false;
                break;
        }
    }

    getPosition() {
        return this.body.position;
    }

    getVelocity() {
        return this.body.velocity;
    }

    setPosition(x, y) {
        Body.setPosition(this.body, { x, y });
        Body.setVelocity(this.body, { x: 0, y: 0 });
    }

    applyMagnetForce(ball) {
        if (!this.hasMagnet || !ball) return;
        
        const distance = Math.sqrt(
            Math.pow(this.body.position.x - ball.position.x, 2) + 
            Math.pow(this.body.position.y - ball.position.y, 2)
        );
        
        if (distance < 100) {
            const force = 0.001 / Math.max(distance, 10);
            const directionX = (this.body.position.x - ball.position.x) / distance;
            const directionY = (this.body.position.y - ball.position.y) / distance;
            
            Body.applyForce(ball, ball.position, { 
                x: directionX * force, 
                y: directionY * force 
            });
        }
    }
}