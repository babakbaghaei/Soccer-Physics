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
// Make players square for pixel art style
const PLAYER_SIZE = 40; // Use a single size for width and height
const PLAYER_WIDTH = PLAYER_SIZE;
const PLAYER_HEIGHT = PLAYER_SIZE;
// LEG_WIDTH and LEG_HEIGHT might not be used if players are simple squares
// const LEG_WIDTH = 20;
// const LEG_HEIGHT = 40;

// Adjusted JUMP_FORCE: Goal height is 120. Ground Y is 580. Ground thickness 40.
// Goal top is GROUND_Y - GROUND_THICKNESS/2 - GOAL_HEIGHT = 580 - 20 - 120 = 440
// Player starts at Y 450. Player height is PLAYER_SIZE.
// To jump to 90% of goal height (relative to ground):
// Jump apex should be around: GROUND_Y - GROUND_THICKNESS/2 - (PLAYER_HEIGHT/2) - (GOAL_HEIGHT * 0.9)
// This requires relating JUMP_FORCE to gravity and mass.
// For now, this will be an empirical adjustment. Let's start with a slightly reduced value
// and test. Original was 0.4. Gravity is 1.5.
// Previous adjustment to 0.30 was still "very very high".
// New target: jump no higher than the goal's height.
const JUMP_FORCE = 0.18; // Significantly reduced jump force. Needs testing.

const MOVE_FORCE = 0.015; // Base move force
const AIR_MOVE_FORCE_MULTIPLIER = 0.3; // Player has 30% of normal move force in air

const keysPressed = {};

// ===================================================================================
// بخش‌های کلیدی که اضافه شده‌اند
// ===================================================================================

/**
 * تابع اصلی برای راه‌اندازی کل بازی
 */
function setup() {
    // Set canvas dimensions correctly
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

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
    const goal1Post = Bodies.rectangle(GOAL_WIDTH, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, 10, GOAL_HEIGHT, {
        isStatic: true,
        render: { fillStyle: '#FFFFFF' }, // Explicitly white for pixel theme
        collisionFilter: { category: goalPostCategory, mask: playerCategory | ballCategory } // Collide with player and ball
    });
    const goal1Sensor = Bodies.rectangle(GOAL_WIDTH / 2, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, GOAL_WIDTH, GOAL_HEIGHT, {
        isStatic: true,
        isSensor: true, // Sensor for detecting goal
        label: 'goal1',
        render: { visible: false } // Sensor should not be visible
    });
    goals.team1 = [goal1Post, goal1Sensor];

    // دروازه تیم ۲ (راست)
    const goal2Post = Bodies.rectangle(CANVAS_WIDTH - GOAL_WIDTH, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, 10, GOAL_HEIGHT, {
        isStatic: true,
        render: { fillStyle: '#FFFFFF' }, // Explicitly white
        collisionFilter: { category: goalPostCategory, mask: playerCategory | ballCategory }
    });
    const goal2Sensor = Bodies.rectangle(CANVAS_WIDTH - GOAL_WIDTH / 2, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, GOAL_WIDTH, GOAL_HEIGHT, {
        isStatic: true,
        isSensor: true,
        label: 'goal2',
        render: { visible: false }
    });
    goals.team2 = [goal2Post, goal2Sensor];
    
    World.add(world, [ground, leftWall, rightWall, ceiling, ...goals.team1, ...goals.team2]);
}

/**
 * ساخت بازیکنان
 */
