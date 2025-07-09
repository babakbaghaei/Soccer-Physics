/// --- Matter.js Aliases ---
const Engine = Matter.Engine;
const Render = Matter.Render;
const Runner = Matter.Runner;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Events = Matter.Events;
const Composite = Matter.Composite;
const Composites = Matter.Composites;
const Constraint = Matter.Constraint;

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
const PIXELATION_SCALE_FACTOR = 0.25; // Further reduced for more pixelation
let lowResCanvas;
let lowResCtx;

// --- Collision Categories ---
const playerCategory = 0x0001;
const goalPostCategory = 0x0002;
const ballCategory = 0x0004;
const worldCategory = 0x0008;

// --- Game Constants ---
// ... (other constants)
const AI_PLAYER_INDEX = 1; // Player 2 is at index 1 in the players array

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

// --- Power-ups System ---
let powerUps = [];
let powerUpTypes = [
    { type: 'speed', color: '#FFD700', duration: 5000, effect: 'سرعت بالا' },
    { type: 'strength', color: '#FF4500', duration: 4000, effect: 'شوت قوی' },
    { type: 'shield', color: '#00CED1', duration: 6000, effect: 'محافظت' },
    { type: 'magnet', color: '#FF69B4', duration: 3000, effect: 'آهنربا' }
];
let activePowerUps = { team1: null, team2: null };

// --- Game Stats (For Stats Summary) ---
let gameStats = {
    team1: { shots: 0, jumps: 0, possessions: 0, tackles: 0, mistakes: 0, specialGoals: 0 },
    team2: { shots: 0, jumps: 0, possessions: 0, tackles: 0, mistakes: 0, specialGoals: 0 },
    totalPossessionTime: { team1: 0, team2: 0 },
    lastPossession: null,
    startTime: null,
    endTime: null
};



// --- Field Type (For Special Physics) ---
// Possible values: 'normal', 'ice', 'sand', 'moon'
let fieldType = 'normal';

// --- Weather System ---
let currentWeather = 'clear';
let weatherEffects = {
    clear: { name: 'صاف', particles: 0, windForce: 0, friction: 1 },
    rain: { name: 'باران', particles: 50, windForce: 0.5, friction: 0.8 },
    snow: { name: 'برف', particles: 30, windForce: 0.3, friction: 0.6 },
    storm: { name: 'طوفان', particles: 80, windForce: 1.2, friction: 0.7 }
};
let weatherParticles = [];
let weatherChangeTimer = 0;

function setWeather(weather) {
    currentWeather = weather;
    const effect = weatherEffects[weather];
    
    // اعمال تأثیرات آب و هوا
    if (ball) {
        ball.friction = ball.friction * effect.friction;
        ball.frictionAir = ball.frictionAir * effect.friction;
    }
    
    players.forEach(p => {
        p.body.friction = p.body.friction * effect.friction;
        p.body.frictionAir = p.body.frictionAir * effect.friction;
    });
    
    // نمایش پیام
    gameMessageDisplay.textContent = `آب و هوا: ${effect.name}`;
    gameMessageDisplay.classList.add('has-text');
    setTimeout(() => {
        gameMessageDisplay.textContent = '';
        gameMessageDisplay.classList.remove('has-text');
    }, 2000);
}

function createWeatherParticle() {
    const effect = weatherEffects[currentWeather];
    if (effect.particles === 0) return;
    
    const x = Math.random() * CANVAS_WIDTH;
    const y = -10;
    const vx = (Math.random() - 0.5) * effect.windForce;
    const vy = Math.random() * 2 + 1;
    
    weatherParticles.push({
        x, y, vx, vy,
        type: currentWeather,
        life: Math.random() * 100 + 50,
        size: currentWeather === 'snow' ? Math.random() * 3 + 2 : Math.random() * 2 + 1
    });
}

function updateWeatherParticles() {
    for (let i = weatherParticles.length - 1; i >= 0; i--) {
        const p = weatherParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        
        if (p.life <= 0 || p.y > CANVAS_HEIGHT) {
            weatherParticles.splice(i, 1);
        }
    }
}

function drawWeatherParticles(targetCtx) {
    weatherParticles.forEach(p => {
        targetCtx.fillStyle = p.type === 'snow' ? '#FFFFFF' : '#87CEEB';
        targetCtx.globalAlpha = 0.7;
        targetCtx.beginPath();
        targetCtx.arc(
            p.x * PIXELATION_SCALE_FACTOR, 
            p.y * PIXELATION_SCALE_FACTOR, 
            p.size * PIXELATION_SCALE_FACTOR, 
            0, Math.PI * 2
        );
        targetCtx.fill();
        targetCtx.globalAlpha = 1;
    });
}

function setFieldType(type) {
    fieldType = type;
    // ضرایب فیزیکی بر اساس نوع زمین
    let friction, frictionAir, gravityY;
    switch (type) {
        case 'ice':
            friction = 0.01; frictionAir = 0.001; gravityY = 1.5;
            break;
        case 'sand':
            friction = 0.5; frictionAir = 0.05; gravityY = 1.5;
            break;
        case 'moon':
            friction = 0.1; frictionAir = 0.01; gravityY = 0.3;
            break;
        default:
            friction = 0.05; frictionAir = 0.01; gravityY = 1.5;
    }
    // اعمال به توپ
    if (ball) {
        ball.friction = friction;
        ball.frictionAir = frictionAir;
    }
    // اعمال به بازیکنان
    players.forEach(p => {
        p.body.friction = friction;
        p.body.frictionAir = frictionAir;
    });
    // جاذبه
    if (engine && engine.gravity) engine.gravity.y = gravityY;
    // پیام نوع زمین
    gameMessageDisplay.textContent = `زمین: ${type === 'ice' ? 'یخ' : type === 'sand' ? 'شن' : type === 'moon' ? 'ماه' : 'معمولی'}`;
    gameMessageDisplay.classList.add('has-text');
    setTimeout(() => { gameMessageDisplay.textContent = ''; gameMessageDisplay.classList.remove('has-text'); }, 1200);
}

// --- Field Constants ---
const GROUND_Y = 580;
const GROUND_THICKNESS = 40;
const WALL_THICKNESS = 40;
const GOAL_HEIGHT = 120;
const GOAL_WIDTH = 30; // Original goal area width
const GOAL_POST_WIDTH = 6; // Thinner goal posts (was 10)


