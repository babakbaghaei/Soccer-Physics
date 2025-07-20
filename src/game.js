import * as THREE from 'three';
import * as CANNON from 'cannon';
import { SceneManager } from './scene.js';
import { PhysicsManager } from './physics.js';
import { PlayerControls } from './controls.js';
import { AIPlayer } from './aiPlayer.js';
import audioManager from './audioManager.js';

// Game constants from original project
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const WALL_THICKNESS = 40;
const GROUND_THICKNESS = 40;
const GOAL_HEIGHT = 120;
const GOAL_WIDTH = 30;
const GOAL_POST_WIDTH = 6;
const FIELD_SURFACE_Y = (580 - GROUND_THICKNESS / 2) - GROUND_THICKNESS;

// Adjust coordinates for Three.js/Cannon.js (center-based)
const-to-three-scale = 1; // This can be adjusted if we need to scale the world
const planeWidth = CANVAS_WIDTH * to-three-scale;
const planeHeight = CANVAS_HEIGHT * to-three-scale;


export class Game {
    constructor() {
        this.sceneManager = null;
        this.physicsManager = null;
        this.gameObjects = []; // To hold all synced game objects
        this.playerControls = null;
        this.aiPlayer = null;
        this.isGameOver = false;
        this.timerId = null;
        this.gameTimeRemaining = 90;
    }

    init() {
        this.sceneManager = new SceneManager();
        this.physicsManager = new PhysicsManager();

        this.createField();
        this.createPlayersAndBall();
        this.setupCollisionHandlers();

        this.startGameTimer();
        // Start the render loop and update physics
        this.sceneManager.startRenderLoop(() => {
            if (this.isGameOver) return;

            this.physicsManager.update();
            if (this.playerControls) {
                this.playerControls.update();
            }
            if (this.aiPlayer) {
                this.aiPlayer.update();
            }

            // Sync all dynamic objects
            for (const obj of this.gameObjects) {
                obj.mesh.position.copy(obj.body.position);
                obj.mesh.quaternion.copy(obj.body.quaternion);

                if (obj.shadow) {
                    obj.shadow.position.x = obj.body.position.x;
                    obj.shadow.position.z = obj.body.position.z;
                    obj.shadow.position.y = -planeHeight / 2 + GROUND_THICKNESS + 1; // Just above the ground

                    const distance = obj.body.position.y - (-planeHeight / 2 + GROUND_THICKNESS);
                    obj.shadow.material.opacity = Math.max(0.1, 0.5 - distance / 200);
                }
            }
        });
    }

    createField() {
        const scene = this.sceneManager.getScene();
        const world = this.physicsManager.getWorld();
        const groundMaterial = this.physicsManager.materials.groundMaterial;

        // Ground
        this.createStaticObject(
            new THREE.BoxGeometry(planeWidth, GROUND_THICKNESS, 1000),
            new THREE.MeshLambertMaterial({ color: 0x228B22 }),
            new CANNON.Box(new CANNON.Vec3(planeWidth / 2, GROUND_THICKNESS / 2, 500)),
            new CANNON.Vec3(0, -planeHeight / 2 + GROUND_THICKNESS / 2, 0),
            groundMaterial
        );

        // Ceiling
        this.createStaticObject(
            new THREE.BoxGeometry(planeWidth, WALL_THICKNESS, 1000),
            new THREE.MeshLambertMaterial({ color: 0x666666 }),
            new CANNON.Box(new CANNON.Vec3(planeWidth / 2, WALL_THICKNESS / 2, 500)),
            new CANNON.Vec3(0, planeHeight / 2 + WALL_THICKNESS / 2, 0),
            groundMaterial
        );

        // Left Wall
        this.createStaticObject(
            new THREE.BoxGeometry(WALL_THICKNESS, planeHeight, 1000),
            new THREE.MeshLambertMaterial({ color: 0x666666 }),
            new CANNON.Box(new CANNON.Vec3(WALL_THICKNESS / 2, planeHeight / 2, 500)),
            new CANNON.Vec3(-planeWidth / 2 - WALL_THICKNESS / 2, 0, 0),
            groundMaterial
        );

        // Right Wall
        this.createStaticObject(
            new THREE.BoxGeometry(WALL_THICKNESS, planeHeight, 1000),
            new THREE.MeshLambertMaterial({ color: 0x666666 }),
            new CANNON.Box(new CANNON.Vec3(WALL_THICKNESS / 2, planeHeight / 2, 500)),
            new CANNON.Vec3(planeWidth / 2 + WALL_THICKNESS / 2, 0, 0),
            groundMaterial
        );

        // Goals
        const goalY = -planeHeight/2 + GROUND_THICKNESS + GOAL_HEIGHT/2;

        // Goal 1 (Left)
        this.createStaticObject(
            new THREE.BoxGeometry(GOAL_POST_WIDTH, GOAL_HEIGHT, 10),
            new THREE.MeshLambertMaterial({ color: 0xFFFFFF }),
            new CANNON.Box(new CANNON.Vec3(GOAL_POST_WIDTH / 2, GOAL_HEIGHT / 2, 5)),
            new CANNON.Vec3(-planeWidth/2 + GOAL_POST_WIDTH/2, goalY, 0),
            groundMaterial
        );

        // Goal 2 (Right)
        this.createStaticObject(
            new THREE.BoxGeometry(GOAL_POST_WIDTH, GOAL_HEIGHT, 10),
            new THREE.MeshLambertMaterial({ color: 0xFFFFFF }),
            new CANNON.Box(new CANNON.Vec3(GOAL_POST_WIDTH / 2, GOAL_HEIGHT / 2, 5)),
            new CANNON.Vec3(planeWidth/2 - GOAL_POST_WIDTH/2, goalY, 0),
            groundMaterial
        );

        // Goal Sensors
        this.createGoalSensor(new CANNON.Vec3(-planeWidth / 2 + GOAL_WIDTH / 2, goalY, 0), 'goal1');
        this.createGoalSensor(new CANNON.Vec3(planeWidth / 2 - GOAL_WIDTH / 2, goalY, 0), 'goal2');
    }