function createPlayers() {
    // بازیکن ۱ (چپ - کاربر)
    const player1Body = Bodies.rectangle(200, 450, PLAYER_WIDTH, PLAYER_HEIGHT, {
        density: PLAYER_DENSITY,
        friction: PLAYER_FRICTION,
        restitution: PLAYER_RESTITUTION,
        label: 'player1', // User controlled
        collisionFilter: { category: playerCategory, mask: worldCategory | ballCategory | goalPostCategory | playerCategory }
    });
    // Team 1 (left, user) color: Red
    players.push({ body: player1Body, team: 1, isGrounded: false, color: '#D9534F' });

    // بازیکن ۲ (راست - رقیب)
    const player2Body = Bodies.rectangle(CANVAS_WIDTH - 200, 450, PLAYER_WIDTH, PLAYER_HEIGHT, { // Ensure it's on the right side
        density: PLAYER_DENSITY,
        friction: PLAYER_FRICTION,
        restitution: PLAYER_RESTITUTION,
        label: 'player2', // AI or second player
        collisionFilter: { category: playerCategory, mask: worldCategory | ballCategory | goalPostCategory | playerCategory }
    });
    // Team 2 (right, opponent) color: Blue
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
            // fillStyle will be handled by custom drawing function
            // We can add a custom property for our drawing function if needed
            sprite: {
                texture: null, // No actual image file, we'll draw it
                xScale: 1,
                yScale: 1
            }
        }
    });
    World.add(world, ball);
}


