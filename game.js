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

// --- PowerUp System ---
let powerUps = [];
let powerUpSpawnTimer = 0;
const POWERUP_SPAWN_INTERVAL = 10000; // 10 ثانیه

const POWERUP_TYPES = {
    SPEED: { color: '#00FF00', effect: 'speed', duration: 5000 },
    JUMP: { color: '#0099FF', effect: 'jump', duration: 5000 },
    KICK: { color: '#FF9900', effect: 'kick', duration: 5000 }
};

// --- Field Constants ---
const ORIGINAL_GROUND_THICKNESS = 40;
const NEW_GROUND_THICKNESS = ORIGINAL_GROUND_THICKNESS * 2;
const NEW_FIELD_SURFACE_Y = (580 - ORIGINAL_GROUND_THICKNESS / 2) - ORIGINAL_GROUND_THICKNESS;
const NEW_GROUND_Y_PHYSICS_CENTER = NEW_FIELD_SURFACE_Y + NEW_GROUND_THICKNESS / 2;

const GROUND_Y = NEW_GROUND_Y_PHYSICS_CENTER;
const GROUND_THICKNESS = NEW_GROUND_THICKNESS;
const FIELD_SURFACE_Y = NEW_FIELD_SURFACE_Y;

const WALL_THICKNESS = 40;
const GOAL_HEIGHT = 80; // ارتفاع کمتر دروازه
const GOAL_WIDTH = 200; // عرض دروازه مثل زمین واقعی
const GOAL_POST_WIDTH = 6;


// --- Player Constants ---
const PLAYER_FRICTION = 0.8;
const PLAYER_RESTITUTION = 0.1;
const PLAYER_DENSITY = 0.003;
const PLAYER_SIZE = 40;
const PLAYER_WIDTH = PLAYER_SIZE;
const PLAYER_HEIGHT = PLAYER_SIZE;
const JUMP_FORCE = 0.11; // پرش کمتر
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

    createField();
    createPlayers();
    createBall();
    setupControls();
    setupCollisions();
    initializePowerUpSystem();

    if (typeof window.initializeAI === "function" && players.length > 1 && ball && ball.velocity) {
        window.initializeAI(players[AI_PLAYER_INDEX], ball, engine);
        console.log("AI initialized successfully");
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
    // زمین فیزیکی نامرئی - فقط برای فیزیک
    const invisibleGround = Bodies.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10, CANVAS_WIDTH, 20, {
        isStatic: true,
        render: { visible: false }, // نامرئی
        label: 'InvisibleGround'
    });
    const leftWall = Bodies.rectangle(-WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, render: { fillStyle: '#666666' } });
    const rightWall = Bodies.rectangle(CANVAS_WIDTH + WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, render: { fillStyle: '#666666' } });
    const ceiling = Bodies.rectangle(CANVAS_WIDTH / 2, -WALL_THICKNESS / 2, CANVAS_WIDTH, WALL_THICKNESS, { isStatic: true, render: { fillStyle: '#666666' } });

    const goalY = FIELD_SURFACE_Y - GOAL_HEIGHT / 2;

    // دروازه سمت چپ - تیم 1 (وسط چپ)
    const goal1CenterY = (FIELD_SURFACE_Y + CANVAS_HEIGHT) / 2;
    const goal1Post = Bodies.rectangle(0, goal1CenterY, GOAL_POST_WIDTH, GOAL_HEIGHT, {
        isStatic: true, render: { fillStyle: '#FFFFFF' }, label: "goalPost1",
        collisionFilter: { category: goalPostCategory, mask: playerCategory | ballCategory }
    });
    const goal1Sensor = Bodies.rectangle(30, goal1CenterY, 60, GOAL_HEIGHT, {
        isStatic: true, isSensor: true, label: 'goal1', render: { visible: false }
    });
    goals.team1 = [goal1Post, goal1Sensor];

    // دروازه سمت راست - تیم 2 (وسط راست)
    const goal2CenterY = (FIELD_SURFACE_Y + CANVAS_HEIGHT) / 2;
    const goal2Post = Bodies.rectangle(CANVAS_WIDTH, goal2CenterY, GOAL_POST_WIDTH, GOAL_HEIGHT, {
        isStatic: true, render: { fillStyle: '#FFFFFF' }, label: "goalPost2",
        collisionFilter: { category: goalPostCategory, mask: playerCategory | ballCategory }
    });
    const goal2Sensor = Bodies.rectangle(CANVAS_WIDTH - 30, goal2CenterY, 60, GOAL_HEIGHT, {
        isStatic: true, isSensor: true, label: 'goal2', render: { visible: false }
    });
    goals.team2 = [goal2Post, goal2Sensor];
    
    World.add(world, [invisibleGround, leftWall, rightWall, ceiling, goal1Post, goal1Sensor, goal2Post, goal2Sensor]);
    console.log("Field created");
}

