import { BALL_RADIUS, CANVAS_WIDTH, CANVAS_HEIGHT } from '../config/constants.js';

export class Ball {
    constructor(x, y, world) {
        this.body = this.createBody(x, y);
        this.isChipped = false;
        this.lastHitBy = null;
        this.lastHitTime = 0;
        
        World.add(world, this.body);
    }

    createBody(x, y) {
        return Bodies.circle(x, y, BALL_RADIUS, {
            restitution: 0.5,
            friction: 0.01,
            frictionAir: 0.01,
            density: 0.0015,
            label: 'ball',
            render: { sprite: { texture: null, xScale: 1, yScale: 1 } }
        });
    }

    update() {
        // Reset chip flag after a short time
        if (this.isChipped && Date.now() - this.lastHitTime > 100) {
            this.isChipped = false;
        }

        // Keep ball in bounds
        this.keepInBounds();
    }

    keepInBounds() {
        const pos = this.body.position;
        const vel = this.body.velocity;
        
        // Horizontal bounds
        if (pos.x - BALL_RADIUS < 0) {
            Body.setPosition(this.body, { x: BALL_RADIUS, y: pos.y });
            Body.setVelocity(this.body, { x: Math.abs(vel.x) * 0.8, y: vel.y });
        } else if (pos.x + BALL_RADIUS > CANVAS_WIDTH) {
            Body.setPosition(this.body, { x: CANVAS_WIDTH - BALL_RADIUS, y: pos.y });
            Body.setVelocity(this.body, { x: -Math.abs(vel.x) * 0.8, y: vel.y });
        }

        // Vertical bounds
        if (pos.y - BALL_RADIUS < 0) {
            Body.setPosition(this.body, { x: pos.x, y: BALL_RADIUS });
            Body.setVelocity(this.body, { x: vel.x, y: Math.abs(vel.y) * 0.8 });
        } else if (pos.y + BALL_RADIUS > CANVAS_HEIGHT) {
            Body.setPosition(this.body, { x: pos.x, y: CANVAS_HEIGHT - BALL_RADIUS });
            Body.setVelocity(this.body, { x: vel.x, y: -Math.abs(vel.y) * 0.8 });
        }
    }

    hit(player, hitType = 'normal') {
        this.lastHitBy = player;
        this.lastHitTime = Date.now();

        // Apply different effects based on hit type
        switch (hitType) {
            case 'chip':
                this.isChipped = true;
                break;
            case 'header':
                // Header effect - ball goes higher
                Body.setVelocity(this.body, { 
                    x: this.body.velocity.x, 
                    y: Math.min(this.body.velocity.y - 5, -10) 
                });
                break;
            case 'strong':
                // Strong shot effect
                const multiplier = player.shootPower || 1;
                Body.setVelocity(this.body, { 
                    x: this.body.velocity.x * multiplier, 
                    y: this.body.velocity.y * multiplier 
                });
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

    applyWindForce(windForce) {
        if (windForce > 0) {
            Body.applyForce(this.body, this.body.position, { 
                x: windForce * 0.005, 
                y: 0 
            });
        }
    }

    applyRandomForce() {
        if (Math.random() < 0.02) { // 2% probability
            const randomForce = (Math.random() - 0.5) * 0.001;
            Body.applyForce(this.body, this.body.position, { 
                x: randomForce, 
                y: 0 
            });
        }
    }

    reset() {
        this.setPosition(CANVAS_WIDTH / 2, 100);
        this.isChipped = false;
        this.lastHitBy = null;
        this.lastHitTime = 0;
    }
}