    createGoalSensor(position, label) {
        const shape = new CANNON.Box(new CANNON.Vec3(GOAL_WIDTH / 2, GOAL_HEIGHT / 2, 5));
        const body = new CANNON.Body({
            isTrigger: true,
            mass: 0,
            position: position,
            shape: shape
        });
        body.label = label;
        this.physicsManager.getWorld().addBody(body);
    }

    createStaticObject(geometry, material, cannonShape, cannonPosition, cannonMaterial) {
        const mesh = new THREE.Mesh(geometry, material);
        const body = new CANNON.Body({
            mass: 0, // static
            shape: cannonShape,
            position: cannonPosition,
            material: cannonMaterial
        });

        this.sceneManager.getScene().add(mesh);
        this.physicsManager.getWorld().addBody(body);

        // Sync mesh to body (only needed once for static objects)
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
    }

    createPlayersAndBall() {
        const playerMaterial = this.physicsManager.materials.playerMaterial;
        const ballMaterial = this.physicsManager.materials.ballMaterial;

        // Player 1
        const player1 = this.createDynamicObject(
            new THREE.BoxGeometry(40, 40, 40),
            new THREE.MeshLambertMaterial({ color: 0xD9534F }),
            new CANNON.Box(new CANNON.Vec3(20, 20, 20)),
            new CANNON.Vec3(-200, 0, 0),
            0.003, // density from original, mass will be calculated
            playerMaterial,
            'player1'
        );
        this.playerControls = new PlayerControls(player1.body);

        // Player 2
        const player2 = this.createDynamicObject(
            new THREE.BoxGeometry(40, 40, 40),
            new THREE.MeshLambertMaterial({ color: 0x428BCA }),
            new CANNON.Box(new CANNON.Vec3(20, 20, 20)),
            new CANNON.Vec3(200, 0, 0),
            0.003,
            playerMaterial,
            'player2'
        );

        // Ball
        this.createDynamicObject(
            new THREE.SphereGeometry(15, 32, 32),
            new THREE.MeshLambertMaterial({ color: 0xFFFFFF }),
            new CANNON.Sphere(15),
            new CANNON.Vec3(0, 100, 0),
            0.0015,
            ballMaterial,
            'ball'
        );

        const gameConfig = { CANVAS_WIDTH, CANVAS_HEIGHT };
        this.aiPlayer = new AIPlayer(player2.body, ball.body, gameConfig);
    }

    createDynamicObject(geometry, material, cannonShape, cannonPosition, density, cannonMaterial, label) {
        const mesh = new THREE.Mesh(geometry, material);

        const body = new CANNON.Body({
            mass: density * cannonShape.volume(), // Mass from density
            shape: cannonShape,
            position: cannonPosition,
            material: cannonMaterial,
            linearDamping: 0.01, // Corresponds to frictionAir
            angularDamping: 0.01,
        });
        body.label = label;

        this.sceneManager.getScene().add(mesh);
        this.physicsManager.getWorld().addBody(body);

        // Create a shadow for dynamic objects
        const shadow = this.createShadow(body);

        const gameObject = { mesh, body, shadow };
        this.gameObjects.push(gameObject);
        return gameObject;
    }