function createPlayers() {
    // وسط چمن به صورت عمودی
    const playerStartY = (FIELD_SURFACE_Y + CANVAS_HEIGHT) / 2 - 50;

    // بازیکن 1 - وسط نیمه چپ
    const player1Body = Bodies.rectangle(CANVAS_WIDTH / 4, playerStartY, PLAYER_WIDTH, PLAYER_HEIGHT, {
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
        kickCooldown: false,
        speedMultiplier: 1,
        jumpMultiplier: 1,
        kickMultiplier: 1,
        activePowerUp: null,
        powerUpEndTime: null
    });

    // بازیکن 2 - وسط نیمه راست
    const player2Body = Bodies.rectangle((CANVAS_WIDTH * 3) / 4, playerStartY, PLAYER_WIDTH, PLAYER_HEIGHT, {
        density: PLAYER_DENSITY, friction: PLAYER_FRICTION, restitution: PLAYER_RESTITUTION, label: 'player2',
        collisionFilter: { category: playerCategory, mask: worldCategory | ballCategory | goalPostCategory | playerCategory }
    });
    players.push({
        body: player2Body,
        team: 2,
        isGrounded: false,
        color: '#428BCA',
        chipShotAttempt: false,
        kickCooldown: false,
        speedMultiplier: 1,
        jumpMultiplier: 1,
        kickMultiplier: 1,
        activePowerUp: null,
        powerUpEndTime: null
    });
    World.add(world, [player1Body, player2Body]);
    console.log("Players created");
}

