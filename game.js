// --- Matter.js Aliases ---
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

// --- DOM Element References ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
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
const GROUND_Y = 580;
const GROUND_THICKNESS = 40;
const WALL_THICKNESS = 40;
const GOAL_HEIGHT = 120;
const GOAL_WIDTH = 30;

// --- Player Constants ---
const PLAYER_FRICTION = 0.8;
const PLAYER_RESTITUTION = 0.1;
const PLAYER_DENSITY = 0.003;
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 60;
const LEG_WIDTH = 20;
const LEG_HEIGHT = 40;
const JUMP_FORCE = 0.4;
const MOVE_FORCE = 0.015;

const keysPressed = {};

// ===================================================================================
// بخش‌های کلیدی که اضافه شده‌اند
// ===================================================================================

/**
 * تابع اصلی برای راه‌اندازی کل بازی
 */
function setup() {
    // 1. ساخت موتور فیزیک
    engine = Engine.create();
    world = engine.world;
    engine.gravity.y = 1.5; // تنظیم جاذبه

    // 2. ساخت اجزای زمین بازی
    createField();
    
    // 3. ساخت بازیکنان
    createPlayers();

    // 4. ساخت توپ
    createBall();

    // 5. راه‌اندازی کنترلرها و رویدادها
    setupControls();
    setupCollisions();

    // 6. شروع بازی
    startGame();
}

/**
 * ساخت زمین، دیوارها و دروازه‌ها
 */
function createField() {
    const ground = Bodies.rectangle(CANVAS_WIDTH / 2, GROUND_Y, CANVAS_WIDTH, GROUND_THICKNESS, { isStatic: true, render: { fillStyle: '#228B22' } });
    const leftWall = Bodies.rectangle(-WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true });
    const rightWall = Bodies.rectangle(CANVAS_WIDTH + WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true });
    const ceiling = Bodies.rectangle(CANVAS_WIDTH / 2, -WALL_THICKNESS / 2, CANVAS_WIDTH, WALL_THICKNESS, { isStatic: true });

    // دروازه تیم ۱ (چپ)
    const goal1Post = Bodies.rectangle(GOAL_WIDTH, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, 10, GOAL_HEIGHT, { isStatic: true, render: { fillStyle: '#FFF' } });
    const goal1Sensor = Bodies.rectangle(GOAL_WIDTH / 2, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, GOAL_WIDTH, GOAL_HEIGHT, { isStatic: true, isSensor: true, label: 'goal1' });
    goals.team1 = [goal1Post, goal1Sensor];

    // دروازه تیم ۲ (راست)
    const goal2Post = Bodies.rectangle(CANVAS_WIDTH - GOAL_WIDTH, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, 10, GOAL_HEIGHT, { isStatic: true, render: { fillStyle: '#FFF' } });
    const goal2Sensor = Bodies.rectangle(CANVAS_WIDTH - GOAL_WIDTH / 2, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, GOAL_WIDTH, GOAL_HEIGHT, { isStatic: true, isSensor: true, label: 'goal2' });
    goals.team2 = [goal2Post, goal2Sensor];
    
    World.add(world, [ground, leftWall, rightWall, ceiling, ...goals.team1, ...goals.team2]);
}

/**
 * ساخت بازیکنان
 */
function createPlayers() {
    // بازیکن ۱
    const player1Body = Bodies.rectangle(200, 450, PLAYER_WIDTH, PLAYER_HEIGHT, {
        density: PLAYER_DENSITY,
        friction: PLAYER_FRICTION,
        restitution: PLAYER_RESTITUTION,
        label: 'player1'
    });
    players.push({ body: player1Body, team: 1, isGrounded: false, color: '#D9534F' });

    // بازیکن ۲
    const player2Body = Bodies.rectangle(600, 450, PLAYER_WIDTH, PLAYER_HEIGHT, {
        density: PLAYER_DENSITY,
        friction: PLAYER_FRICTION,
        restitution: PLAYER_RESTITUTION,
        label: 'player2'
    });
    players.push({ body: player2Body, team: 2, isGrounded: false, color: '#428BCA' });

    World.add(world, [player1Body, player2Body]);
}