// --- Player Constants ---
const PLAYER_FRICTION = 0.8;
const PLAYER_RESTITUTION = 0.1;
const PLAYER_DENSITY = 0.003;
const PLAYER_SIZE = 40;
const PLAYER_WIDTH = PLAYER_SIZE;
const PLAYER_HEIGHT = PLAYER_SIZE;
const JUMP_FORCE = 0.18;
const MOVE_FORCE = 0.015;
const AIR_MOVE_FORCE_MULTIPLIER = 0.1; // Reduced from 0.3 to 0.1 (10%)

const keysPressed = {};

// شمارنده قدرت S برای بازیکن ۱
let sPower = 0;
let sPowerTimeout = null;

// ===================================================================================
// Setup Function
// ===================================================================================
function setup() {
    console.log("Starting game setup...");
    
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

    // Initialize AI for Player 2
    // Ensure players array is populated and ball exists.
    if (typeof window.initializeAI === "function" && players.length > 1 && ball && ball.velocity) {
        window.initializeAI(players[AI_PLAYER_INDEX], ball, engine); // AI_PLAYER_INDEX should be 1 for P2
        console.log("AI initialized successfully");
    } else {
        console.error("AI could not be initialized. Ensure ai_player.js is loaded and initializeAI is defined, and ball is created properly.");
    }

    startGame();
    console.log("Game setup completed!");

    // Add quick test buttons for field types
    const btns = document.createElement('div');
    btns.style.position = 'fixed'; btns.style.top = '10px'; btns.style.left = '50%'; btns.style.transform = 'translateX(-50%)';
    btns.style.zIndex = 1000;
    btns.innerHTML = '<button id="btnNormal">معمولی</button> <button id="btnIce">یخ</button> <button id="btnSand">شن</button> <button id="btnMoon">ماه</button>';
    document.body.appendChild(btns);
    document.getElementById('btnNormal').onclick = () => setFieldType('normal');
    document.getElementById('btnIce').onclick = () => setFieldType('ice');
    document.getElementById('btnSand').onclick = () => setFieldType('sand');
    document.getElementById('btnMoon').onclick = () => setFieldType('moon');

    // Add weather buttons
    const weatherBtns = document.createElement('div');
    weatherBtns.style.position = 'fixed'; weatherBtns.style.top = '50px'; weatherBtns.style.left = '50%'; weatherBtns.style.transform = 'translateX(-50%)';
    weatherBtns.style.zIndex = 1000;
    weatherBtns.innerHTML = '<button id="btnClear">صاف</button> <button id="btnRain">باران</button> <button id="btnSnow">برف</button> <button id="btnStorm">طوفان</button>';
    document.body.appendChild(weatherBtns);
    document.getElementById('btnClear').onclick = () => setWeather('clear');
    document.getElementById('btnRain').onclick = () => setWeather('rain');
    document.getElementById('btnSnow').onclick = () => setWeather('snow');
    document.getElementById('btnStorm').onclick = () => setWeather('storm');



    // Add AI control buttons
    const aiControlBtns = document.createElement('div');
    aiControlBtns.style.position = 'fixed';
    aiControlBtns.style.top = '130px';
    aiControlBtns.style.left = '50%';
    aiControlBtns.style.transform = 'translateX(-50%)';
    aiControlBtns.style.zIndex = 1000;
    aiControlBtns.style.fontSize = '12px';
    aiControlBtns.innerHTML = `
        <button id="btnAIRandom">AI تصادفی</button> 
        <button id="btnAIPrecise">AI دقیق</button> 
        <button id="btnCounterAttack">حمله متقابل</button>
        <span id="aiStatus" style="margin-left: 10px; color: #666;">AI: عادی</span>
    `;
    document.body.appendChild(aiControlBtns);
    
    document.getElementById('btnAIRandom').onclick = () => {
        if (typeof window.setAIRandomness === "function") {
            window.setAIRandomness(0.3);
            document.getElementById('aiStatus').textContent = 'AI: تصادفی (30%)';
        }
    };
    document.getElementById('btnAIPrecise').onclick = () => {
        if (typeof window.setAIRandomness === "function") {
            window.setAIRandomness(0.05);
            document.getElementById('aiStatus').textContent = 'AI: دقیق (5%)';
        }
    };
    document.getElementById('btnCounterAttack').onclick = () => {
        if (typeof window.setCounterAttackEnabled === "function") {
            const isActive = window.isCounterAttackActive();
            window.setCounterAttackEnabled(!isActive);
            document.getElementById('aiStatus').textContent = isActive ? 'AI: عادی' : 'AI: حمله متقابل';
        }
    };

    // ایجاد power-up های تصادفی
    setInterval(() => {
        if (!isGameOver && powerUps.length < 1) { // حداکثر 1 power-up همزمان
            createPowerUp();
        }
    }, 15000); // هر 15 ثانیه یک power-up جدید

    // ایجاد ذرات آب و هوا
    setInterval(() => {
        if (!isGameOver) {
            createWeatherParticle();
        }
    }, 100); // هر 100ms یک ذره آب و هوا

    // ایجاد power-up های تصادفی
}

// ===================================================================================
// Entity Creation Functions
// ===================================================================================
function createField() {
    const ground = Bodies.rectangle(CANVAS_WIDTH / 2, GROUND_Y, CANVAS_WIDTH, GROUND_THICKNESS, {
        isStatic: true,
        render: { fillStyle: '#228B22' },
        label: 'Rectangle Body' // Added label for ground detection
    });
    const leftWall = Bodies.rectangle(-WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, render: { fillStyle: '#666666' } });
    const rightWall = Bodies.rectangle(CANVAS_WIDTH + WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, render: { fillStyle: '#666666' } });
    const ceiling = Bodies.rectangle(CANVAS_WIDTH / 2, -WALL_THICKNESS / 2, CANVAS_WIDTH, WALL_THICKNESS, { isStatic: true, render: { fillStyle: '#666666' } });

    // Goal posts are now thinner
    const goal1Post = Bodies.rectangle(GOAL_POST_WIDTH / 2, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, GOAL_POST_WIDTH, GOAL_HEIGHT, {
        isStatic: true, render: { fillStyle: '#FFFFFF' }, label: "goalPost1"
    });
    // Sensor remains wider to define scoring area
    const goal1Sensor = Bodies.rectangle(GOAL_WIDTH / 2, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, GOAL_WIDTH, GOAL_HEIGHT, {
        isStatic: true, isSensor: true, render: { fillStyle: 'transparent' }, label: "goal1"
    });

    const goal2Post = Bodies.rectangle(CANVAS_WIDTH - GOAL_POST_WIDTH / 2, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, GOAL_POST_WIDTH, GOAL_HEIGHT, {
        isStatic: true, render: { fillStyle: '#FFFFFF' }, label: "goalPost2"
    });
    const goal2Sensor = Bodies.rectangle(CANVAS_WIDTH - GOAL_WIDTH / 2, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, GOAL_WIDTH, GOAL_HEIGHT, {
        isStatic: true, isSensor: true, render: { fillStyle: 'transparent' }, label: "goal2"
    });

    World.add(world, [ground, leftWall, rightWall, ceiling, goal1Post, goal1Sensor, goal2Post, goal2Sensor]);
    goals = { team1: goal1Sensor, team2: goal2Sensor };
    console.log("Goals created:", goals);
}

