/// --- Matter.js Aliases ---
const Engine = window.Matter.Engine;
const Render = window.Matter.Render;
const Runner = window.Matter.Runner;
const World = window.Matter.World;
const Bodies = window.Matter.Bodies;
const Body = window.Matter.Body;
const Events = window.Matter.Events;
const Composite = window.Matter.Composite;
const Composites = window.Matter.Composites;
const Constraint = window.Matter.Constraint;

import audioManager from './audioManager.js';
import { initRenderer, draw, createImpactParticles, triggerScreenShake } from './renderer.js';

// --- DOM Element References ---
const mainCanvas = document.getElementById('gameCanvas');
const mainCtx = mainCanvas.getContext('2d');
const team1ScoreDisplay = document.getElementById('team1ScoreDisplay');
const team2ScoreDisplay = document.getElementById('team2ScoreDisplay');
const timerDisplay = document.getElementById('timerDisplay');
const gameMessageDisplay = document.getElementById('gameMessage');

// --- Game Constants ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const ROUND_DURATION_SECONDS = 90;
const BALL_RADIUS = 15;

// --- Collision Categories ---
const playerCategory = 0x0001;
const goalPostCategory = 0x0002;
const ballCategory = 0x0004;
const worldCategory = 0x0008;

// --- Game Constants ---
const AI_PLAYER_INDEX = 1;

// --- Game Variables ---
let engine;
let world;
let runner;
let isGameOver = false;
let team1Score = 0;
let team2Score = 0;
let ball;
let players = [];
let goals = {};
let gameTimeRemaining = ROUND_DURATION_SECONDS;
let roundTimerId = null;

// --- Field Constants ---
const ORIGINAL_GROUND_THICKNESS = 40;
const NEW_GROUND_THICKNESS = ORIGINAL_GROUND_THICKNESS * 2;
const NEW_FIELD_SURFACE_Y = (580 - ORIGINAL_GROUND_THICKNESS / 2) - ORIGINAL_GROUND_THICKNESS;
const NEW_GROUND_Y_PHYSICS_CENTER = NEW_FIELD_SURFACE_Y + NEW_GROUND_THICKNESS / 2;

const GROUND_Y = NEW_GROUND_Y_PHYSICS_CENTER;
const GROUND_THICKNESS = NEW_GROUND_THICKNESS;
const FIELD_SURFACE_Y = NEW_FIELD_SURFACE_Y;

const WALL_THICKNESS = 40;
const GOAL_HEIGHT = 120;
const GOAL_WIDTH = 30;
const GOAL_POST_WIDTH = 6;


// --- Player Constants ---
const PLAYER_FRICTION = 0.3; // Was 0.8 - Reduced to prevent sticking
const PLAYER_RESTITUTION = 0.4; // Was 0.1 - Increased for a bit more bounce off objects
const PLAYER_DENSITY = 0.003;
const PLAYER_SIZE = 40;
const PLAYER_WIDTH = PLAYER_SIZE;
const PLAYER_HEIGHT = PLAYER_SIZE;
const JUMP_FORCE = 0.09;
const MOVE_FORCE = 0.015;
const AIR_MOVE_FORCE_MULTIPLIER = 0.1;

// Chip Shot Constants
const CHIP_SHOT_UP_FORCE = 0.30;
const CHIP_SHOT_FORWARD_FORCE = 0.05;

const keysPressed = {};