/**
 * ساخت توپ
 */
function createBall() {
    ball = Bodies.circle(CANVAS_WIDTH / 2, 100, BALL_RADIUS, {
        restitution: 0.8,
        friction: 0.01,
        frictionAir: 0.005,
        density: 0.001,
        label: 'ball',
        render: {
            fillStyle: 'white'
        }
    });
    World.add(world, ball);
}

/**
 * تنظیم کنترل‌های کیبورد
 */
function setupControls() {
    window.addEventListener('keydown', (e) => { keysPressed[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { keysPressed[e.key.toLowerCase()] = false; });
}

/**
 * مدیریت برخوردها
 */
function setupCollisions() {
    Events.on(engine, 'collisionStart', (event) => {
        const pairs = event.pairs;
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            
            // بررسی برخورد توپ با سنسور دروازه
            if (pair.bodyA.label === 'ball' && pair.bodyB.label === 'goal2') handleGoalScored(1);
            if (pair.bodyB.label === 'ball' && pair.bodyA.label === 'goal2') handleGoalScored(1);
            if (pair.bodyA.label === 'ball' && pair.bodyB.label === 'goal1') handleGoalScored(2);
            if (pair.bodyB.label === 'ball' && pair.bodyA.label === 'goal1') handleGoalScored(2);
            
            // بررسی برخورد بازیکنان با زمین برای قابلیت پرش
            players.forEach(p => {
                 if ((pair.bodyA === p.body && pair.bodyB.label === 'Rectangle Body') || (pair.bodyB === p.body && pair.bodyA.label === 'Rectangle Body')) {
                     p.isGrounded = true;
                 }
            });
        }
    });
}

/**
 * حلقه اصلی ترسیم بازی
 */
function draw() {
    if (isGameOver) return;
    
    // پاک کردن صفحه
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // کشیدن پس زمینه
    ctx.fillStyle = "#87CEEB"; // Sky
    ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y - GROUND_THICKNESS/2);
    ctx.fillStyle = "#228B22"; // Grass
    ctx.fillRect(0, GROUND_Y - GROUND_THICKNESS/2, CANVAS_WIDTH, CANVAS_HEIGHT);

    // کشیدن دروازه‌ها
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(0, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT, GOAL_WIDTH, GOAL_HEIGHT);
    ctx.fillRect(CANVAS_WIDTH - GOAL_WIDTH, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT, GOAL_WIDTH, GOAL_HEIGHT);


    // ترسیم تمام اجسام فیزیکی
    const allBodies = Composite.allBodies(world);
    allBodies.forEach(body => {
        ctx.beginPath();
        const vertices = body.vertices;
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let j = 1; j < vertices.length; j++) {
            ctx.lineTo(vertices[j].x, vertices[j].y);
        }
        ctx.lineTo(vertices[0].x, vertices[0].y);

        // تعیین رنگ بر اساس نوع جسم
        if (body.label === 'player1') {
            ctx.fillStyle = players[0].color; // رنگ بازیکن ۱
            ctx.fill();
        } else if (body.label === 'player2') {
            ctx.fillStyle = players[1].color; // رنگ بازیکن ۲
            ctx.fill();
        } else if (body.label === 'ball') {
            ctx.fillStyle = 'white'; // رنگ توپ
            ctx.fill();
        } else if (body.isStatic) {
            // زمین، دیوارها و تیرک دروازه
            ctx.fillStyle = body.render.fillStyle || '#444'; // رنگ پیش‌فرض برای اجسام استاتیک
             if (body.label === 'Rectangle Body' && body.position.y > CANVAS_HEIGHT/2) { // Ground
                ctx.fillStyle = '#228B22';
            } else if (goals.team1[0] === body || goals.team2[0] === body) { // Goal posts
                ctx.fillStyle = '#FFF';
            } else {
                 ctx.fillStyle = '#666'; // Walls & Ceiling
            }
            ctx.fill();
        }

        // همیشه یک حاشیه نازک مشکی بکش
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#000';
        ctx.stroke();
    });

    handlePlayerControls();
    requestAnimationFrame(draw);
}