function createPowerUp() {
    const powerUpType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    const x = Math.random() * (CANVAS_WIDTH - 100) + 50;
    const y = Math.random() * (GROUND_Y - 150) + 50; // نزدیک‌تر به زمین
    
    const powerUp = Bodies.circle(x, y, 15, {
        isStatic: true,
        render: { fillStyle: powerUpType.color },
        label: 'powerUp',
        powerUpType: powerUpType
    });
    
    powerUps.push(powerUp);
    World.add(world, powerUp);
    
    // نمایش پیام
    gameMessageDisplay.textContent = `قدرت جدید: ${powerUpType.effect}`;
    gameMessageDisplay.classList.add('has-text');
    setTimeout(() => {
        gameMessageDisplay.textContent = '';
        gameMessageDisplay.classList.remove('has-text');
    }, 2000);
    
    // حذف خودکار بعد از 15 ثانیه
    setTimeout(() => {
        if (powerUps.includes(powerUp)) {
            World.remove(world, powerUp);
            powerUps = powerUps.filter(p => p !== powerUp);
        }
    }, 15000);
}

function applyPowerUp(player, powerUpType) {
    const team = player.body.label === 'player1' ? 'team1' : 'team2';
    
    // لغو قدرت قبلی اگر وجود دارد
    if (activePowerUps[team]) {
        clearTimeout(activePowerUps[team].timeout);
        deactivatePowerUp(player, activePowerUps[team].type);
    }
    
    // اعمال قدرت جدید
    switch (powerUpType.type) {
        case 'speed':
            player.moveForce = MOVE_FORCE * 2;
            player.airMoveForce = MOVE_FORCE * AIR_MOVE_FORCE_MULTIPLIER * 2;
            break;
        case 'strength':
            player.shootPower = 2;
            break;
        case 'shield':
            player.hasShield = true;
            break;
        case 'magnet':
            player.hasMagnet = true;
            break;
    }
    
    // ذخیره قدرت فعال
    activePowerUps[team] = {
        type: powerUpType.type,
        timeout: setTimeout(() => {
            deactivatePowerUp(player, powerUpType.type);
            activePowerUps[team] = null;
        }, powerUpType.duration)
    };
    
    // نمایش پیام
    const teamName = team === 'team1' ? 'تیم ۱' : 'تیم ۲';
    gameMessageDisplay.textContent = `${teamName}: ${powerUpType.effect}`;
    gameMessageDisplay.classList.add('has-text');
    setTimeout(() => {
        gameMessageDisplay.textContent = '';
        gameMessageDisplay.classList.remove('has-text');
    }, 1500);
}

function deactivatePowerUp(player, powerUpType) {
    switch (powerUpType) {
        case 'speed':
            player.moveForce = MOVE_FORCE;
            player.airMoveForce = MOVE_FORCE * AIR_MOVE_FORCE_MULTIPLIER;
            break;
        case 'strength':
            player.shootPower = 1;
            break;
        case 'shield':
            player.hasShield = false;
            break;
        case 'magnet':
            player.hasMagnet = false;
            break;
    }
}

function createPlayers() {
    const player1Body = Bodies.rectangle(200, 450, PLAYER_WIDTH, PLAYER_HEIGHT, {
        density: PLAYER_DENSITY, friction: PLAYER_FRICTION, restitution: PLAYER_RESTITUTION, label: 'player1'
    });
    players.push({ body: player1Body, team: 1, isGrounded: false, color: '#D9534F' });

    const player2Body = Bodies.rectangle(CANVAS_WIDTH - 200, 450, PLAYER_WIDTH, PLAYER_HEIGHT, {
        density: PLAYER_DENSITY, friction: PLAYER_FRICTION, restitution: PLAYER_RESTITUTION, label: 'player2'
    });
    players.push({ body: player2Body, team: 2, isGrounded: false, color: '#428BCA' });
    World.add(world, [player1Body, player2Body]);
    console.log("Players created without collision categories");
}

// AI Player reference (from ai_player.js) - Ensure ai_player.js is loaded before game.js or functions are globally available
// For example, in index.html:
// <script src="ai_player.js"></script>
// <script src="game.js"></script>


function createBall() {
    ball = Bodies.circle(CANVAS_WIDTH / 2, 100, BALL_RADIUS, {
        restitution: 0.5,    // Reduced bounciness
        friction: 0.01,      // Surface friction (rolling)
        frictionAir: 0.01,   // Increased air resistance
        density: 0.0015,     // Slightly increased density for more 'weight'
        label: 'ball',
        render: { sprite: { texture: null, xScale: 1, yScale: 1 } }
    });
    World.add(world, ball);
    console.log("Ball created without collision categories");
}

// ===================================================================================
// Drawing Functions (Simplified for Global Pixelation)
// ===================================================================================
let sunPosition = { x: 100, y: 100 };
let cloudPositions = [
    { x: 150, y: 120, width: 80, height: 30, speed: 0.3 },
    { x: 400, y: 80, width: 100, height: 40, speed: 0.2 },
    { x: 650, y: 150, width: 70, height: 25, speed: 0.4 }
];

// Simplified: Draw a filled circle. Global pixelation will make it blocky.
function drawSimplifiedSun(targetCtx, x_scaled, y_scaled, radius_scaled) {
    targetCtx.fillStyle = '#FFD700';
    targetCtx.beginPath();
    targetCtx.arc(x_scaled, y_scaled, radius_scaled, 0, Math.PI * 2);
    targetCtx.fill();
}

