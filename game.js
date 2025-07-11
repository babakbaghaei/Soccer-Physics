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

// --- Pixelation / Low-Resolution Rendering ---
const PIXELATION_SCALE_FACTOR = 0.25;
let lowResCanvas;
let lowResCtx;

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

    engine = Engine.create();
    world = engine.world;
    engine.gravity.y = 1.5;

    // افزایش تکرارهای حل کننده برای بهبود تشخیص برخورد
    engine.positionIterations = 8; // مقدار پیش فرض 6
    engine.velocityIterations = 6; // مقدار پیش فرض 4

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
// Drawing Functions
// ===================================================================================
let cloudPositions = [
    { x: 150, y: 120, width: 80, height: 30, speed: 0.3 },
    { x: 400, y: 80, width: 100, height: 40, speed: 0.2 },
    { x: 650, y: 150, width: 70, height: 25, speed: 0.4 }
];

function drawSimplifiedSun(targetCtx, x_scaled, y_scaled, radius_scaled) {
    targetCtx.fillStyle = '#FFD700';
    targetCtx.beginPath();
    targetCtx.arc(x_scaled, y_scaled, radius_scaled, 0, Math.PI * 2);
    targetCtx.fill();
}

function drawSimplifiedCloud(targetCtx, x_scaled, y_scaled, width_scaled, height_scaled) {
    targetCtx.fillStyle = '#FFFFFF';
    const baseCircleRadius = height_scaled * 0.6;
    targetCtx.beginPath();
    targetCtx.arc(x_scaled + width_scaled * 0.25, y_scaled + height_scaled * 0.5, baseCircleRadius * 0.8, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.beginPath();
    targetCtx.arc(x_scaled + width_scaled * 0.5, y_scaled + height_scaled * 0.4, baseCircleRadius, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.beginPath();
    targetCtx.arc(x_scaled + width_scaled * 0.75, y_scaled + height_scaled * 0.55, baseCircleRadius * 0.9, 0, Math.PI * 2);
    targetCtx.fill();
}

function drawDynamicSky(targetCtx) {
    const gameProgress = (ROUND_DURATION_SECONDS - gameTimeRemaining) / ROUND_DURATION_SECONDS;
    let sunWorldX = 50 + gameProgress * (CANVAS_WIDTH - 100);
    let sunWorldY = 80 + Math.sin(gameProgress * Math.PI) * 40;
    let sunWorldRadius = 25;

    drawSimplifiedSun(targetCtx,
        sunWorldX * PIXELATION_SCALE_FACTOR,
        sunWorldY * PIXELATION_SCALE_FACTOR,
        sunWorldRadius * PIXELATION_SCALE_FACTOR
    );

    cloudPositions.forEach(cloud => {
        cloud.x += cloud.speed;
        if (cloud.x > CANVAS_WIDTH + cloud.width) {
            cloud.x = -cloud.width;
            cloud.y = 50 + Math.random() * 100;
        }
        drawSimplifiedCloud(targetCtx,
            cloud.x * PIXELATION_SCALE_FACTOR,
            cloud.y * PIXELATION_SCALE_FACTOR,
            cloud.width * PIXELATION_SCALE_FACTOR,
            cloud.height * PIXELATION_SCALE_FACTOR
        );
    });
}

function drawSimplifiedNet(targetCtx, x_scaled, y_scaled, width_scaled, height_scaled) {
    targetCtx.strokeStyle = 'rgba(220, 220, 220, 0.7)';
    targetCtx.lineWidth = Math.max(1, Math.floor(2 * PIXELATION_SCALE_FACTOR));
    const spacing_scaled = Math.max(2, Math.floor(15 * PIXELATION_SCALE_FACTOR));

    for (let i = 0; i <= width_scaled; i += spacing_scaled) {
        targetCtx.beginPath();
        targetCtx.moveTo(x_scaled + i, y_scaled);
        targetCtx.lineTo(x_scaled + i, y_scaled + height_scaled);
        targetCtx.stroke();
    }
    for (let j = 0; j <= height_scaled; j += spacing_scaled) {
        targetCtx.beginPath();
        targetCtx.moveTo(x_scaled, y_scaled + j);
        targetCtx.lineTo(x_scaled + width_scaled, y_scaled + j);
        targetCtx.stroke();
    }
}

function drawSimplifiedSoccerBall(targetCtx, body) {
    const x_scaled = body.position.x * PIXELATION_SCALE_FACTOR;
    const y_scaled = body.position.y * PIXELATION_SCALE_FACTOR;
    const radius_scaled = body.circleRadius * PIXELATION_SCALE_FACTOR;

    targetCtx.fillStyle = 'white';
    targetCtx.beginPath();
    targetCtx.arc(x_scaled, y_scaled, radius_scaled, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.fillStyle = 'black';
    targetCtx.beginPath();
    const angle = body.angle;
    targetCtx.moveTo(x_scaled, y_scaled);
    targetCtx.arc(x_scaled, y_scaled, radius_scaled, angle, angle + Math.PI / 3);
    targetCtx.closePath();
    targetCtx.fill();

    targetCtx.strokeStyle = 'black';
    targetCtx.lineWidth = Math.max(1, Math.floor(1 * PIXELATION_SCALE_FACTOR));
    targetCtx.beginPath();
    targetCtx.arc(x_scaled, y_scaled, radius_scaled, 0, Math.PI * 2);
    targetCtx.stroke();
}

// ===================================================================================
// Particle System
// ===================================================================================
let particles = [];

function createImpactParticles(x, y, count = 5, color = '#A0522D') {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI - Math.PI;
        const speed = Math.random() * 2 + 1;
        particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed * 0.5,
            life: Math.random() * 30 + 30,
            size: Math.random() * 2 + 1,
            color: color
        });
    }
}