/**
 * کنترل حرکت و پرش بازیکنان
 */
function handlePlayerControls() {
    // بازیکن ۱ (کلیدهای A, W, D)
    const p1 = players[0];
    if (keysPressed['a']) Body.applyForce(p1.body, p1.body.position, { x: -MOVE_FORCE, y: 0 });
    if (keysPressed['d']) Body.applyForce(p1.body, p1.body.position, { x: MOVE_FORCE, y: 0 });
    if (keysPressed['w'] && p1.isGrounded) {
        Body.applyForce(p1.body, p1.body.position, { x: 0, y: -JUMP_FORCE });
        p1.isGrounded = false;
    }

    // بازیکن ۲ (کلیدهای جهت‌نما)
    const p2 = players[1];
    if (keysPressed['arrowleft']) Body.applyForce(p2.body, p2.body.position, { x: -MOVE_FORCE, y: 0 });
    if (keysPressed['arrowright']) Body.applyForce(p2.body, p2.body.position, { x: MOVE_FORCE, y: 0 });
    if (keysPressed['arrowup'] && p2.isGrounded) {
        Body.applyForce(p2.body, p2.body.position, { x: 0, y: -JUMP_FORCE });
        p2.isGrounded = false;
    }
}

/**
 * مدیریت گل زدن
 */
function handleGoalScored(scoringTeam) {
    if (scoringTeam === 1) {
        team1Score++;
        team1ScoreDisplay.textContent = team1Score;
    } else {
        team2Score++;
        team2ScoreDisplay.textContent = team2Score;
    }
    
    gameMessageDisplay.textContent = "گل!";
    
    // برگرداندن بازیکنان و توپ به مکان اولیه پس از ۱ ثانیه
    setTimeout(() => {
        resetPositions();
        gameMessageDisplay.textContent = "";
    }, 1000);
}

/**
 * بازنشانی موقعیت بازیکنان و توپ
 */
function resetPositions() {
    Body.setPosition(players[0].body, { x: 200, y: 450 });
    Body.setVelocity(players[0].body, { x: 0, y: 0 });
    Body.setAngle(players[0].body, 0);

    Body.setPosition(players[1].body, { x: 600, y: 450 });
    Body.setVelocity(players[1].body, { x: 0, y: 0 });
    Body.setAngle(players[1].body, 0);

    Body.setPosition(ball, { x: CANVAS_WIDTH / 2, y: 100 });
    Body.setVelocity(ball, { x: 0, y: 0 });
}

/**
 * شروع تایمر و حلقه بازی
 */
function startGame() {
    runner = Runner.create();
    Runner.run(runner, engine);
    
    roundTimerId = setInterval(() => {
        gameTimeRemaining--;
        timerDisplay.textContent = gameTimeRemaining;
        if (gameTimeRemaining <= 0) {
            endGame();
        }
    }, 1000);

    draw();
}

/**
 * پایان بازی
 */
function endGame() {
    clearInterval(roundTimerId);
    isGameOver = true;
    Runner.stop(runner);
    let winnerMessage = "مساوی!";
    if (team1Score > team2Score) winnerMessage = "تیم قرمز برنده شد!";
    if (team2Score > team1Score) winnerMessage = "تیم آبی برنده شد!";
    gameMessageDisplay.textContent = `پایان بازی! ${winnerMessage}`;
}

// --- نقطه شروع اصلی برنامه ---
window.addEventListener('DOMContentLoaded', setup);