// Simplified: Draw a few overlapping circles. Global pixelation handles blockiness.
function drawSimplifiedCloud(targetCtx, x_scaled, y_scaled, width_scaled, height_scaled) {
    targetCtx.fillStyle = '#FFFFFF';
    const baseCircleRadius = height_scaled * 0.6;

    targetCtx.beginPath(); // Cloud 1
    targetCtx.arc(x_scaled + width_scaled * 0.25, y_scaled + height_scaled * 0.5, baseCircleRadius * 0.8, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.beginPath(); // Cloud 2
    targetCtx.arc(x_scaled + width_scaled * 0.5, y_scaled + height_scaled * 0.4, baseCircleRadius, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.beginPath(); // Cloud 3
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

// Net remains simple lines, global pixelation makes them blocky.
function drawSimplifiedNet(targetCtx, x_scaled, y_scaled, width_scaled, height_scaled) {
    targetCtx.strokeStyle = 'rgba(220, 220, 220, 0.7)'; // Lighter net
    targetCtx.lineWidth = Math.max(1, Math.floor(2 * PIXELATION_SCALE_FACTOR)); // Thinner base line (2 world px)
    const spacing_scaled = Math.max(2, Math.floor(15 * PIXELATION_SCALE_FACTOR)); // Wider spacing

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

// Simplified: White circle with a basic pattern (e.g. one black quarter or half)
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
    // Example: a simple rotating line or a sector to show spin
    const angle = body.angle; // Use body's angle
    targetCtx.moveTo(x_scaled, y_scaled);
    targetCtx.arc(x_scaled, y_scaled, radius_scaled, angle, angle + Math.PI / 3); // A sector
    targetCtx.closePath();
    targetCtx.fill();

    targetCtx.strokeStyle = 'black';
    targetCtx.lineWidth = Math.max(1, Math.floor(1 * PIXELATION_SCALE_FACTOR)); // 1 world px outline
    targetCtx.beginPath();
    targetCtx.arc(x_scaled, y_scaled, radius_scaled, 0, Math.PI * 2);
    targetCtx.stroke();
}

// ===================================================================================
// Particle System Variables and Functions
// ===================================================================================
let particles = [];

function createImpactParticles(x, y, count = 5, color = '#A0522D') { // Brownish dirt color
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI - Math.PI; // Mostly upward direction (-PI to 0)
        const speed = Math.random() * 2 + 1; // Random speed
        particles.push({
            x: x, // x position in world coordinates
            y: y, // y position in world coordinates
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed * 0.5, // Less vertical velocity initially
            life: Math.random() * 30 + 30, // Lifespan in frames (0.5 to 1 second at 60fps)
            size: Math.random() * 2 + 1, // Size in world pixels
            color: color
        });
    }
}

function updateAndDrawParticles(targetCtx) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // Gravity effect on particles
        p.life--;

        if (p.life <= 0) {
            particles.splice(i, 1);
        } else {
            targetCtx.fillStyle = p.color;
            // Draw particles on the lowResCtx, so scale positions and size
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
// Main Draw Loop & Screen Shake Variables
// ===================================================================================
let isShaking = false;
let shakeMagnitude = 0;
let shakeDuration = 0;
let shakeTimer = 0;
let shakeOffsetX = 0;
let shakeOffsetY = 0;

function triggerScreenShake(magnitude, duration) {
    isShaking = true;
    shakeMagnitude = magnitude * PIXELATION_SCALE_FACTOR; // Scale shake to low-res canvas
    shakeDuration = duration; // Number of frames
    shakeTimer = duration;
}

// متغیر موقت برای نمایش متن بزرگ چیپ
let chipMessageTimer = 0;

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

    lowResCtx.save(); // Save context state
    lowResCtx.translate(shakeOffsetX, shakeOffsetY); // Apply shake to lowResCtx

    lowResCtx.clearRect(0, 0, lowResCanvas.width, lowResCanvas.height);
    // Changed background to a sky blue color
    lowResCtx.fillStyle = "#87CEEB"; // Sky Blue
    lowResCtx.fillRect(0, 0, lowResCanvas.width, lowResCanvas.height);
    drawDynamicSky(lowResCtx); // Sun and clouds will be drawn on top of this blue

    // 3. Grass on low-res canvas - Striped pattern
    const grassStartY_scaled = (GROUND_Y - GROUND_THICKNESS/2) * PIXELATION_SCALE_FACTOR;
    const grassHeight_scaled = (CANVAS_HEIGHT - (GROUND_Y - GROUND_THICKNESS/2)) * PIXELATION_SCALE_FACTOR;
    const STRIPE_WIDTH_WORLD = 50; // Width of each stripe in world units
    const stripeWidth_scaled = STRIPE_WIDTH_WORLD * PIXELATION_SCALE_FACTOR;
    const GRASS_COLOR_DARK = "#228B22";  // ForestGreen
    const GRASS_COLOR_LIGHT = "#32CD32"; // LimeGreen

    for (let x_stripe = 0; x_stripe < lowResCanvas.width; x_stripe += stripeWidth_scaled) {
        // Ensure we don't draw past the canvas width if stripeWidth_scaled isn't a perfect divisor
        const currentStripeWidth = Math.min(stripeWidth_scaled, lowResCanvas.width - x_stripe);
        lowResCtx.fillStyle = (Math.floor(x_stripe / stripeWidth_scaled) % 2 === 0) ? GRASS_COLOR_DARK : GRASS_COLOR_LIGHT;
        lowResCtx.fillRect(x_stripe, grassStartY_scaled, currentStripeWidth, grassHeight_scaled);
    }

    drawSimplifiedNet(lowResCtx,
        0, (GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT) * PIXELATION_SCALE_FACTOR,
        GOAL_WIDTH * PIXELATION_SCALE_FACTOR, GOAL_HEIGHT * PIXELATION_SCALE_FACTOR
    );
    drawSimplifiedNet(lowResCtx,
        (CANVAS_WIDTH - GOAL_WIDTH) * PIXELATION_SCALE_FACTOR,
        (GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT) * PIXELATION_SCALE_FACTOR,
        GOAL_WIDTH * PIXELATION_SCALE_FACTOR, GOAL_HEIGHT * PIXELATION_SCALE_FACTOR
    );

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

        if (body.label === 'player1' || body.label === 'player2') {
            const player = (body.label === 'player1') ? players[0] : players[1];
            lowResCtx.fillStyle = player.color;
            lowResCtx.fill();
            
            // نمایش shield
            if (player.hasShield) {
                lowResCtx.strokeStyle = '#00CED1';
                lowResCtx.lineWidth = Math.max(2, Math.floor(3 * PIXELATION_SCALE_FACTOR));
                lowResCtx.stroke();
            }
            
            // نمایش magnet
            if (player.hasMagnet) {
                const centerX = body.position.x * PIXELATION_SCALE_FACTOR;
                const centerY = body.position.y * PIXELATION_SCALE_FACTOR;
                lowResCtx.fillStyle = '#FF69B4';
                lowResCtx.beginPath();
                lowResCtx.arc(centerX, centerY, 25 * PIXELATION_SCALE_FACTOR, 0, Math.PI * 2);
                lowResCtx.globalAlpha = 0.3;
                lowResCtx.fill();
                lowResCtx.globalAlpha = 1;
            }
        } else if (body.label === 'ball') {
            drawSimplifiedSoccerBall(lowResCtx, body);
        } else if (body.label === 'powerUp') {
            // نمایش power-up
            const centerX = body.position.x * PIXELATION_SCALE_FACTOR;
            const centerY = body.position.y * PIXELATION_SCALE_FACTOR;
            const radius = 15 * PIXELATION_SCALE_FACTOR;
            
            lowResCtx.fillStyle = body.powerUpType.color;
            lowResCtx.beginPath();
            lowResCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            lowResCtx.fill();
            
            // نمایش نماد قدرت
            lowResCtx.fillStyle = 'white';
            lowResCtx.font = `${Math.max(8, Math.floor(12 * PIXELATION_SCALE_FACTOR))}px Arial`;
            lowResCtx.textAlign = 'center';
            const symbol = body.powerUpType.type === 'speed' ? '⚡' : 
                          body.powerUpType.type === 'strength' ? '💪' : 
                          body.powerUpType.type === 'shield' ? '🛡️' : '🧲';
            lowResCtx.fillText(symbol, centerX, centerY + 3 * PIXELATION_SCALE_FACTOR);
        } else if (body.isStatic) {
            if (body.render && body.render.fillStyle) {
                lowResCtx.fillStyle = body.render.fillStyle;
            } else {
                lowResCtx.fillStyle = '#CCC';
            }
            if (!(body.label === 'Rectangle Body' && body.position.y > (GROUND_Y - GROUND_THICKNESS) && body.area >= (CANVAS_WIDTH * GROUND_THICKNESS * 0.8))) {
                 lowResCtx.fill();
            }
        }
        if (!body.isSensor && body.label !== 'ball' && body.label !== 'powerUp') {
            lowResCtx.lineWidth = Math.max(1, Math.floor(2 * PIXELATION_SCALE_FACTOR));
            lowResCtx.strokeStyle = '#000000';
            lowResCtx.stroke();
        }
    });

    updateAndDrawParticles(lowResCtx); // Update and draw particles on the low-res canvas
    updateWeatherParticles(); // Update weather particles
    drawWeatherParticles(lowResCtx); // Draw weather particles on the low-res canvas

    // تأثیر باد روی توپ
    const windEffect = weatherEffects[currentWeather].windForce;
    if (windEffect > 0) {
        Body.applyForce(ball, ball.position, { 
            x: windEffect * 0.005, 
            y: 0 
        });
    }

    // اضافه کردن Randomness به فیزیک توپ
    if (Math.random() < 0.02) { // 2% احتمال
        const randomForce = (Math.random() - 0.5) * 0.001;
        Body.applyForce(ball, ball.position, { 
            x: randomForce, 
            y: 0 
        });
    }

    lowResCtx.restore(); // Restore context state after shake translation

    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    mainCtx.imageSmoothingEnabled = false;
    mainCtx.mozImageSmoothingEnabled = false;
    mainCtx.webkitImageSmoothingEnabled = false;
    mainCtx.msImageSmoothingEnabled = false;

    if (chipMessageTimer > 0) {
        mainCtx.save();
        mainCtx.font = 'bold 64px Tahoma, Arial, sans-serif';
        mainCtx.fillStyle = 'rgba(255,255,0,' + Math.min(1, chipMessageTimer / 20) + ')';
        mainCtx.textAlign = 'center';
        mainCtx.textBaseline = 'middle';
        mainCtx.strokeStyle = 'black';
        mainCtx.lineWidth = 6;
        mainCtx.strokeText('چیپ!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        mainCtx.fillText('چیپ!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        mainCtx.restore();
        chipMessageTimer--;
    }

    mainCtx.drawImage(
        lowResCanvas,
        0, 0, lowResCanvas.width, lowResCanvas.height,
        0, 0, mainCanvas.width, mainCanvas.height
    );

    handlePlayerControls();

    // Update AI Player
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
        initializeAudio(); // Initialize audio on first keydown
        keysPressed[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
        keysPressed[e.key.toLowerCase()] = false;
        if (e.key.toLowerCase() === 's') {
            sPower = 0;
        }
    });
}

