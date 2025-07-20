import * as CANNON from 'cannon-es';

const AI_STATE = {
    IDLE: 'IDLE',
    DEFEND: 'DEFEND',
    ATTACK: 'ATTACK',
    RECOVER: 'RECOVER'
};

const JUMP_FORCE = 3000; // Must match controls.js
const MOVE_FORCE = 1000;  // Must match controls.js

export class AIPlayer {
    constructor(aiBody, ballBody, gameConfig) {
        this.aiBody = aiBody;
        this.ballBody = ballBody;
        this.gameConfig = gameConfig;

        this.currentState = AI_STATE.IDLE;
        this.isGrounded = false;
        this.lastJumpTime = 0;
        this.JUMP_COOLDOWN = 500;
    }

    update() {
        this.determineAiState();

        switch (this.currentState) {
            case AI_STATE.IDLE:
                this.handleIdleState();
                break;
            case AI_STATE.DEFEND:
                this.handleDefendState();
                break;
            case AI_STATE.ATTACK:
                this.handleAttackState();
                break;
            case AI_STATE.RECOVER:
                this.handleRecoverState();
                break;
        }
    }

    determineAiState() {
        const ballPos = this.ballBody.position;
        const playerPos = this.aiBody.position;
        const playerHalfX = 0; // AI is on the right side, its half is x > 0

        const ballInAiHalf = ballPos.x > playerHalfX;
        const ballNearPlayerX = Math.abs(ballPos.x - playerPos.x) < 100;
        const ballNearPlayerY = Math.abs(ballPos.y - playerPos.y) < 100;

        if (ballInAiHalf) {
            if (ballNearPlayerX && ballNearPlayerY) {
                this.currentState = AI_STATE.ATTACK;
            } else {
                this.currentState = AI_STATE.DEFEND;
            }
        } else {
            this.currentState = AI_STATE.IDLE;
        }
    }

    handleIdleState() {
        const targetX = this.gameConfig.CANVAS_WIDTH / 4;
        this.moveHorizontally(targetX, MOVE_FORCE * 0.5);
    }

    handleDefendState() {
        // Simple defend: move towards the ball's X position
        const targetX = this.ballBody.position.x;
        this.moveHorizontally(targetX, MOVE_FORCE);

        if (this.shouldJump()) {
            this.performJump();
        }
    }

    handleAttackState() {
        const targetX = this.ballBody.position.x;
        this.moveHorizontally(targetX, MOVE_FORCE * 1.2);

        if (this.shouldJump()) {
            this.performJump();
        }
    }

    handleRecoverState() {
        const targetX = this.gameConfig.CANVAS_WIDTH / 4;
        this.moveHorizontally(targetX, MOVE_FORCE);
    }

    moveHorizontally(targetX, force) {
        const playerPos = this.aiBody.position;
        const currentMoveForce = this.isGrounded ? force : force * 0.1;
        const deadZone = 10;

        if (targetX < playerPos.x - deadZone) {
            this.aiBody.applyForce(new CANNON.Vec3(-currentMoveForce, 0, 0), playerPos);
        } else if (targetX > playerPos.x + deadZone) {
            this.aiBody.applyForce(new CANNON.Vec3(currentMoveForce, 0, 0), playerPos);
        }
    }

    shouldJump() {
        const timeSinceLastJump = Date.now() - this.lastJumpTime;
        if (!this.isGrounded || timeSinceLastJump < this.JUMP_COOLDOWN) {
            return false;
        }

        const ballPos = this.ballBody.position;
        const playerPos = this.aiBody.position;
        const horizontalDistance = Math.abs(ballPos.x - playerPos.x);
        const verticalDistance = ballPos.y - playerPos.y;

        if (horizontalDistance < 50 && verticalDistance > 20 && verticalDistance < 100) {
            return true;
        }
        return false;
    }

    performJump() {
        this.aiBody.applyImpulse(new CANNON.Vec3(0, JUMP_FORCE, 0), this.aiBody.position);
        this.isGrounded = false;
        this.lastJumpTime = Date.now();
    }
}