// ===================================================================================
// Setup Function
// ===================================================================================
function setup() {
    console.log("Starting game setup...");
    console.log("Matter.js available:", typeof window.Matter);
    console.log("Canvas element:", mainCanvas);
    
    if (!window.Matter) {
        console.error("Matter.js is not loaded!");
        return;
    }
    
    if (!mainCanvas) {
        console.error("Canvas element not found!");
        return;
    }
    
    mainCanvas.width = CANVAS_WIDTH;
    mainCanvas.height = CANVAS_HEIGHT;

    lowResCanvas = document.createElement('canvas');
    lowResCanvas.width = CANVAS_WIDTH * PIXELATION_SCALE_FACTOR;
    lowResCanvas.height = CANVAS_HEIGHT * PIXELATION_SCALE_FACTOR;
    lowResCtx = lowResCanvas.getContext('2d');
    lowResCtx.imageSmoothingEnabled = false;

    // Create static background canvas
    staticBackgroundCanvas = document.createElement('canvas');
    staticBackgroundCanvas.width = lowResCanvas.width;
    staticBackgroundCanvas.height = lowResCanvas.height;
    staticBackgroundCtx = staticBackgroundCanvas.getContext('2d');
    // staticBackgroundCtx.imageSmoothingEnabled = false; // Not strictly necessary as we draw it once

    engine = Engine.create();
    world = engine.world;
    engine.gravity.y = 1.5;

    // افزایش تکرارهای حل کننده برای بهبود تشخیص برخورد
    engine.positionIterations = 8; // مقدار پیش فرض 6
    engine.velocityIterations = 6; // مقدار پیش فرض 4

    initRenderer(mainCanvas);

    createField();
    createPlayers();
    createBall();
    setupControls();
    setupCollisions();

    if (typeof window.initializeAI === "function" && players.length > 1 && ball && ball.velocity) {
        const gameConfigForAI = {
            CANVAS_WIDTH: CANVAS_WIDTH,
            CANVAS_HEIGHT: CANVAS_HEIGHT,
            PLAYER_WIDTH: PLAYER_WIDTH, // PLAYER_SIZE
            PLAYER_HEIGHT: PLAYER_HEIGHT, // PLAYER_SIZE
            JUMP_FORCE: JUMP_FORCE,
            MOVE_FORCE: MOVE_FORCE,
            AIR_MOVE_FORCE_MULTIPLIER: AIR_MOVE_FORCE_MULTIPLIER,
            BALL_RADIUS: BALL_RADIUS,
            FIELD_SURFACE_Y: FIELD_SURFACE_Y, // پاس دادن مقدار صحیح
            GOAL_HEIGHT: GOAL_HEIGHT,
            GOAL_WIDTH: GOAL_WIDTH,
            isGameOver: isGameOver // پاس دادن وضعیت اولیه
        };
        window.initializeAI(players[AI_PLAYER_INDEX], ball, engine, gameConfigForAI);
        console.log("AI initialized successfully with config");
    } else {
        console.error("AI could not be initialized.");
    }

    startGame();
    console.log("Game setup completed!");
}

// ===================================================================================
// Entity Creation Functions
// ===================================================================================
function createField() {
    const ground = Bodies.rectangle(CANVAS_WIDTH / 2, GROUND_Y, CANVAS_WIDTH, GROUND_THICKNESS, {
        isStatic: true,
        render: { fillStyle: '#228B22' },
        label: 'Rectangle Body'
    });
    const leftWall = Bodies.rectangle(-WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, render: { fillStyle: '#666666' } });
    const rightWall = Bodies.rectangle(CANVAS_WIDTH + WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, render: { fillStyle: '#666666' } });
    const ceiling = Bodies.rectangle(CANVAS_WIDTH / 2, -WALL_THICKNESS / 2, CANVAS_WIDTH, WALL_THICKNESS, { isStatic: true, render: { fillStyle: '#666666' } });

    const goalY = FIELD_SURFACE_Y - GOAL_HEIGHT / 2;

    const goal1Post = Bodies.rectangle(GOAL_POST_WIDTH / 2, goalY, GOAL_POST_WIDTH, GOAL_HEIGHT, {
        isStatic: true, render: { fillStyle: '#FFFFFF' }, label: "goalPost1",
        collisionFilter: { category: goalPostCategory, mask: playerCategory | ballCategory }
    });
    const goal1Sensor = Bodies.rectangle(GOAL_WIDTH / 2, goalY, GOAL_WIDTH, GOAL_HEIGHT, {
        isStatic: true, isSensor: true, label: 'goal1', render: { visible: false }
    });
    goals.team1 = [goal1Post, goal1Sensor];

    const goal2Post = Bodies.rectangle(CANVAS_WIDTH - GOAL_POST_WIDTH / 2, goalY, GOAL_POST_WIDTH, GOAL_HEIGHT, {
        isStatic: true, render: { fillStyle: '#FFFFFF' }, label: "goalPost2",
        collisionFilter: { category: goalPostCategory, mask: playerCategory | ballCategory }
    });
    const goal2Sensor = Bodies.rectangle(CANVAS_WIDTH - GOAL_WIDTH / 2, goalY, GOAL_WIDTH, GOAL_HEIGHT, {
        isStatic: true, isSensor: true, label: 'goal2', render: { visible: false }
    });
    goals.team2 = [goal2Post, goal2Sensor];
    
    World.add(world, [ground, leftWall, rightWall, ceiling, goal1Post, goal1Sensor, goal2Post, goal2Sensor]);
    console.log("Field created");
}