// --- Special Goal Tracking ---
let lastBallHitInfo = {
    team: null, // 1 or 2
    isJump: false,
    isHeader: false,
    isLongShot: false,
    playerIndex: null,
    hitPosition: null,
    hitVelocity: null
};

// --- Helper: ثبت مالکیت توپ ---
function updatePossession(team) {
    if (gameStats.lastPossession !== team) {
        const now = Date.now();
        if (gameStats.lastPossession && gameStats.startTime) {
            const lastTeam = gameStats.lastPossession === 1 ? 'team1' : 'team2';
            gameStats.totalPossessionTime[lastTeam] += now - gameStats.startTime;
        }
        gameStats.lastPossession = team;
        gameStats.startTime = now;
    }
}

function setupCollisions() {
    Events.on(engine, 'collisionStart', (event) => {
        const pairs = event.pairs;
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;

            // Debug: Log all collisions
            if (bodyA.label === 'ball' || bodyB.label === 'ball') {
                console.log("Ball collision detected:", { 
                    bodyA: bodyA.label, 
                    bodyB: bodyB.label,
                    ballPos: ball ? ball.position : null
                });
            }

            // --- Track last player to hit the ball and type of hit ---
            let playerBody = null;
            if (bodyA.label === 'ball' && (bodyB.label === 'player1' || bodyB.label === 'player2')) {
                playerBody = bodyB;
            } else if (bodyB.label === 'ball' && (bodyA.label === 'player1' || bodyA.label === 'player2')) {
                playerBody = bodyA;
            }
            if (playerBody) {
                const playerIndex = playerBody.label === 'player1' ? 0 : 1;
                const player = players[playerIndex];
                // پرتاب ساده توپ با S (یا توسط AI) با قدرت خیلی کم
                if (playerIndex === 0 && keysPressed['s']) {
                    Body.setVelocity(ball, { x: 0, y: -10 });
                    Body.setAngularVelocity(ball, 0);
                }
                if (playerIndex === 1) {
                    const nearGoal = ball.position.x < 120;
                    const opponent = players[0];
                    const opponentNear = Math.abs(opponent.body.position.x - ball.position.x) < 40;
                    if (nearGoal || opponentNear) {
                        Body.setVelocity(ball, { x: 0, y: -10 });
                        Body.setAngularVelocity(ball, 0);
                    }
                }
                // جلوگیری از override چیپ
                if (ball.isChipped) return;
                const ballPos = { ...ball.position };
                const ballVel = { ...ball.velocity };
                // تشخیص پرش: فقط اگر سرعت عمودی بازیکن کافی باشد
                const isJump = player.body.velocity.y < -0.5;
                // تشخیص هد: اگر توپ بالاتر از سر بازیکن باشد
                const isHeader = ball.position.y < player.body.position.y - PLAYER_HEIGHT * 0.5;
                // تشخیص شوت از راه دور: اگر فاصله افقی بازیکن تا دروازه حریف زیاد باشد
                let isLongShot = false;
                if (playerIndex === 0) {
                    isLongShot = ball.position.x > CANVAS_WIDTH * 0.7;
                } else {
                    isLongShot = ball.position.x < CANVAS_WIDTH * 0.3;
                }
                // --- منطق چیپ ---
                let isNearCorner = (ball.position.x < 150 || ball.position.x > CANVAS_WIDTH - 150);
                let isObstacleAhead = false;
                const opponent = players[1 - playerIndex];
                if (Math.abs(opponent.body.position.x - ball.position.x) < 40 &&
                    ((playerIndex === 0 && opponent.body.position.x > ball.position.x) ||
                     (playerIndex === 1 && opponent.body.position.x < ball.position.x))) {
                    isObstacleAhead = true;
                }
                // چیپ واقعی: اگر توپ نزدیک زمین است و بازیکن با سرعت عمودی منفی کافی از بالا روی توپ بپرد
                const now = Date.now();
                const isBallOnGround = Math.abs(ball.position.y + ball.circleRadius - GROUND_Y) < 25;
                const isPlayerFalling = player.body.velocity.y < -0.2;
                const isChipCondition = isBallOnGround && isPlayerFalling && player.hasJumped;
                console.log('CHIP DEBUG', {isChipCondition, isBallOnGround, isPlayerFalling, hasJumped: player.hasJumped, vy: player.body.velocity.y});
                if (isChipCondition) {
                    console.log('CHIP EXECUTED!');
                    const chipVX = playerIndex === 0 ? 10 : -10;
                    Body.setVelocity(ball, { x: chipVX, y: -16 });
                    Body.setAngularVelocity(ball, playerIndex === 0 ? 0.5 : -0.5);
                    chipMessageTimer = 40;
                    // ناپدید کردن بازیکن مقابل اگر بازیکن در حال سقوط باشد
                    const isPlayerFalling = player.body.velocity.y < -0.2;
                    if (isPlayerFalling) {
                        const opponentIndex = 1 - playerIndex;
                        const opponent = players[opponentIndex];
                        if (!opponent._vanishTimeout) {
                            opponent.body.render = opponent.body.render || {};
                            opponent.body.render.opacity = 0;
                            opponent._vanishTimeout = setTimeout(() => {
                                opponent.body.render.opacity = 1;
                                opponent._vanishTimeout = null;
                            }, 1000);
                        }
                    }
                                        ball.isChipped = true;
                    setTimeout(() => { ball.isChipped = false; }, 100);
                }
                
                // اعمال قدرت strength روی سرعت توپ
                if (player.shootPower > 1) {
                    const multiplier = player.shootPower;
                    Body.setVelocity(ball, { 
                        x: ball.velocity.x * multiplier, 
                        y: ball.velocity.y * multiplier 
                    });
                }
                
                lastBallHitInfo = {
                    team: player.team,
                    isJump,
                    isHeader,
                    isLongShot,
                    playerIndex,
                    hitPosition: { ...player.body.position },
                    hitVelocity: { ...player.body.velocity }
                };

                // ثبت شوت
                if (Math.abs(ballVel.x) > 2 || Math.abs(ballVel.y) > 2) {
                    const teamKey = player.team === 1 ? 'team1' : 'team2';
                    gameStats[teamKey].shots++;
                }
                // ثبت مالکیت توپ
                updatePossession(player.team);
            }

            // Goal scoring
            if (bodyA.label === 'ball' && bodyB.label === 'goal2') {
                console.log("Goal scored by Team 1! Ball hit goal2", { ballPos: ball.position, goalPos: bodyB.position });
                handleGoalScored(1);
                audioManager.playSound('goal');
            } else if (bodyB.label === 'ball' && bodyA.label === 'goal2') {
                console.log("Goal scored by Team 1! Ball hit goal2", { ballPos: ball.position, goalPos: bodyA.position });
                handleGoalScored(1);
                audioManager.playSound('goal');
            } else if (bodyA.label === 'ball' && bodyB.label === 'goal1') {
                console.log("Goal scored by Team 2! Ball hit goal1", { ballPos: ball.position, goalPos: bodyB.position });
                handleGoalScored(2);
                audioManager.playSound('goal');
            } else if (bodyB.label === 'ball' && bodyA.label === 'goal1') {
                console.log("Goal scored by Team 2! Ball hit goal1", { ballPos: ball.position, goalPos: bodyA.position });
                handleGoalScored(2);
                audioManager.playSound('goal');
            }

            // Player grounding
            players.forEach(p => {
                 if ((bodyA === p.body && bodyB.label === 'Rectangle Body') || (bodyB === p.body && bodyA.label === 'Rectangle Body')) {
                     p.isGrounded = true;
                     setTimeout(() => { p.hasJumped = false; }, 50); // با تاخیر ریست کن
                 }
            });

            // Ball hitting ground
            if ((bodyA.label === 'ball' && bodyB.label === 'Rectangle Body') || (bodyB.label === 'ball' && bodyA.label === 'Rectangle Body')) {
                const ballBody = bodyA.label === 'ball' ? bodyA : bodyB;
                const groundBody = bodyA.label === 'Rectangle Body' ? bodyA : bodyB; // just to be clear

                const ballWorldY = ballBody.position.y + ballBody.circleRadius;
                createImpactParticles(ballBody.position.x, ballWorldY);
                audioManager.playSound('bounce');
            }

            // Ball hitting a wall (leftWall, rightWall, ceiling)
            // Walls don't have specific labels, but they are static and not 'Rectangle Body' (ground) or goal posts
            if (bodyA.label === 'ball' && bodyB.isStatic && bodyB.label !== 'Rectangle Body' && !bodyB.label?.startsWith('goal')) {
                audioManager.playSound('bounce');
            } else if (bodyB.label === 'ball' && bodyA.isStatic && bodyA.label !== 'Rectangle Body' && !bodyA.label?.startsWith('goal')) {
                audioManager.playSound('bounce');
            }


            // Ball hitting a goal post for screen shake and sound
            if (bodyA.label === 'ball' && (bodyB.label === 'goalPost1' || bodyB.label === 'goalPost2')) {
                triggerScreenShake(5, 15);
                audioManager.playSound('post'); // صدای مخصوص تیرک
            } else if (bodyB.label === 'ball' && (bodyA.label === 'goalPost1' || bodyA.label === 'goalPost2')) {
                triggerScreenShake(5, 15);
                audioManager.playSound('post'); // صدای مخصوص تیرک
            }

            // Player hitting ball (kick sound)
            if ((bodyA.label === 'ball' && (bodyB.label === 'player1' || bodyB.label === 'player2')) ||
                (bodyB.label === 'ball' && (bodyA.label === 'player1' || bodyA.label === 'player2'))) {
                audioManager.playSound('kick');
            }

            // Player collision with shield effect
            if ((bodyA.label === 'player1' && bodyB.label === 'player2') ||
                (bodyA.label === 'player2' && bodyB.label === 'player1')) {
                const player1 = bodyA.label === 'player1' ? players[0] : players[1];
                const player2 = bodyA.label === 'player1' ? players[1] : players[0];
                
                // اگر یکی از بازیکنان shield داشته باشد، حریف را به عقب پرتاب کن
                if (player1.hasShield) {
                    const forceX = bodyA.label === 'player1' ? 15 : -15;
                    Body.setVelocity(player2.body, { x: forceX, y: -10 });
                    createImpactParticles(player2.body.position.x, player2.body.position.y, 5, '#00CED1');
                } else if (player2.hasShield) {
                    const forceX = bodyA.label === 'player2' ? 15 : -15;
                    Body.setVelocity(player1.body, { x: forceX, y: -10 });
                    createImpactParticles(player1.body.position.x, player1.body.position.y, 5, '#00CED1');
                }
            }

            // Power-up collision
            if ((bodyA.label === 'powerUp' && (bodyB.label === 'player1' || bodyB.label === 'player2')) ||
                (bodyB.label === 'powerUp' && (bodyA.label === 'player1' || bodyA.label === 'player2'))) {
                const powerUp = bodyA.label === 'powerUp' ? bodyA : bodyB;
                const playerBody = bodyA.label === 'powerUp' ? bodyB : bodyA;
                const player = playerBody.label === 'player1' ? players[0] : players[1];
                
                // اعمال power-up
                applyPowerUp(player, powerUp.powerUpType);
                
                // حذف power-up
                World.remove(world, powerUp);
                powerUps = powerUps.filter(p => p !== powerUp);
                
                // پخش صدای power-up
                audioManager.playSound('powerup');
                
                // ایجاد ذرات
                createImpactParticles(powerUp.position.x, powerUp.position.y, 8, powerUp.powerUpType.color);
                

            }
        }
    });
}