    createShadow(body) {
        const shadowGeo = new THREE.CircleGeometry(body.shapes[0].radius || 20, 32);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
        const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        shadowMesh.rotation.x = -Math.PI / 2; // Lay it flat on the ground
        this.sceneManager.getScene().add(shadowMesh);
        return shadowMesh;
    }

    setupCollisionHandlers() {
        const world = this.physicsManager.getWorld();
        const playerBody = this.gameObjects.find(g => g.body.label === 'player1').body;
        const ballBody = this.gameObjects.find(g => g.body.label === 'ball').body;

        world.addEventListener('beginContact', (event) => {
            const { bodyA, bodyB } = event;

            // Player grounding logic
            if (bodyB.material && bodyB.material.name === 'ground') { // Assuming bodyB is the ground
                 if (bodyA.label === 'player1' && this.playerControls) {
                    this.playerControls.isGrounded = true;
                } else if (bodyA.label === 'player2' && this.aiPlayer) {
                    this.aiPlayer.isGrounded = true;
                }
            } else if (bodyA.material && bodyA.material.name === 'ground') { // Assuming bodyA is the ground
                 if (bodyB.label === 'player1' && this.playerControls) {
                    this.playerControls.isGrounded = true;
                } else if (bodyB.label === 'player2' && this.aiPlayer) {
                    this.aiPlayer.isGrounded = true;
                }
            }

            // Goal scoring logic
            if (bodyA.label === 'ball' || bodyB.label === 'ball') {
                const goalBody = bodyA.label.startsWith('goal') ? bodyA : (bodyB.label.startsWith('goal') ? bodyB : null);
                if (goalBody) {
                    if (goalBody.label === 'goal1') {
                        console.log("Goal for Team 2!");
                        this.handleGoalScored(2);
                    } else if (goalBody.label === 'goal2') {
                        console.log("Goal for Team 1!");
                        this.handleGoalScored(1);
                    }
                }
            }
        });
    }

    handleGoalScored(scoringTeam) {
        audioManager.playSound('goal');
        const gameMessage = document.getElementById('gameMessage');
        gameMessage.textContent = 'Goal!';

        if (scoringTeam === 1) {
            this.team1Score = (this.team1Score || 0) + 1;
            document.getElementById('team1ScoreDisplay').textContent = `Team 1: ${this.team1Score}`;
        } else {
            this.team2Score = (this.team2Score || 0) + 1;
            document.getElementById('team2ScoreDisplay').textContent = `Team 2: ${this.team2Score}`;
        }

        setTimeout(() => {
            gameMessage.textContent = '';
            this.resetPositions();
        }, 1000);
    }

    resetPositions() {
        const player1 = this.gameObjects.find(g => g.body.label === 'player1').body;
        const player2 = this.gameObjects.find(g => g.body.label === 'player2').body;
        const ball = this.gameObjects.find(g => g.body.label === 'ball').body;

        player1.position.set(-200, 0, 0);
        player1.velocity.set(0, 0, 0);
        player1.angularVelocity.set(0, 0, 0);

        player2.position.set(200, 0, 0);
        player2.velocity.set(0, 0, 0);
        player2.angularVelocity.set(0, 0, 0);

        ball.position.set(0, 100, 0);
        ball.velocity.set(0, 0, 0);
        ball.angularVelocity.set(0, 0, 0);
    }

    startGameTimer() {
        const timerDisplay = document.getElementById('timerDisplay');
        this.timerId = setInterval(() => {
            this.gameTimeRemaining--;
            timerDisplay.textContent = `Time: ${this.gameTimeRemaining}`;
            if (this.gameTimeRemaining <= 0) {
                this.endGame();
            }
        }, 1000);
    }

    endGame() {
        clearInterval(this.timerId);
        this.isGameOver = true;

        const endGameModal = document.getElementById('endGameModal');
        const winnerMessageDisplay = document.getElementById('winnerMessage');
        const restartGameBtn = document.getElementById('restartGame');

        let winnerMessage = "Draw!";
        if (this.team1Score > this.team2Score) winnerMessage = "Red Team Wins!";
        if (this.team2Score > this.team1Score) winnerMessage = "Blue Team Wins!";

        winnerMessageDisplay.textContent = winnerMessage;
        endGameModal.style.display = 'flex';

        restartGameBtn.onclick = () => {
            window.location.reload();
        };
    }
}