function createPlayers() {
    const playerStartY = 450 - 40;

    const player1Body = Bodies.rectangle(200, playerStartY, PLAYER_WIDTH, PLAYER_HEIGHT, {
        density: PLAYER_DENSITY, friction: PLAYER_FRICTION, restitution: PLAYER_RESTITUTION, label: 'player1',
        collisionFilter: { category: playerCategory, mask: worldCategory | ballCategory | goalPostCategory | playerCategory }
    });
    players.push({
        body: player1Body,
        team: 1,
        isGrounded: false,
        color: '#D9534F',
        chipShotAttempt: false,
        sKeyProcessed: false,
        kickCooldown: false
    });

    const player2Body = Bodies.rectangle(CANVAS_WIDTH - 200, playerStartY, PLAYER_WIDTH, PLAYER_HEIGHT, {
        density: PLAYER_DENSITY, friction: PLAYER_FRICTION, restitution: PLAYER_RESTITUTION, label: 'player2',
        collisionFilter: { category: playerCategory, mask: worldCategory | ballCategory | goalPostCategory | playerCategory }
    });
    players.push({
        body: player2Body,
        team: 2,
        isGrounded: false,
        color: '#428BCA',
        chipShotAttempt: false,
        kickCooldown: false
    });
    World.add(world, [player1Body, player2Body]);
    console.log("Players created");
}

function createBall() {
    ball = Bodies.circle(CANVAS_WIDTH / 2, 100, BALL_RADIUS, {
        restitution: 0.5,
        friction: 0.01,
        frictionAir: 0.01,
        density: 0.0015,
        label: 'ball',
        render: { sprite: { texture: null, xScale: 1, yScale: 1 } }
    });
    World.add(world, ball);
    console.log("Ball created");
}

// ===================================================================================
// Main Game Loop
// ===================================================================================
function gameLoop() {
    if (isGameOver) return;

    // Update game logic
    handlePlayerControls();

    if (typeof window.updateAI === "function" && !isGameOver) {
        window.updateAI(isGameOver);
    }

    // Render the game
    draw(mainCtx, world, players, gameTimeRemaining, ROUND_DURATION_SECONDS);

    requestAnimationFrame(gameLoop);
}

// ===================================================================================
// Event Handlers and Game Logic
// ===================================================================================
let audioInitialized = false;
function initializeAudio() {
    if (!audioInitialized) {
        audioManager.initAudioContext();
        audioInitialized = true;
    }
}

function setupControls() {
    window.addEventListener('keydown', (e) => {
        initializeAudio();
        const key = e.key.toLowerCase();
        keysPressed[key] = true;
    });
    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        keysPressed[key] = false;
        if (key === 's' && players.length > 0) {
            players[0].sKeyProcessed = false;
        }
    });
}