function updateAndDrawParticles(targetCtx) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life--;

        if (p.life <= 0) {
            particles.splice(i, 1);
        } else {
            targetCtx.fillStyle = p.color;
            targetCtx.fillRect(
                p.x * PIXELATION_SCALE_FACTOR - (p.size * PIXELATION_SCALE_FACTOR / 2),
                p.y * PIXELATION_SCALE_FACTOR - (p.size * PIXELATION_SCALE_FACTOR / 2),
                p.size * PIXELATION_SCALE_FACTOR,
                p.size * PIXELATION_SCALE_FACTOR
            );
        }
    }
}

// ===================================================================================
// Screen Shake
// ===================================================================================
let isShaking = false;
let shakeMagnitude = 0;
let shakeDuration = 0;
let shakeTimer = 0;
let shakeOffsetX = 0;
let shakeOffsetY = 0;

function triggerScreenShake(magnitude, duration) {
    isShaking = true;
    shakeMagnitude = magnitude * PIXELATION_SCALE_FACTOR;
    shakeDuration = duration;
    shakeTimer = duration;
}

// ===================================================================================
// Field Markings
// ===================================================================================
function drawFootballFieldLines(ctx) {
    const scale = PIXELATION_SCALE_FACTOR;
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(2, Math.floor(4 * scale));

    // Center line
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2 * scale, FIELD_SURFACE_Y * scale);
    ctx.lineTo(CANVAS_WIDTH / 2 * scale, CANVAS_HEIGHT * scale);
    ctx.stroke();

    // Center circle
    const centerCircleRadius = 30 * scale;
    const circleCenterY_scaled = (FIELD_SURFACE_Y * scale + CANVAS_HEIGHT * scale) / 2;
    const circleCenterX_scaled = CANVAS_WIDTH / 2 * scale;
    ctx.beginPath();
    ctx.arc(circleCenterX_scaled, circleCenterY_scaled, centerCircleRadius, 0, 2 * Math.PI);
    ctx.stroke();

    const penaltyAreaDepth_world = 30;
    const penaltyAreaLength_world = 120;
    const goalBoxDepth_world = 15;
    const goalBoxLength_world = 60;

    // Penalty Boxes
    const penaltyBoxScaledY = FIELD_SURFACE_Y * scale;
    const penaltyAreaDepthScaled = penaltyAreaDepth_world * scale;
    const penaltyAreaLengthScaled = penaltyAreaLength_world * scale;
    ctx.strokeRect(0, penaltyBoxScaledY, penaltyAreaLengthScaled, penaltyAreaDepthScaled);
    ctx.strokeRect((CANVAS_WIDTH * scale) - penaltyAreaLengthScaled, penaltyBoxScaledY, penaltyAreaLengthScaled, penaltyAreaDepthScaled);

    // Goal Boxes
    const goalBoxScaledY = FIELD_SURFACE_Y * scale;
    const goalBoxDepthScaled = goalBoxDepth_world * scale;
    const goalBoxLengthScaled = goalBoxLength_world * scale;
    ctx.strokeRect(0, goalBoxScaledY, goalBoxLengthScaled, goalBoxDepthScaled);
    ctx.strokeRect((CANVAS_WIDTH * scale) - goalBoxLengthScaled, goalBoxScaledY, goalBoxLengthScaled, goalBoxDepthScaled);
    
    // Penalty spots
    const penaltySpotY = (FIELD_SURFACE_Y + (CANVAS_HEIGHT - FIELD_SURFACE_Y) / 2);
    const penaltySpotRadius = 5 * scale;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(80 * scale, penaltySpotY * scale, penaltySpotRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc((CANVAS_WIDTH - 80) * scale, penaltySpotY * scale, penaltySpotRadius, 0, 2 * Math.PI);
    ctx.fill();

    // Corner arcs
    const cornerArcRadius = 12 * scale;
    ctx.beginPath();
    ctx.arc(0, FIELD_SURFACE_Y * scale, cornerArcRadius, 0, 0.5 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, CANVAS_HEIGHT * scale, cornerArcRadius, 1.5 * Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH * scale, FIELD_SURFACE_Y * scale, cornerArcRadius, 0.5 * Math.PI, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH * scale, CANVAS_HEIGHT * scale, cornerArcRadius, Math.PI, 1.5 * Math.PI);
    ctx.stroke();
    
    ctx.restore();
}

