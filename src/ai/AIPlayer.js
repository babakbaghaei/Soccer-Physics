import { CANVAS_WIDTH, GROUND_Y, GOAL_WIDTH, GOAL_HEIGHT } from '../config/constants.js';

export class AIPlayer {
    constructor(player, ball, opponent, field) {
        this.player = player;
        this.ball = ball;
        this.opponent = opponent;
        this.field = field;
        this.lastDecision = 0;
        this.decisionCooldown = 0;
        this.targetPosition = { x: 0, y: 0 };
        this.currentState = 'chase';
    }

    update() {
        if (this.decisionCooldown > 0) {
            this.decisionCooldown--;
            return;
        }

        this.makeDecision();
        this.executeAction();
    }

    makeDecision() {
        const ballPos = this.ball.getPosition();
        const playerPos = this.player.getPosition();
        const opponentPos = this.opponent.getPosition();
        
        // Calculate distances
        const distanceToBall = Math.sqrt(
            Math.pow(playerPos.x - ballPos.x, 2) + 
            Math.pow(playerPos.y - ballPos.y, 2)
        );
        
        const distanceToOpponent = Math.sqrt(
            Math.pow(playerPos.x - opponentPos.x, 2) + 
            Math.pow(playerPos.y - opponentPos.y, 2)
        );

        // Determine AI state
        if (this.shouldDefend(ballPos, playerPos, opponentPos)) {
            this.currentState = 'defend';
        } else if (this.shouldAttack(ballPos, playerPos, opponentPos)) {
            this.currentState = 'attack';
        } else {
            this.currentState = 'chase';
        }

        this.decisionCooldown = Math.random() * 30 + 10; // Random cooldown
    }

    shouldDefend(ballPos, playerPos, opponentPos) {
        // Defend if ball is near our goal and opponent is close
        const ourGoalX = this.player.team === 1 ? CANVAS_WIDTH - GOAL_WIDTH / 2 : GOAL_WIDTH / 2;
        const distanceToOurGoal = Math.abs(ballPos.x - ourGoalX);
        
        return distanceToOurGoal < 150 && 
               Math.abs(opponentPos.x - ballPos.x) < 100 &&
               Math.abs(opponentPos.y - ballPos.y) < 50;
    }

    shouldAttack(ballPos, playerPos, opponentPos) {
        // Attack if we have the ball and opponent's goal is accessible
        const opponentGoalX = this.player.team === 1 ? GOAL_WIDTH / 2 : CANVAS_WIDTH - GOAL_WIDTH / 2;
        const distanceToOpponentGoal = Math.abs(ballPos.x - opponentGoalX);
        
        return distanceToOpponentGoal < 200 && 
               Math.abs(playerPos.x - ballPos.x) < 50 &&
               Math.abs(playerPos.y - ballPos.y) < 50;
    }

    executeAction() {
        const ballPos = this.ball.getPosition();
        const playerPos = this.player.getPosition();
        const ballVel = this.ball.getVelocity();

        switch (this.currentState) {
            case 'defend':
                this.executeDefense(ballPos, playerPos);
                break;
            case 'attack':
                this.executeAttack(ballPos, playerPos, ballVel);
                break;
            case 'chase':
            default:
                this.executeChase(ballPos, playerPos);
                break;
        }
    }

    executeDefense(ballPos, playerPos) {
        // Position between ball and goal
        const ourGoalX = this.player.team === 1 ? CANVAS_WIDTH - GOAL_WIDTH / 2 : GOAL_WIDTH / 2;
        const targetX = (ballPos.x + ourGoalX) / 2;
        
        // Move towards target position
        if (playerPos.x < targetX - 10) {
            this.player.move(1);
        } else if (playerPos.x > targetX + 10) {
            this.player.move(-1);
        }

        // Jump to intercept if ball is high
        if (ballPos.y < playerPos.y - 30 && Math.abs(ballPos.x - playerPos.x) < 50) {
            this.player.jump();
        }
    }

    executeAttack(ballPos, playerPos, ballVel) {
        const opponentGoalX = this.player.team === 1 ? GOAL_WIDTH / 2 : CANVAS_WIDTH - GOAL_WIDTH / 2;
        
        // Move towards opponent's goal
        if (playerPos.x < opponentGoalX - 20) {
            this.player.move(1);
        } else if (playerPos.x > opponentGoalX + 20) {
            this.player.move(-1);
        }

        // Shoot when close to goal
        if (Math.abs(playerPos.x - opponentGoalX) < 50 && 
            Math.abs(playerPos.y - ballPos.y) < 30) {
            // Apply force to ball towards goal
            const direction = this.player.team === 1 ? -1 : 1;
            const force = { x: direction * 0.02, y: -0.01 };
            Body.applyForce(this.ball.body, ballPos, force);
        }
    }

    executeChase(ballPos, playerPos) {
        // Move towards ball
        if (playerPos.x < ballPos.x - 10) {
            this.player.move(1);
        } else if (playerPos.x > ballPos.x + 10) {
            this.player.move(-1);
        }

        // Jump if ball is high
        if (ballPos.y < playerPos.y - 20 && Math.abs(ballPos.x - playerPos.x) < 40) {
            this.player.jump();
        }

        // Random chip shot attempt
        if (Math.random() < 0.01 && Math.abs(playerPos.x - ballPos.x) < 30) {
            this.attemptChipShot(ballPos, playerPos);
        }
    }

    attemptChipShot(ballPos, playerPos) {
        // Check if conditions are right for chip shot
        const isBallOnGround = Math.abs(ballPos.y + 15 - GROUND_Y) < 25;
        const isPlayerFalling = this.player.getVelocity().y < -0.2;
        
        if (isBallOnGround && isPlayerFalling && this.player.hasJumped) {
            const direction = this.player.team === 1 ? -1 : 1;
            Body.setVelocity(this.ball.body, { x: direction * 10, y: -16 });
            Body.setAngularVelocity(this.ball.body, direction * 0.5);
        }
    }

    getState() {
        return this.currentState;
    }
}