function setupCollisions() {
    Events.on(engine, 'collisionActive', (event) => {
        const pairs = event.pairs;
        for (const pair of pairs) {
            let playerBody, ballBody;
            if (pair.bodyA.label.startsWith('player') && pair.bodyB.label === 'ball') {
                playerBody = pair.bodyA; ballBody = pair.bodyB;
            } else if (pair.bodyB.label.startsWith('player') && pair.bodyA.label === 'ball') {
                playerBody = pair.bodyB; ballBody = pair.bodyA;
            }

            if (playerBody && ballBody) {
                const playerObject = players.find(p => p.body === playerBody);
                if (playerObject && !playerObject.kickCooldown && playerObject.chipShotAttempt) {
                    let kickDirection = (playerObject.team === 1) ? 1 : -1;
                    const forceX = kickDirection * CHIP_SHOT_FORWARD_FORCE;
                    const forceY = -CHIP_SHOT_UP_FORCE;
                    const chipForceVector = { x: forceX, y: forceY };
                    const forceApplicationPoint = { x: ballBody.position.x, y: ballBody.position.y + BALL_RADIUS * 0.3 };
                    
                    Body.applyForce(ballBody, forceApplicationPoint, chipForceVector);
                    audioManager.playSound('kick');

                    playerObject.chipShotAttempt = false;
                    
                    if (playerObject.body.label === 'player1') {
                         playerObject.sKeyProcessed = true;
                    }

                    playerObject.kickCooldown = true;
                    setTimeout(() => {
                        if (playerObject) playerObject.kickCooldown = false;
                    }, 500);
                }
            }
        }
    });

    Events.on(engine, 'collisionStart', (event) => {
        for (const pair of event.pairs) {
            const { bodyA, bodyB } = pair;

            if ((bodyA.label === 'ball' && bodyB.label === 'goal2') || (bodyB.label === 'ball' && bodyA.label === 'goal2')) {
                handleGoalScored(1);
            } else if ((bodyA.label === 'ball' && bodyB.label === 'goal1') || (bodyB.label === 'ball' && bodyA.label === 'goal1')) {
                handleGoalScored(2);
            }

            players.forEach(p => {
                 if ((bodyA === p.body && bodyB.label === 'Rectangle Body') || (bodyB === p.body && bodyA.label === 'Rectangle Body')) {
                     p.isGrounded = true;
                 }
            });

            if ((bodyA.label === 'ball' && bodyB.label === 'Rectangle Body') || (bodyB.label === 'ball' && bodyA.label === 'Rectangle Body')) {
                const currentBallBody = bodyA.label === 'ball' ? bodyA : bodyB;
                createImpactParticles(currentBallBody.position.x, currentBallBody.position.y + currentBallBody.circleRadius);
                audioManager.playSound('bounce');
            }

            if ((bodyA.label === 'ball' && bodyB.isStatic && bodyB.label !== 'Rectangle Body' && !bodyB.label?.startsWith('goal')) ||
                (bodyB.label === 'ball' && bodyA.isStatic && bodyA.label !== 'Rectangle Body' && !bodyA.label?.startsWith('goal'))) {
                audioManager.playSound('bounce');
            }

            if ((bodyA.label === 'ball' && (bodyB.label === 'goalPost1' || bodyB.label === 'goalPost2')) ||
                (bodyB.label === 'ball' && (bodyA.label === 'goalPost1' || bodyA.label === 'goalPost2'))) {
                triggerScreenShake(5, 15);
                audioManager.playSound('bounce');
            }
        }
    });
}