function drawPixelatedSoccerBall(body) {
    const { x, y } = body.position;
    const radius = body.circleRadius; // BALL_RADIUS
    const segmentAngle = Math.PI / 3; // For a hexagon-like pattern base
    // Increased pixelSize for a chunkier ball pattern
    const pixelSize = Math.max(4, Math.floor(radius / 4));

    // Draw white background first (or main color)
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();

    ctx.fillStyle = 'black';

    // Create a simplified checkered pattern with "pixel" squares
    // This is a very basic representation. True soccer ball patterns are complex.
    // We'll draw some black "pixels" in a somewhat regular pattern.
    for (let angle = 0; angle < 2 * Math.PI; angle += segmentAngle / 2) {
        for (let r = radius * 0.4; r < radius; r += pixelSize * 2) {
            if ( (Math.floor(angle / (segmentAngle/2)) % 2 === 0 && Math.floor(r / (pixelSize*2)) % 2 === 0) ||
                 (Math.floor(angle / (segmentAngle/2)) % 2 !== 0 && Math.floor(r / (pixelSize*2)) % 2 !== 0) ) {

                const patchX = x + (r + pixelSize) * Math.cos(angle + segmentAngle/4);
                const patchY = y + (r + pixelSize) * Math.sin(angle + segmentAngle/4);

                // Draw a small square (pixel)
                // Ensure pixels are somewhat within the ball's drawn circle
                if (Math.sqrt((patchX-x)*(patchX-x) + (patchY-y)*(patchY-y)) < radius - pixelSize) {
                     ctx.fillRect(Math.floor(patchX/pixelSize)*pixelSize - pixelSize/2, Math.floor(patchY/pixelSize)*pixelSize - pixelSize/2, pixelSize, pixelSize);
                }
            }
        }
    }
    // Draw outline
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = Math.max(1, Math.floor(pixelSize/2));
    ctx.stroke();
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

    // 1. کشیدن پس زمینه آسمان پایه (جایگزین رنگ پس زمینه canvas از CSS)
    ctx.fillStyle = "lightgray"; // Base sky color, can be changed
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. کشیدن آسمان دینامیک (خورشید و ابرها)
    drawDynamicSky();

    // 3. کشیدن زمین چمن (باید بعد از آسمان باشد)
    ctx.fillStyle = "#228B22"; // Grass
    ctx.fillRect(0, GROUND_Y - GROUND_THICKNESS/2, CANVAS_WIDTH, CANVAS_HEIGHT - (GROUND_Y - GROUND_THICKNESS/2));


    // کشیدن دروازه‌ها (توری)
    drawPixelatedNet(0, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT, GOAL_WIDTH, GOAL_HEIGHT);
    drawPixelatedNet(CANVAS_WIDTH - GOAL_WIDTH, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT, GOAL_WIDTH, GOAL_HEIGHT);

    // ترسیم تمام اجسام فیزیکی
    const allBodies = Composite.allBodies(world);
    allBodies.forEach(body => {
        if (body.render && body.render.visible === false) { // Do not render explicitly invisible bodies (like goal sensors)
            return;
        }

        ctx.beginPath();
        const vertices = body.vertices;
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let j = 1; j < vertices.length; j++) {
            ctx.lineTo(vertices[j].x, vertices[j].y);
        }
        ctx.lineTo(vertices[0].x, vertices[0].y);

        // تعیین رنگ بر اساس نوع جسم
        if (body.label === 'player1' || body.label === 'player2') {
            // Common rendering for both players (pixelated squares)
            const player = (body.label === 'player1') ? players[0] : players[1];
            ctx.fillStyle = player.color;

            // Draw square directly using position and size
            // Matter.js vertices for a rectangle are fine, but for a perfect square pixel look:
            const pixelSize = 2; // Or some factor of PLAYER_SIZE
            ctx.beginPath(); // Start a new path for the player square
            // Ensure x,y is top-left for fillRect, Matter.js body.position is center
            const topLeftX = Math.floor((body.position.x - PLAYER_WIDTH / 2) / pixelSize) * pixelSize;
            const topLeftY = Math.floor((body.position.y - PLAYER_HEIGHT / 2) / pixelSize) * pixelSize;

            // Simple filled square
            ctx.fillRect(topLeftX, topLeftY, PLAYER_WIDTH, PLAYER_HEIGHT);

            // No need to call ctx.fill() again as fillRect does it.
            // The generic fill() call after this if/else block will be skipped if we handle it here.
            // The generic stroke will still apply unless we skip it for players too.
            // For pixelated look, the main stroke later is fine.

        } else if (body.label === 'ball') {
            // Custom drawing for the soccer ball
            // The fillStyle and stroke below the main loop will apply to the outline if not handled by drawPixelatedSoccerBall
            // No need to call ctx.fill() here as drawPixelatedSoccerBall handles its own filling.
            // However, we still need to beginPath and define the circle for the generic stroke later if drawPixelatedSoccerBall doesn't stroke itself.
            // For simplicity, let drawPixelatedSoccerBall handle everything including its own stroke.
            // So, we remove the generic path drawing for the ball here IF drawPixelatedSoccerBall is comprehensive.
            // The current generic path drawing:
            // ctx.beginPath();
            // const vertices = body.vertices; ... ctx.lineTo(vertices[0].x, vertices[0].y);
            // is for polygons. For circles, Matter.js bodies have `body.circleRadius`.
            // The default renderer handles this. For custom, we draw it.

            // The existing loop draws paths for ALL bodies. If we custom draw ball,
            // we might not need the generic path drawing for it.
            // However, `drawPixelatedSoccerBall` is called *after* this loop. This is incorrect.
            // Let's adjust. Ball drawing should be part of this loop.

            // Corrected approach:
            // The loop iterates through allBodies. When body.label === 'ball', we call our custom function.
            // The `ctx.beginPath()...ctx.lineTo()` part is for polygonal bodies.
            // Matter.js `Render` module handles circle drawing differently.
            // Since we are doing custom rendering, we need to ensure we either skip generic polygon rendering for the ball
            // or ensure `drawPixelatedSoccerBall` is called appropriately.

            // Simplest: if it's the ball, call custom draw and skip generic fill/stroke for it in this part.
            // The current structure with `ctx.beginPath()` at the start of each body is fine.
            // We just need to ensure fillStyle isn't applied generically if `drawPixelatedSoccerBall` does it.
            // And `drawPixelatedSoccerBall` needs the body object.

            // The current code structure for rendering is:
            // for each body:
            //   beginPath (polygon)
            //   determine fillStyle
            //   fill()
            //   stroke()
            // This means `drawPixelatedSoccerBall` should be called INSTEAD of the generic fill() for the ball.
            // And it should handle its own path definition or use x,y,radius.

            // Let's call custom draw for ball here and let it handle its path.
            // The generic ctx.beginPath()...lineTo() is for polygons.
            // MatterJS internally has different render paths for circles vs polygons.
            // We will rely on body.position and body.circleRadius for the ball.

            // So, we simply don't call ctx.fill() here for the ball, and let the stroke be generic.
            // OR, the custom function handles fill and stroke.
            // Let's assume custom function handles fill and stroke.
            drawPixelatedSoccerBall(body); // This function will handle its own beginPath, fill, stroke.
                                       // So, the generic fill and stroke later should be skipped for the ball.

        } else if (body.isStatic) {
            // Static bodies like ground, walls, goal posts
            if (body.render && body.render.fillStyle) {
                ctx.fillStyle = body.render.fillStyle;
            } else {
                ctx.fillStyle = '#CCC'; // Default for other static bodies
            }
            ctx.fill();
        }

        // Always draw a thin black border for all bodies for pixel effect
        // If it's the ball, and drawPixelatedSoccerBall handles its own stroke, skip this.
        // If it's a player, and we want the generic stroke, it's fine.
        // The current player drawing uses fillRect, which doesn't affect the main path for stroke.
        // So, the generic stroke will still apply to the polygonal path of the player body.
        if (!body.isSensor && body.label !== 'ball') {
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#000000';
            ctx.stroke(); // This will stroke the path defined by body.vertices
        } else if (body.label === 'ball') {
            // drawPixelatedSoccerBall handles its own stroking.
        }
    });

    handlePlayerControls();
    requestAnimationFrame(draw);
}