function createBall() {
    const ballStartY = (FIELD_SURFACE_Y + CANVAS_HEIGHT) / 2 - 100;
    ball = Bodies.circle(CANVAS_WIDTH / 2, ballStartY, BALL_RADIUS, {
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
// PowerUp System
// ===================================================================================
function initializePowerUpSystem() {
    powerUps = [];
    powerUpSpawnTimer = Date.now();
    console.log("PowerUp system initialized");
}

function createRandomPowerUp() {
    if (powerUps.length >= 2) return; // حداکثر 2 powerup همزمان
    
    const types = Object.keys(POWERUP_TYPES);
    const randomType = types[Math.floor(Math.random() * types.length)];
    const typeData = POWERUP_TYPES[randomType];
    
    const x = 100 + Math.random() * (CANVAS_WIDTH - 200); // جای تصادفی
    const centerY = (FIELD_SURFACE_Y + CANVAS_HEIGHT) / 2;
    const y = centerY + Math.random() * 30 - 15; // در وسط چمن
    
    const powerUpBody = Bodies.circle(x, y, 15, {
        isSensor: true,
        isStatic: true,
        label: `powerup_${randomType}`,
        render: { fillStyle: typeData.color }
    });
    
    const powerUp = {
        body: powerUpBody,
        type: randomType,
        typeData: typeData,
        createdAt: Date.now()
    };
    
    powerUps.push(powerUp);
    World.add(world, powerUpBody);
    console.log(`PowerUp ${randomType} created at (${x.toFixed(0)}, ${y.toFixed(0)})`);
}

function updatePowerUps() {
    const now = Date.now();
    
    // اسپان powerup جدید
    if (now - powerUpSpawnTimer > POWERUP_SPAWN_INTERVAL) {
        createRandomPowerUp();
        powerUpSpawnTimer = now;
    }
    
    // حذف powerup های قدیمی
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        if (now - powerUp.createdAt > 20000) { // 20 ثانیه عمر
            World.remove(world, powerUp.body);
            powerUps.splice(i, 1);
        }
    }
}

function drawPowerUps(targetCtx) {
    powerUps.forEach(powerUp => {
        const x_scaled = powerUp.body.position.x * PIXELATION_SCALE_FACTOR;
        const y_scaled = powerUp.body.position.y * PIXELATION_SCALE_FACTOR;
        const radius_scaled = 15 * PIXELATION_SCALE_FACTOR;
        
        // کشیدن powerup با انیمیشن
        const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
        targetCtx.fillStyle = powerUp.typeData.color;
        targetCtx.globalAlpha = pulse;
        targetCtx.beginPath();
        targetCtx.arc(x_scaled, y_scaled, radius_scaled, 0, Math.PI * 2);
        targetCtx.fill();
        
        // نماد کوچک در وسط
        targetCtx.fillStyle = '#FFFFFF';
        targetCtx.globalAlpha = 1;
        targetCtx.font = `${Math.floor(12 * PIXELATION_SCALE_FACTOR)}px Arial`;
        targetCtx.textAlign = 'center';
        const symbol = powerUp.type === 'SPEED' ? '⚡' : powerUp.type === 'JUMP' ? '⬆' : '⚽';
        targetCtx.fillText(symbol, x_scaled, y_scaled + 4 * PIXELATION_SCALE_FACTOR);
        targetCtx.globalAlpha = 1;
    });
}

function applyPowerUpToPlayer(player, powerUpType) {
    const now = Date.now();
    
    // حذف اثر powerup قبلی اگر وجود داشته باشد
    if (player.powerUpEndTime && now < player.powerUpEndTime) {
        removePowerUpEffect(player);
    }
    
    player.activePowerUp = powerUpType;
    player.powerUpEndTime = now + POWERUP_TYPES[powerUpType].duration;
    
    // اعمال اثر
    switch(powerUpType) {
        case 'SPEED':
            player.speedMultiplier = 2;
            break;
        case 'JUMP':
            player.jumpMultiplier = 1.5;
            break;
        case 'KICK':
            player.kickMultiplier = 1.8;
            break;
    }
    
    console.log(`PowerUp ${powerUpType} applied to ${player.body.label}`);
}

function removePowerUpEffect(player) {
    if (player.activePowerUp) {
        player.speedMultiplier = 1;
        player.jumpMultiplier = 1;
        player.kickMultiplier = 1;
        player.activePowerUp = null;
        player.powerUpEndTime = null;
    }
}

function updatePlayerPowerUps() {
    const now = Date.now();
    players.forEach(player => {
        if (player.powerUpEndTime && now >= player.powerUpEndTime) {
            removePowerUpEffect(player);
        }
    });
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

    // محوطه جریمه بزرگ - وسط زمین و کامل
    const penaltyAreaDepth_world = 80;
    const penaltyAreaLength_world = 150;
    const goalBoxDepth_world = 25;
    const goalBoxLength_world = 80;

    // محوطه جریمه بزرگ - وسط صفحه
    const penaltyBoxScaledY = FIELD_SURFACE_Y * scale;
    const penaltyAreaDepthScaled = penaltyAreaDepth_world * scale;
    const penaltyAreaLengthScaled = penaltyAreaLength_world * scale;
    
    // محوطه جریمه سمت چپ - در وسط
    const leftPenaltyX = 0;
    const leftPenaltyY = penaltyBoxScaledY + ((CANVAS_HEIGHT - FIELD_SURFACE_Y) * scale - penaltyAreaDepthScaled) / 2;
    ctx.strokeRect(leftPenaltyX, leftPenaltyY, penaltyAreaLengthScaled, penaltyAreaDepthScaled);
    
    // محوطه جریمه سمت راست - در وسط
    const rightPenaltyX = (CANVAS_WIDTH * scale) - penaltyAreaLengthScaled;
    const rightPenaltyY = penaltyBoxScaledY + ((CANVAS_HEIGHT - FIELD_SURFACE_Y) * scale - penaltyAreaDepthScaled) / 2;
    ctx.strokeRect(rightPenaltyX, rightPenaltyY, penaltyAreaLengthScaled, penaltyAreaDepthScaled);

    // محوطه کوچک دروازه
    const goalBoxDepthScaled = goalBoxDepth_world * scale;
    const goalBoxLengthScaled = goalBoxLength_world * scale;
    
    // محوطه کوچک سمت چپ - در وسط
    const leftGoalBoxY = penaltyBoxScaledY + ((CANVAS_HEIGHT - FIELD_SURFACE_Y) * scale - goalBoxDepthScaled) / 2;
    ctx.strokeRect(0, leftGoalBoxY, goalBoxLengthScaled, goalBoxDepthScaled);
    
    // محوطه کوچک سمت راست - در وسط  
    const rightGoalBoxX = (CANVAS_WIDTH * scale) - goalBoxLengthScaled;
    const rightGoalBoxY = penaltyBoxScaledY + ((CANVAS_HEIGHT - FIELD_SURFACE_Y) * scale - goalBoxDepthScaled) / 2;
    ctx.strokeRect(rightGoalBoxX, rightGoalBoxY, goalBoxLengthScaled, goalBoxDepthScaled);
    
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

    // چمن تصویری - از FIELD_SURFACE_Y تا پایین
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
            // فقط اجسام مرئی را رسم کن
            if (body.render && body.render.visible !== false) {
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
    
    // رسم powerup ها
    drawPowerUps(lowResCtx);

    // --- دروازه‌های سه‌بعدی را بعد از همه اجسام رسم کن تا توپ و بازیکن زیر آن دیده شوند ---
    // دو دروازه سه‌بعدی گوشه چپ و راست پایین زمین (تونلی)
    const goalW = PLAYER_WIDTH * PIXELATION_SCALE_FACTOR;
    const goalH = 70 * PIXELATION_SCALE_FACTOR;
    const postW = 8 * PIXELATION_SCALE_FACTOR;
    const depth = 40 * PIXELATION_SCALE_FACTOR;
    const barHeight = 35 * PIXELATION_SCALE_FACTOR;
    // دروازه چپ
    const leftXf = -goalW/2, leftYf = (CANVAS_HEIGHT - 5) * PIXELATION_SCALE_FACTOR - goalH;
    const leftXb = leftXf + depth + 3 * PIXELATION_SCALE_FACTOR, leftYb = leftYf - barHeight;
    lowResCtx.save();
    lowResCtx.strokeStyle = '#fff';
    lowResCtx.lineWidth = postW;
    lowResCtx.beginPath();
    lowResCtx.moveTo(leftXf, leftYf + goalH);
    lowResCtx.lineTo(leftXf, leftYf);
    lowResCtx.moveTo(leftXf + goalW, leftYf + goalH);
    lowResCtx.lineTo(leftXf + goalW, leftYf);
    lowResCtx.stroke();
    lowResCtx.beginPath();
    lowResCtx.moveTo(leftXb, leftYb + goalH);
    lowResCtx.lineTo(leftXb, leftYb);
    lowResCtx.moveTo(leftXb + goalW, leftYb + goalH);
    lowResCtx.lineTo(leftXb + goalW, leftYb);
    lowResCtx.stroke();
    lowResCtx.beginPath();
    lowResCtx.moveTo(leftXf, leftYf);
    lowResCtx.lineTo(leftXf + goalW, leftYf);
    lowResCtx.moveTo(leftXb, leftYb);
    lowResCtx.lineTo(leftXb + goalW, leftYb);
    lowResCtx.stroke();
    lowResCtx.beginPath();
    lowResCtx.moveTo(leftXf, leftYf);
    lowResCtx.lineTo(leftXb, leftYb);
    lowResCtx.moveTo(leftXf + goalW, leftYf);
    lowResCtx.lineTo(leftXb + goalW, leftYb);
    lowResCtx.stroke();
    lowResCtx.strokeStyle = 'rgba(220,220,220,0.7)';
    for(let i=0;i<=5;i++){
      let t = i/5;
      lowResCtx.beginPath();
      lowResCtx.moveTo(leftXf + t*goalW, leftYf);
      lowResCtx.lineTo(leftXb + t*goalW, leftYb);
      lowResCtx.stroke();
    }
    for(let i=1;i<5;i++){
      let t = i/5;
      lowResCtx.beginPath();
      lowResCtx.moveTo(leftXf, leftYf + t*goalH);
      lowResCtx.lineTo(leftXb, leftYb + t*goalH);
      lowResCtx.moveTo(leftXf + goalW, leftYf + t*goalH);
      lowResCtx.lineTo(leftXb + goalW, leftYb + t*goalH);
      lowResCtx.stroke();
    }
    lowResCtx.restore();
    // پست عقب و میله عقب با ضخامت زیاد (فقط از crossbar عقب به بالا)
    lowResCtx.strokeStyle = '#fff';
    lowResCtx.lineWidth = postW;
    lowResCtx.beginPath();
    // فقط از crossbar عقب به بالا
    lowResCtx.moveTo(leftXb, leftYb);
    lowResCtx.lineTo(leftXb, leftYb); // نقطه بالای پست عقب چپ (دروازه چپ)
    lowResCtx.moveTo(leftXb + goalW, leftYb);
    lowResCtx.lineTo(leftXb + goalW, leftYb); // نقطه بالای پست عقب راست (دروازه چپ)
    lowResCtx.moveTo(leftXb, leftYb);
    lowResCtx.lineTo(leftXb + goalW, leftYb); // crossbar عقب
    lowResCtx.stroke();
    // دروازه راست
    const rightXf = (CANVAS_WIDTH * PIXELATION_SCALE_FACTOR) - goalW/2, rightYf = (CANVAS_HEIGHT - 5) * PIXELATION_SCALE_FACTOR - goalH;
    const rightXb = rightXf - depth - 3 * PIXELATION_SCALE_FACTOR, rightYb = rightYf - barHeight;
    lowResCtx.save();
    lowResCtx.strokeStyle = '#fff';
    lowResCtx.lineWidth = postW;
    lowResCtx.beginPath();
    lowResCtx.moveTo(rightXf, rightYf + goalH);
    lowResCtx.lineTo(rightXf, rightYf);
    lowResCtx.moveTo(rightXf + goalW, rightYf + goalH);
    lowResCtx.lineTo(rightXf + goalW, rightYf);
    lowResCtx.stroke();
    lowResCtx.beginPath();
    lowResCtx.moveTo(rightXb, rightYb + goalH);
    lowResCtx.lineTo(rightXb, rightYb);
    lowResCtx.moveTo(rightXb + goalW, rightYb + goalH);
    lowResCtx.lineTo(rightXb + goalW, rightYb);
    lowResCtx.stroke();
    lowResCtx.beginPath();
    lowResCtx.moveTo(rightXf, rightYf);
    lowResCtx.lineTo(rightXf + goalW, rightYf);
    lowResCtx.moveTo(rightXb, rightYb);
    lowResCtx.lineTo(rightXb + goalW, rightYb);
    lowResCtx.stroke();
    lowResCtx.beginPath();
    lowResCtx.moveTo(rightXf, rightYf);
    lowResCtx.lineTo(rightXb, rightYb);
    lowResCtx.moveTo(rightXf + goalW, rightYf);
    lowResCtx.lineTo(rightXb + goalW, rightYb);
    lowResCtx.stroke();
    lowResCtx.strokeStyle = 'rgba(220,220,220,0.7)';
    for(let i=0;i<=5;i++){
      let t = i/5;
      lowResCtx.beginPath();
      lowResCtx.moveTo(rightXf + t*goalW, rightYf);
      lowResCtx.lineTo(rightXb + t*goalW, rightYb);
      lowResCtx.stroke();
    }
    for(let i=1;i<5;i++){
      let t = i/5;
      lowResCtx.beginPath();
      lowResCtx.moveTo(rightXf, rightYf + t*goalH);
      lowResCtx.lineTo(rightXb, rightYb + t*goalH);
      lowResCtx.moveTo(rightXf + goalW, rightYf + t*goalH);
      lowResCtx.lineTo(rightXb + goalW, rightYb + t*goalH);
      lowResCtx.stroke();
    }
    lowResCtx.restore();
    // پست عقب و میله عقب با ضخامت زیاد (فقط از crossbar عقب به بالا)
    lowResCtx.strokeStyle = '#fff';
    lowResCtx.lineWidth = postW;
    lowResCtx.beginPath();
    // فقط از crossbar عقب به بالا
    lowResCtx.moveTo(rightXb, rightYb);
    lowResCtx.lineTo(rightXb, rightYb); // نقطه بالای پست عقب چپ (دروازه راست)
    lowResCtx.moveTo(rightXb + goalW, rightYb);
    lowResCtx.lineTo(rightXb + goalW, rightYb); // نقطه بالای پست عقب راست (دروازه راست)
    lowResCtx.moveTo(rightXb, rightYb);
    lowResCtx.lineTo(rightXb + goalW, rightYb); // crossbar عقب
    lowResCtx.stroke();

    lowResCtx.restore();

    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    mainCtx.imageSmoothingEnabled = false;
    mainCtx.drawImage(
        lowResCanvas,
        0, 0, lowResCanvas.width, lowResCanvas.height,
        0, 0, mainCanvas.width, mainCanvas.height
    );

    handlePlayerControls();
    
    // بروزرسانی powerup ها
    updatePowerUps();
    updatePlayerPowerUps();

    if (typeof window.updateAI === "function" && !isGameOver) {
        window.updateAI();
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
                    console.log(`${playerObject.body.label} executing chip shot!`); // DEBUG
                    let kickDirection = (playerObject.team === 1) ? 1 : -1;
                    const kickMultiplier = playerObject.kickMultiplier || 1;
                    const forceX = kickDirection * CHIP_SHOT_FORWARD_FORCE * kickMultiplier;
                    const forceY = -CHIP_SHOT_UP_FORCE * kickMultiplier;
                    const chipForceVector = { x: forceX, y: forceY };
                    const forceApplicationPoint = { x: ballBody.position.x, y: ballBody.position.y + BALL_RADIUS * 0.3 };
                    
                    Body.applyForce(ballBody, forceApplicationPoint, chipForceVector);
                    audioManager.playSound('kick');
                    
                    console.log(`Chip force applied: x=${forceX.toFixed(3)}, y=${forceY.toFixed(3)}`); // DEBUG

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
                 if ((bodyA === p.body && bodyB.label === 'InvisibleGround') || (bodyB === p.body && bodyA.label === 'InvisibleGround')) {
                     p.isGrounded = true;
                 }
            });

            if ((bodyA.label === 'ball' && bodyB.label === 'InvisibleGround') || (bodyB.label === 'ball' && bodyA.label === 'InvisibleGround')) {
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

                        // تنه زدن بازیکنان - تشخیص برخورد بین player1 و player2
            if ((bodyA.label === 'player1' && bodyB.label === 'player2') ||
                (bodyB.label === 'player1' && bodyA.label === 'player2')) {
                
                console.log("Player collision detected!"); // DEBUG
                
                // پیدا کردن بازیکنان
                const player1 = players.find(p => p.body.label === 'player1');
                const player2 = players.find(p => p.body.label === 'player2');
                
                if (player1 && player2) {
                    // محاسبه سرعت برای تشخیص شدت برخورد
                    const p1Speed = Math.sqrt(player1.body.velocity.x ** 2 + player1.body.velocity.y ** 2);
                    const p2Speed = Math.sqrt(player2.body.velocity.x ** 2 + player2.body.velocity.y ** 2);
                    
                    console.log(`P1 Speed: ${p1Speed.toFixed(2)}, P2 Speed: ${p2Speed.toFixed(2)}`); // DEBUG
                    
                    // کاهش آستانه برای تشخیص آسان‌تر
                    if (p1Speed > p2Speed + 0.5) {
                        // player1 ضربه محکم تری زده
                        const pushForce = Math.min(p1Speed * 0.08, 0.15);
                        const direction = player1.body.position.x < player2.body.position.x ? 1 : -1;
                        Body.applyForce(player2.body, player2.body.position, { x: direction * pushForce, y: -0.01 });
                        console.log("P1 pushed P2"); // DEBUG
                    } else if (p2Speed > p1Speed + 0.5) {
                        // player2 ضربه محکم تری زده
                        const pushForce = Math.min(p2Speed * 0.08, 0.15);
                        const direction = player2.body.position.x < player1.body.position.x ? 1 : -1;
                        Body.applyForce(player1.body, player1.body.position, { x: direction * pushForce, y: -0.01 });
                        console.log("P2 pushed P1"); // DEBUG
                    }
                    
                    // صدای تنه زدن
                    audioManager.playSound('player_collision');
                    
                    // اثر ذرات در محل برخورد
                    const collisionX = (player1.body.position.x + player2.body.position.x) / 2;
                    const collisionY = (player1.body.position.y + player2.body.position.y) / 2;
                    createImpactParticles(collisionX, collisionY, 3, '#FFD700');
                }
            }

            // بررسی برخورد بازیکنان با powerup ها
            if (bodyA.label.startsWith('player') && bodyB.label.startsWith('powerup_')) {
                const player = players.find(p => p.body === bodyA);
                const powerUp = powerUps.find(p => p.body === bodyB);
                if (player && powerUp) {
                    applyPowerUpToPlayer(player, powerUp.type);
                    World.remove(world, powerUp.body);
                    powerUps.splice(powerUps.indexOf(powerUp), 1);
                }
            } else if (bodyB.label.startsWith('player') && bodyA.label.startsWith('powerup_')) {
                const player = players.find(p => p.body === bodyB);
                const powerUp = powerUps.find(p => p.body === bodyA);
                if (player && powerUp) {
                    applyPowerUpToPlayer(player, powerUp.type);
                    World.remove(world, powerUp.body);
                    powerUps.splice(powerUps.indexOf(powerUp), 1);
                }
            }
         }
     });
}