function handlePlayerControls() {
    if (players.length === 0) return;
    const p1 = players[0];
    const currentMoveForce = p1.isGrounded ? MOVE_FORCE : MOVE_FORCE * AIR_MOVE_FORCE_MULTIPLIER;

    if (keysPressed['a']) Body.applyForce(p1.body, p1.body.position, { x: -currentMoveForce, y: 0 });
    if (keysPressed['d']) Body.applyForce(p1.body, p1.body.position, { x: currentMoveForce, y: 0 });
    
    if (keysPressed['w'] && p1.isGrounded) {
        Body.applyForce(p1.body, p1.body.position, { x: 0, y: -JUMP_FORCE });
        p1.isGrounded = false;
        audioManager.playSound('jump');
    }
    
    if (keysPressed['s'] && !p1.sKeyProcessed && !p1.kickCooldown) {
        p1.chipShotAttempt = true;
        p1.sKeyProcessed = true;
    }
}

let goalScoredThisTick = false;
function handleGoalScored(scoringTeam) {
    if (isGameOver || goalScoredThisTick) return;
    goalScoredThisTick = true;
    
    audioManager.playSound('goal');

    if (Math.random() < 0.20) {
        triggerScreenShake(5, 15);
        let bounceXVelocity = (scoringTeam === 1) ? -(3 + Math.random() * 2) : (3 + Math.random() * 2);
        const bounceYVelocity = -(2 + Math.random() * 2);
        Body.setVelocity(ball, { x: bounceXVelocity, y: bounceYVelocity });
        Body.setAngularVelocity(ball, (Math.random() - 0.5) * 0.2);
        gameMessageDisplay.textContent = "تیرک!";
        gameMessageDisplay.classList.add('has-text');
        setTimeout(() => {
            if (gameMessageDisplay.textContent === "تیرک!") {
                gameMessageDisplay.textContent = "";
                gameMessageDisplay.classList.remove('has-text');
            }
            goalScoredThisTick = false;
        }, 1000);
        return;
    }

    if (scoringTeam === 1) {
        team1Score++;
        team1ScoreDisplay.textContent = `Team 1: ${team1Score}`;
    } else {
        team2Score++;
        team2ScoreDisplay.textContent = `Team 2: ${team2Score}`;
    }
    gameMessageDisplay.textContent = "گل!";
    gameMessageDisplay.classList.add('has-text');
    
    setTimeout(() => {
        resetPositions();
        if (gameMessageDisplay.textContent === "گل!") {
             gameMessageDisplay.textContent = "";
             gameMessageDisplay.classList.remove('has-text');
        }
        goalScoredThisTick = false;
    }, 50);
}

function resetPositions() {
    Body.setPosition(players[0].body, { x: 200, y: 450 });
    Body.setVelocity(players[0].body, { x: 0, y: 0 });
    Body.setAngle(players[0].body, 0);
    Body.setPosition(players[1].body, { x: 600, y: 450 });
    Body.setVelocity(players[1].body, { x: 0, y: 0 });
    Body.setAngle(players[1].body, 0);
    Body.setPosition(ball, { x: CANVAS_WIDTH / 2, y: 100 });
    Body.setVelocity(ball, { x: 0, y: 0 });

    if (typeof window.resetAIState === "function") {
        window.resetAIState();
    }
}

function startGame() {
    runner = Runner.create();
    Runner.run(runner, engine);
    roundTimerId = setInterval(() => {
        gameTimeRemaining--;
        timerDisplay.textContent = `Time: ${gameTimeRemaining}`;
        if (gameTimeRemaining <= 0) {
            endGame();
        }
    }, 1000);
    gameLoop();
}

function endGame() {
    clearInterval(roundTimerId);
    isGameOver = true;
    Runner.stop(runner);
    let winnerMessage = "مساوی!";
    if (team1Score > team2Score) winnerMessage = "تیم قرمز برنده شد!";
    if (team2Score > team1Score) winnerMessage = "تیم آبی برنده شد!";
    gameMessageDisplay.textContent = `پایان بازی! ${winnerMessage}`;
    gameMessageDisplay.classList.add('has-text');
}

export { setup };