// ===================================================================================
// Main Draw Loop
// ===================================================================================
function draw() {
    if (isGameOver) return;

    if (isShaking) {
        shakeOffsetX = (Math.random() - 0.5) * shakeMagnitude * 2;
        shakeOffsetY = (Math.random() - 0.5) * shakeMagnitude * 2;
        shakeTimer--;
        if (shakeTimer <= 0) {
            isShaking = false;
            shakeOffsetX = 0;
            shakeOffsetY = 0;
        }
    } else {
        shakeOffsetX = 0;
        shakeOffsetY = 0;
    }

    lowResCtx.save();
    lowResCtx.translate(shakeOffsetX, shakeOffsetY);

    lowResCtx.clearRect(0, 0, lowResCanvas.width, lowResCanvas.height);
    lowResCtx.fillStyle = "#87CEEB";
    lowResCtx.fillRect(0, 0, lowResCanvas.width, lowResCanvas.height);
    drawDynamicSky(lowResCtx);

    const grassStartY_scaled = FIELD_SURFACE_Y * PIXELATION_SCALE_FACTOR;
    const grassHeight_scaled = (CANVAS_HEIGHT - FIELD_SURFACE_Y) * PIXELATION_SCALE_FACTOR;
    const STRIPE_WIDTH_WORLD = 50;
    const stripeWidth_scaled = STRIPE_WIDTH_WORLD * PIXELATION_SCALE_FACTOR;
    const GRASS_COLOR_DARK = "#228B22";
    const GRASS_COLOR_LIGHT = "#32CD32";

    for (let x_stripe = 0; x_stripe < lowResCanvas.width; x_stripe += stripeWidth_scaled) {
        const currentStripeWidth = Math.min(stripeWidth_scaled, lowResCanvas.width - x_stripe);
        lowResCtx.fillStyle = (Math.floor(x_stripe / stripeWidth_scaled) % 2 === 0) ? GRASS_COLOR_DARK : GRASS_COLOR_LIGHT;
        lowResCtx.fillRect(x_stripe, grassStartY_scaled, currentStripeWidth, grassHeight_scaled);
    }
    drawFootballFieldLines(lowResCtx);

    drawSimplifiedNet(lowResCtx, 0, (FIELD_SURFACE_Y - GOAL_HEIGHT) * PIXELATION_SCALE_FACTOR, GOAL_WIDTH * PIXELATION_SCALE_FACTOR, GOAL_HEIGHT * PIXELATION_SCALE_FACTOR);
    drawSimplifiedNet(lowResCtx, (CANVAS_WIDTH - GOAL_WIDTH) * PIXELATION_SCALE_FACTOR, (FIELD_SURFACE_Y - GOAL_HEIGHT) * PIXELATION_SCALE_FACTOR, GOAL_WIDTH * PIXELATION_SCALE_FACTOR, GOAL_HEIGHT * PIXELATION_SCALE_FACTOR);

    const allBodies = Composite.allBodies(world);
    allBodies.forEach(body => {
        if (body.render && body.render.visible === false) return;
        
        lowResCtx.beginPath();
        const vertices = body.vertices;
        lowResCtx.moveTo(vertices[0].x * PIXELATION_SCALE_FACTOR, vertices[0].y * PIXELATION_SCALE_FACTOR);
        for (let j = 1; j < vertices.length; j++) {
            lowResCtx.lineTo(vertices[j].x * PIXELATION_SCALE_FACTOR, vertices[j].y * PIXELATION_SCALE_FACTOR);
        }
        lowResCtx.closePath();

        if (body.label.startsWith('player')) {
            const player = players.find(p => p.body === body);
            lowResCtx.fillStyle = player.color;
            lowResCtx.fill();
        } else if (body.label === 'ball') {
            drawSimplifiedSoccerBall(lowResCtx, body);
        } else if (body.isStatic) {
            lowResCtx.fillStyle = (body.render && body.render.fillStyle) ? body.render.fillStyle : '#CCC';
            if (!(body.label === 'Rectangle Body' && body.position.y > (GROUND_Y - GROUND_THICKNESS) && body.area >= (CANVAS_WIDTH * GROUND_THICKNESS * 0.8))) {
                lowResCtx.fill();
            }
        }
        
        if (!body.isSensor && body.label !== 'ball') {
            lowResCtx.lineWidth = Math.max(1, Math.floor(2 * PIXELATION_SCALE_FACTOR));
            lowResCtx.strokeStyle = '#000000';
            lowResCtx.stroke();
        }
    });

    updateAndDrawParticles(lowResCtx);

    lowResCtx.restore();

    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    mainCtx.imageSmoothingEnabled = false;
    mainCtx.drawImage(
        lowResCanvas,
        0, 0, lowResCanvas.width, lowResCanvas.height,
        0, 0, mainCanvas.width, mainCanvas.height
    );

    handlePlayerControls();

    if (typeof window.updateAI === "function" && !isGameOver) { // پاس دادن وضعیت فعلی isGameOver
        window.updateAI(isGameOver); // ارسال وضعیت فعلی isGameOver
    }

    requestAnimationFrame(draw);
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
    draw();
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

window.addEventListener('DOMContentLoaded', setup);