function handlePlayerControls() {
    const p1 = players[0];
    const currentMoveForceP1 = p1.isGrounded ? MOVE_FORCE : MOVE_FORCE * 0.1; // روی هوا فقط ۱۰٪ قدرت حرکت

    // Debug log for key presses and player state
    if (Object.keys(keysPressed).some(key => keysPressed[key])) { // Log if any relevant key is pressed
         initializeAudio(); // Also try initializing here if not done by keydown
        // console.log(`Keys: a:${keysPressed['a']}, d:${keysPressed['d']}, w:${keysPressed['w']}. P1 Grounded: ${p1.isGrounded}, Velocity: {x: ${p1.body.velocity.x.toFixed(2)}, y: ${p1.body.velocity.y.toFixed(2)}}`);
    }

    if (keysPressed['a']) {
        Body.applyForce(p1.body, p1.body.position, { x: -currentMoveForceP1, y: 0 });
    }
    if (keysPressed['d']) {
        Body.applyForce(p1.body, p1.body.position, { x: currentMoveForceP1, y: 0 });
    }
    if (keysPressed['w'] && p1.isGrounded) {
        Body.applyForce(p1.body, p1.body.position, { x: 0, y: -JUMP_FORCE });
        p1.isGrounded = false;
        audioManager.playSound('jump');
        gameStats.team1.jumps++;
        p1.hasJumped = true; // فقط هنگام پرش واقعی
    } else if (keysPressed['w'] && !p1.isGrounded) {
        // Optional: sound for attempted jump in air? Probably not.
    }

    // منطق magnet برای جذب توپ به سمت بازیکن
    if (p1.hasMagnet) {
        const distance = Math.sqrt(
            Math.pow(ball.position.x - p1.body.position.x, 2) + 
            Math.pow(ball.position.y - p1.body.position.y, 2)
        );
        if (distance < 100) { // فقط در فاصله 100 پیکسل
            const force = 0.02;
            const dx = p1.body.position.x - ball.position.x;
            const dy = p1.body.position.y - ball.position.y;
            Body.applyForce(ball, ball.position, { 
                x: dx * force, 
                y: dy * force 
            });
        }
    }

    // تأثیر باد روی بازیکن
    const windEffect = weatherEffects[currentWeather].windForce;
    if (windEffect > 0) {
        Body.applyForce(p1.body, p1.body.position, { 
            x: windEffect * 0.01, 
            y: 0 
        });
    }

    // Player 2 (Blue Team) is now controlled by AI
    // const p2 = players[1];
    // const currentMoveForceP2 = p2.isGrounded ? MOVE_FORCE : MOVE_FORCE * AIR_MOVE_FORCE_MULTIPLIER;
    // if (keysPressed['arrowleft']) {
    //     Body.applyForce(p2.body, p2.body.position, { x: -currentMoveForceP2, y: 0 });
    //     console.log("Player 2 (Blue) Action: 'ArrowLeft' (Move Left). Grounded: " + p2.isGrounded);
    // }
    // if (keysPressed['arrowright']) {
    //     Body.applyForce(p2.body, p2.body.position, { x: currentMoveForceP2, y: 0 });
    //     console.log("Player 2 (Blue) Action: 'ArrowRight' (Move Right). Grounded: " + p2.isGrounded);
    // }
    // if (keysPressed['arrowup'] && p2.isGrounded) {
    //     Body.applyForce(p2.body, p2.body.position, { x: 0, y: -JUMP_FORCE });
    //     p2.isGrounded = false;
    //     console.log("Player 2 (Blue) Action: 'ArrowUp' (Jump). Was Grounded: true");
    // } else if (keysPressed['arrowup'] && !p2.isGrounded) {
    //     console.log("Player 2 (Blue) Action: 'ArrowUp' (Jump attempted in air). Was Grounded: false");
    // }
}