function handlePlayerControls() {
    if (players.length === 0) return;
    const p1 = players[0];
    const baseMoveForce = p1.isGrounded ? MOVE_FORCE : MOVE_FORCE * AIR_MOVE_FORCE_MULTIPLIER;
    const currentMoveForce = baseMoveForce * (p1.speedMultiplier || 1);

    if (keysPressed['a']) Body.applyForce(p1.body, p1.body.position, { x: -currentMoveForce, y: 0 });
    if (keysPressed['d']) Body.applyForce(p1.body, p1.body.position, { x: currentMoveForce, y: 0 });
    
    if (keysPressed['w'] && p1.isGrounded) {
        const jumpForce = JUMP_FORCE * (p1.jumpMultiplier || 1);
        Body.applyForce(p1.body, p1.body.position, { x: 0, y: -jumpForce });
        p1.isGrounded = false;
        audioManager.playSound('jump');
    }
    
    if (keysPressed['s'] && !p1.sKeyProcessed && !p1.kickCooldown) {
        p1.chipShotAttempt = true;
        p1.sKeyProcessed = true;
        console.log("Player 1 attempting chip shot!"); // DEBUG
    }
}

let goalScoredThisTick = false;
function handleGoalScored(scoringTeam) {
    if (isGameOver || goalScoredThisTick) return;
    goalScoredThisTick = true;
    
    audioManager.playSound('goal');

    if (Math.random() < 0.20) {
        triggerScreenShake(8, 20);
        let bounceXVelocity = (scoringTeam === 1) ? -(3 + Math.random() * 2) : (3 + Math.random() * 2);
        const bounceYVelocity = -(2 + Math.random() * 2);
        Body.setVelocity(ball, { x: bounceXVelocity, y: bounceYVelocity });
        Body.setAngularVelocity(ball, (Math.random() - 0.5) * 0.2);
        
        // صدای تیرک جدید
        audioManager.playSound('crossbar');
        
        gameMessageDisplay.textContent = "⚡ تیرک! ⚡";
        gameMessageDisplay.classList.add('has-text');
        gameMessageDisplay.classList.add('crossbar-hit');
        setTimeout(() => {
            if (gameMessageDisplay.textContent.includes("تیرک")) {
                gameMessageDisplay.textContent = "";
                gameMessageDisplay.classList.remove('has-text');
                gameMessageDisplay.classList.remove('crossbar-hit');
            }
            goalScoredThisTick = false;
        }, 1500);
        return;
    }

    if (scoringTeam === 1) {
        team1Score++;
        team1ScoreDisplay.textContent = `Team 1: ${team1Score}`;
        gameMessageDisplay.textContent = "🔴 گووووووول! 🔴";
    } else {
        team2Score++;
        team2ScoreDisplay.textContent = `Team 2: ${team2Score}`;
        gameMessageDisplay.textContent = "🔵 گووووووول! 🔵";
    }
    gameMessageDisplay.classList.add('has-text');
    gameMessageDisplay.classList.add('goal-scored');
    
    setTimeout(() => {
        resetPositions();
        if (gameMessageDisplay.textContent.includes("گووووووول")) {
             gameMessageDisplay.textContent = "";
             gameMessageDisplay.classList.remove('has-text');
             gameMessageDisplay.classList.remove('goal-scored');
        }
        goalScoredThisTick = false;
    }, 2000);
}

function resetPositions() {
    const centerY = (FIELD_SURFACE_Y + CANVAS_HEIGHT) / 2;
    
    // بازیکن 1 - وسط نیمه چپ
    Body.setPosition(players[0].body, { x: CANVAS_WIDTH / 4, y: centerY });
    Body.setVelocity(players[0].body, { x: 0, y: 0 });
    Body.setAngle(players[0].body, 0);
    
    // بازیکن 2 - وسط نیمه راست  
    Body.setPosition(players[1].body, { x: (CANVAS_WIDTH * 3) / 4, y: centerY });
    Body.setVelocity(players[1].body, { x: 0, y: 0 });
    Body.setAngle(players[1].body, 0);
    
    // توپ وسط زمین
    Body.setPosition(ball, { x: CANVAS_WIDTH / 2, y: centerY - 50 });
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
