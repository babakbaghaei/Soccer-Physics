import * as CANNON from 'cannon';
import audioManager from './audioManager.js';

const JUMP_FORCE = 4000; // Needs tuning based on mass and gravity
const MOVE_FORCE = 300; // Needs tuning

export class PlayerControls {
    constructor(playerBody) {
        this.playerBody = playerBody;
        this.keysPressed = {};
        this.isGrounded = false;

        this.initListeners();
    }

    initListeners() {
        window.addEventListener('keydown', (e) => {
            this.keysPressed[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keysPressed[e.code] = false;
        });
    }

    update() {
        const currentMoveForce = this.isGrounded ? MOVE_FORCE : MOVE_FORCE * 0.1; // Air control multiplier

        if (this.keysPressed['KeyA']) {
            this.playerBody.applyForce(new CANNON.Vec3(-currentMoveForce, 0, 0), this.playerBody.position);
        }
        if (this.keysPressed['KeyD']) {
            this.playerBody.applyForce(new CANNON.Vec3(currentMoveForce, 0, 0), this.playerBody.position);
        }
        if (this.keysPressed['KeyW'] && this.isGrounded) {
            this.playerBody.applyImpulse(new CANNON.Vec3(0, JUMP_FORCE, 0), this.playerBody.position);
            this.isGrounded = false;
            audioManager.playSound('jump');
        }
    }
}