let goalScoredThisTick = false;
function handleGoalScored(scoringTeam) {
    console.log(`handleGoalScored called with team: ${scoringTeam}, isGameOver: ${isGameOver}, goalScoredThisTick: ${goalScoredThisTick}`);
    
    if (isGameOver || goalScoredThisTick) return;
    goalScoredThisTick = true; // Prevent immediate re-triggering

    // اطلاع‌رسانی به AI در مورد گل
    if (typeof window.notifyGoalScored === "function") {
        window.notifyGoalScored();
    }

    // --- Special Goal Logic ---
    let specialType = null;
    let isSpecialGoal = false;
    if (lastBallHitInfo.team === scoringTeam) {
        if (lastBallHitInfo.isJump) {
            specialType = 'پرشی';
            isSpecialGoal = true;
        } else if (lastBallHitInfo.isHeader) {
            specialType = 'هدی';
            isSpecialGoal = true;
        } else if (lastBallHitInfo.isLongShot) {
            specialType = 'راه دور';
            isSpecialGoal = true;
        }
    }

    // --- Special Goal Scoring ---
    let loserIndex = scoringTeam === 1 ? 1 : 0;
    let loserPlayer = players[loserIndex];
    // افکت طنزآمیز: بازیکن گل‌خورده به هوا و طرفین پرتاب شود (تضمینی)
    const forceX = loserIndex === 0 ? 1.5 : -1.5;
    Body.setStatic(loserPlayer.body, false);
    if (loserPlayer.body.isSleeping) Matter.Sleeping.set(loserPlayer.body, false);
    Body.setVelocity(loserPlayer.body, { x: forceX * 10, y: -18 });
    setTimeout(() => {
        gameMessageDisplay.textContent = "اوه نه! بازیکن پرت شد! 😂";
        gameMessageDisplay.classList.add('has-text');
        setTimeout(() => {
            if (gameMessageDisplay.textContent === "اوه نه! بازیکن پرت شد! 😂") {
                gameMessageDisplay.textContent = "";
                gameMessageDisplay.classList.remove('has-text');
            }
        }, 1200);
    }, 200);

    // پرتاب و fade بازیکن گل‌خورده
    Body.setStatic(loserPlayer.body, false);
    Body.setVelocity(loserPlayer.body, { x: 0, y: -7 });
    loserPlayer.body.render = loserPlayer.body.render || {};
    let fadeStep = 0;
    const fadeInterval = setInterval(() => {
        fadeStep++;
        loserPlayer.body.render.opacity = Math.max(0, 1 - fadeStep / 30);
        if (fadeStep >= 30) {
            clearInterval(fadeInterval);
            setTimeout(() => { loserPlayer.body.render.opacity = 1; }, 500);
        }
    }, 33);
    // توپ ناپدید و بعد ظاهر شود سمت بازیکن گل‌خورده
    ball.render = ball.render || {};
    ball.render.opacity = 0;
    setTimeout(() => {
        ball.render.opacity = 1;
        const newX = loserIndex === 0 ? 200 : CANVAS_WIDTH - 200;
        Body.setPosition(ball, { x: newX, y: 100 });
        Body.setVelocity(ball, { x: 0, y: 0 });
    }, 1000);

    if (scoringTeam === 1) {
        if (isSpecialGoal) {
            team1Score += 2;
            gameStats.team1.specialGoals++;
            gameMessageDisplay.textContent = `گل ویژه (${specialType})! +۲ امتیاز`;
        } else {
            team1Score++;
            gameMessageDisplay.textContent = "گل!";
        }
        
        team1ScoreDisplay.textContent = `Team 1: ${team1Score}`;
    } else {
        if (isSpecialGoal) {
            team2Score += 2;
            gameStats.team2.specialGoals++;
            gameMessageDisplay.textContent = `گل ویژه (${specialType})! +۲ امتیاز`;
        } else {
            team2Score++;
            gameMessageDisplay.textContent = "گل!";
        }
        
        team2ScoreDisplay.textContent = `Team 2: ${team2Score}`;
    }
    gameMessageDisplay.classList.add('has-text');
    
    // Standard reset after a goal
    setTimeout(() => {
        resetPositions();
        if (gameMessageDisplay.textContent === "گل!" || gameMessageDisplay.textContent.includes("ویژه")) { // Only clear if it's still the goal message
             gameMessageDisplay.textContent = "";
             gameMessageDisplay.classList.remove('has-text');
        }
        goalScoredThisTick = false;
    }, 1400); // تاخیر بیشتر برای دیده شدن افکت
}