// --- توابع مربوط به آسمان دینامیک ---
let sunPosition = { x: 100, y: 100 };
let cloudPositions = [
    { x: 150, y: 120, width: 80, height: 30, speed: 0.3 },
    { x: 400, y: 80, width: 100, height: 40, speed: 0.2 },
    { x: 650, y: 150, width: 70, height: 25, speed: 0.4 }
];

function drawPixelatedSun(x, y, radius) {
    ctx.fillStyle = '#FFD700'; // زرد طلایی برای خورشید
    // رسم دایره پیکسلی با استفاده از مربع‌های کوچک
    const pixelSize = 8; // Increased from 5 for chunkier sun pixels
    for (let i = -radius; i <= radius; i += pixelSize) {
        for (let j = -radius; j <= radius; j += pixelSize) {
            if (i * i + j * j <= radius * radius) {
                ctx.fillRect(x + i, y + j, pixelSize, pixelSize);
            }
        }
    }
}

function drawPixelatedCloud(x, y, width, height) {
    ctx.fillStyle = '#FFFFFF'; // سفید برای ابرها
    const pixelSize = 10; // اندازه هر "پیکسل" ابر

    // شکل ابر ساده با استفاده از مستطیل‌های پیکسلی
    // بدنه اصلی ابر
    for (let i = 0; i < width; i += pixelSize) {
        for (let j = 0; j < height; j += pixelSize) {
            // ایجاد حالت پف‌دار با چشم پوشی از برخی پیکسل‌ها در لبه‌ها
            if (Math.random() > 0.2 || (i > pixelSize && i < width - pixelSize * 2 && j > pixelSize && j < height - pixelSize*2) ) {
                 ctx.fillRect(x + i, y + j, pixelSize, pixelSize);
            }
        }
    }
    // برجستگی‌های کوچک در بالای ابر
    for (let k = 0; k < 3; k++) {
        let puffX = x + Math.random() * (width - pixelSize*2) + pixelSize;
        let puffY = y - height / 3 + Math.random() * (height/4) ;
        let puffW = pixelSize * (Math.random() > 0.5 ? 2:1)
        let puffH = pixelSize * (Math.random() > 0.5 ? 2:1)
        ctx.fillRect(puffX, puffY, puffW, puffH);
    }
}


function drawDynamicSky() {
    // به‌روزرسانی موقعیت خورشید
    // حرکت آرام خورشید از چپ به راست و کمی به پایین و بالا
    const gameProgress = (ROUND_DURATION_SECONDS - gameTimeRemaining) / ROUND_DURATION_SECONDS;
    sunPosition.x = 50 + gameProgress * (CANVAS_WIDTH - 100); // از یک سمت به سمت دیگر
    sunPosition.y = 80 + Math.sin(gameProgress * Math.PI) * 40; // حرکت قوسی شکل

    drawPixelatedSun(sunPosition.x, sunPosition.y, 25); // شعاع خورشید: ۲۵

    // به‌روزرسانی و رسم ابرها
    cloudPositions.forEach(cloud => {
        cloud.x += cloud.speed;
        if (cloud.x > CANVAS_WIDTH + cloud.width) { // اگر ابر از صفحه خارج شد
            cloud.x = -cloud.width; // برگرداندن به سمت چپ
            cloud.y = 50 + Math.random() * 100; // تغییر ارتفاع برای تنوع
        }
        drawPixelatedCloud(cloud.x, cloud.y, cloud.width, cloud.height);
    });
}