function resetPositions() {
    // Reset ball position
    Body.setPosition(ball, { x: CANVAS_WIDTH / 2, y: 300 });
    Body.setVelocity(ball, { x: 0, y: 0 });
    Body.setAngularVelocity(ball, 0);

    // Reset player positions
    Body.setPosition(players[0].body, { x: 200, y: 450 });
    Body.setVelocity(players[0].body, { x: 0, y: 0 });
    Body.setPosition(players[1].body, { x: 600, y: 450 });
    Body.setVelocity(players[1].body, { x: 0, y: 0 });

    // Reset player states
    players.forEach(p => {
        p.isGrounded = true;
        p.hasJumped = false;
        p.moveForce = MOVE_FORCE;
        p.airMoveForce = MOVE_FORCE * AIR_MOVE_FORCE_MULTIPLIER;
        p.shootPower = 1;
        p.hasShield = false;
        p.hasMagnet = false;
    });

    // پاک کردن power-up ها
    powerUps.forEach(powerUp => {
        World.remove(world, powerUp);
    });
    powerUps = [];
    
    // لغو power-up های فعال
    Object.keys(activePowerUps).forEach(team => {
        if (activePowerUps[team]) {
            clearTimeout(activePowerUps[team].timeout);
            activePowerUps[team] = null;
        }
    });



    // Reset ball state
    ball.isChipped = false;
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

    // --- نمایش خلاصه آمار بازی ---
    const t1 = gameStats.team1, t2 = gameStats.team2;
    const pos1 = Math.round(gameStats.totalPossessionTime.team1 / 1000);
    const pos2 = Math.round(gameStats.totalPossessionTime.team2 / 1000);
    setTimeout(() => {
        alert(
            `آمار بازی:\n` +
            `تیم ۱: شوت ${t1.shots} | پرش ${t1.jumps} | گل ویژه ${t1.specialGoals} | مالکیت ${pos1} ثانیه\n` +
            `تیم ۲: شوت ${t2.shots} | پرش ${t2.jumps} | گل ویژه ${t2.specialGoals} | مالکیت ${pos2} ثانیه`
        );
    }, 1000);
}

window.addEventListener('DOMContentLoaded', setup);