function drawPixelatedNet(x, y, width, height) {
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)'; // Light grey, semi-transparent net
    ctx.lineWidth = 3; // Increased from 2 for thicker net lines

    const spacing = 12; // Increased from 10 for wider net spacing

    // Vertical lines
    for (let i = 0; i <= width; i += spacing) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i, y + height);
        ctx.stroke();
    }

    // Horizontal lines
    for (let j = 0; j <= height; j += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, y + j);
        ctx.lineTo(x + width, y + j);
        ctx.stroke();
    }
}


/**
 * کنترل حرکت و پرش بازیکنان
 */
function handlePlayerControls() {
    // بازیکن ۱ (کاربر - کلیدهای W, A, D) - S key is not used for movement in this setup
    const p1 = players[0]; // Player 1 is now the user on the left
    const currentMoveForceP1 = p1.isGrounded ? MOVE_FORCE : MOVE_FORCE * AIR_MOVE_FORCE_MULTIPLIER;

    if (keysPressed['a']) { // Left
        Body.applyForce(p1.body, p1.body.position, { x: -currentMoveForceP1, y: 0 });
    }
    if (keysPressed['d']) { // Right
        Body.applyForce(p1.body, p1.body.position, { x: currentMoveForceP1, y: 0 });
    }
    if (keysPressed['w'] && p1.isGrounded) { // Jump
        Body.applyForce(p1.body, p1.body.position, { x: 0, y: -JUMP_FORCE });
        p1.isGrounded = false; // Set immediately to prevent double jump before next collision check
    }

    // بازیکن ۲ (رقیب - کلیدهای جهت‌نما)
    const p2 = players[1]; // Player 2 is the opponent on the right
    const currentMoveForceP2 = p2.isGrounded ? MOVE_FORCE : MOVE_FORCE * AIR_MOVE_FORCE_MULTIPLIER;

    if (keysPressed['arrowleft']) {
        Body.applyForce(p2.body, p2.body.position, { x: -currentMoveForceP2, y: 0 });
    }
    if (keysPressed['arrowright']) {
        Body.applyForce(p2.body, p2.body.position, { x: currentMoveForceP2, y: 0 });
    }
    if (keysPressed['arrowup'] && p2.isGrounded) {
        Body.applyForce(p2.body, p2.body.position, { x: 0, y: -JUMP_FORCE });
        p2.isGrounded = false;
    }
}

/**
 * مدیریت گل زدن
 */
function handleGoalScored(scoringTeam) {
    // Prevent multiple goals from one shot
    if (isGameOver || world.isPaused) return; // isPaused is a hypothetical state, you might need to implement it

    // Pause world updates briefly to prevent ball from passing through sensor multiple times
    // This is a simple way; a more robust solution might involve disabling the sensor temporarily.
    // Runner.stop(runner) / Runner.run(runner) might be too jarring.
    // A simpler flag:
    if (goalScoredThisTick) return;
    goalScoredThisTick = true;


    if (scoringTeam === 1) {
        team1Score++;
        team1ScoreDisplay.textContent = `Team 1: ${team1Score}`; // Update display format
    } else {
        team2Score++;
        team2ScoreDisplay.textContent = `Team 2: ${team2Score}`; // Update display format
    }
    
    gameMessageDisplay.textContent = "گل!";
    
    // برگرداندن بازیکنان و توپ به مکان اولیه پس از ۱ ثانیه
    setTimeout(() => {
        resetPositions();
        gameMessageDisplay.textContent = ""; // Clear message quickly too
        goalScoredThisTick = false; // Reset flag
    }, 50); // Reduced delay from 1000ms to 50ms for near-instant reset
}

// Add a flag to prevent multiple score registrations for a single goal event
let goalScoredThisTick = false;

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
