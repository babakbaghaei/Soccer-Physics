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
const mainCanvas = document.getElementById('gameCanvas'); // Renamed for clarity
const mainCtx = mainCanvas.getContext('2d'); // Renamed for clarity
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
const PIXELATION_SCALE_FACTOR = 0.5; // e.g., 0.5 means render at half resolution (400x300)
let lowResCanvas;
let lowResCtx;

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
const PLAYER_SIZE = 40;
const PLAYER_WIDTH = PLAYER_SIZE;
const PLAYER_HEIGHT = PLAYER_SIZE;
const JUMP_FORCE = 0.18;
const MOVE_FORCE = 0.015;
const AIR_MOVE_FORCE_MULTIPLIER = 0.3;

const keysPressed = {};

// ===================================================================================
// Setup Function
// ===================================================================================
function setup() {
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
    startGame();
}

// ===================================================================================
// Entity Creation Functions
// ===================================================================================
function createField() {
    const ground = Bodies.rectangle(CANVAS_WIDTH / 2, GROUND_Y, CANVAS_WIDTH, GROUND_THICKNESS, { isStatic: true, render: { fillStyle: '#228B22' } });
    const leftWall = Bodies.rectangle(-WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, render: { fillStyle: '#666666' } });
    const rightWall = Bodies.rectangle(CANVAS_WIDTH + WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, render: { fillStyle: '#666666' } });
    const ceiling = Bodies.rectangle(CANVAS_WIDTH / 2, -WALL_THICKNESS / 2, CANVAS_WIDTH, WALL_THICKNESS, { isStatic: true, render: { fillStyle: '#666666' } });

    const goal1Post = Bodies.rectangle(GOAL_WIDTH, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, 10, GOAL_HEIGHT, {
        isStatic: true, render: { fillStyle: '#FFFFFF' },
        collisionFilter: { category: goalPostCategory, mask: playerCategory | ballCategory }
    });
    const goal1Sensor = Bodies.rectangle(GOAL_WIDTH / 2, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, GOAL_WIDTH, GOAL_HEIGHT, {
        isStatic: true, isSensor: true, label: 'goal1', render: { visible: false }
    });
    goals.team1 = [goal1Post, goal1Sensor];

    const goal2Post = Bodies.rectangle(CANVAS_WIDTH - GOAL_WIDTH, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, 10, GOAL_HEIGHT, {
        isStatic: true, render: { fillStyle: '#FFFFFF' },
        collisionFilter: { category: goalPostCategory, mask: playerCategory | ballCategory }
    });
    const goal2Sensor = Bodies.rectangle(CANVAS_WIDTH - GOAL_WIDTH / 2, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, GOAL_WIDTH, GOAL_HEIGHT, {
        isStatic: true, isSensor: true, label: 'goal2', render: { visible: false }
    });
    goals.team2 = [goal2Post, goal2Sensor];
    
    World.add(world, [ground, leftWall, rightWall, ceiling, ...goals.team1, ...goals.team2]);
}

function createPlayers() {
    const player1Body = Bodies.rectangle(200, 450, PLAYER_WIDTH, PLAYER_HEIGHT, {
        density: PLAYER_DENSITY, friction: PLAYER_FRICTION, restitution: PLAYER_RESTITUTION, label: 'player1',
        collisionFilter: { category: playerCategory, mask: worldCategory | ballCategory | goalPostCategory | playerCategory }
    });
    players.push({ body: player1Body, team: 1, isGrounded: false, color: '#D9534F' });

    const player2Body = Bodies.rectangle(CANVAS_WIDTH - 200, 450, PLAYER_WIDTH, PLAYER_HEIGHT, {
        density: PLAYER_DENSITY, friction: PLAYER_FRICTION, restitution: PLAYER_RESTITUTION, label: 'player2',
        collisionFilter: { category: playerCategory, mask: worldCategory | ballCategory | goalPostCategory | playerCategory }
    });
    players.push({ body: player2Body, team: 2, isGrounded: false, color: '#428BCA' });
    World.add(world, [player1Body, player2Body]);
}

function createBall() {
    ball = Bodies.circle(CANVAS_WIDTH / 2, 100, BALL_RADIUS, {
        restitution: 0.8, friction: 0.01, frictionAir: 0.005, density: 0.001, label: 'ball',
        render: { sprite: { texture: null, xScale: 1, yScale: 1 } } // Custom rendered
    });
    World.add(world, ball);
}

// ===================================================================================
// Drawing Functions (Now use targetCtx and scaled parameters)
// ===================================================================================
let sunPosition = { x: 100, y: 100 };
let cloudPositions = [
    { x: 150, y: 120, width: 80, height: 30, speed: 0.3 },
    { x: 400, y: 80, width: 100, height: 40, speed: 0.2 },
    { x: 650, y: 150, width: 70, height: 25, speed: 0.4 }
];

function drawPixelatedSun(targetCtx, x_scaled, y_scaled, radius_scaled) {
    targetCtx.fillStyle = '#FFD700';
    const pixelSizeOnLowRes = Math.max(1, Math.floor(8 * PIXELATION_SCALE_FACTOR));
    for (let i_offset = -radius_scaled; i_offset <= radius_scaled; i_offset += pixelSizeOnLowRes) {
        for (let j_offset = -radius_scaled; j_offset <= radius_scaled; j_offset += pixelSizeOnLowRes) {
            if (i_offset * i_offset + j_offset * j_offset <= radius_scaled * radius_scaled) {
                targetCtx.fillRect(x_scaled + i_offset, y_scaled + j_offset, pixelSizeOnLowRes, pixelSizeOnLowRes);
            }
        }
    }
}

function drawPixelatedCloud(targetCtx, x_scaled, y_scaled, width_scaled, height_scaled) {
    targetCtx.fillStyle = '#FFFFFF';
    const pixelSizeOnLowRes = Math.max(1, Math.floor(10 * PIXELATION_SCALE_FACTOR));
    for (let i = 0; i < width_scaled; i += pixelSizeOnLowRes) {
        for (let j = 0; j < height_scaled; j += pixelSizeOnLowRes) {
            if (Math.random() > 0.2 || (i > pixelSizeOnLowRes && i < width_scaled - pixelSizeOnLowRes * 2 && j > pixelSizeOnLowRes && j < height_scaled - pixelSizeOnLowRes*2) ) {
                 targetCtx.fillRect(x_scaled + i, y_scaled + j, pixelSizeOnLowRes, pixelSizeOnLowRes);
            }
        }
    }
    for (let k = 0; k < 3; k++) {
        let puffX_offset = Math.random() * (width_scaled - pixelSizeOnLowRes*2) + pixelSizeOnLowRes;
        let puffY_offset = -height_scaled / 3 + Math.random() * (height_scaled/4) ;
        let puffW = pixelSizeOnLowRes * (Math.random() > 0.5 ? 2:1);
        let puffH = pixelSizeOnLowRes * (Math.random() > 0.5 ? 2:1);
        targetCtx.fillRect(x_scaled + puffX_offset, y_scaled + puffY_offset, puffW, puffH);
    }
}

function drawDynamicSky(targetCtx) {
    const gameProgress = (ROUND_DURATION_SECONDS - gameTimeRemaining) / ROUND_DURATION_SECONDS;
    let sunWorldX = 50 + gameProgress * (CANVAS_WIDTH - 100);
    let sunWorldY = 80 + Math.sin(gameProgress * Math.PI) * 40;
    let sunWorldRadius = 25;

    drawPixelatedSun(targetCtx,
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
        drawPixelatedCloud(targetCtx,
            cloud.x * PIXELATION_SCALE_FACTOR,
            cloud.y * PIXELATION_SCALE_FACTOR,
            cloud.width * PIXELATION_SCALE_FACTOR,
            cloud.height * PIXELATION_SCALE_FACTOR
        );
    });
}

function drawPixelatedNet(targetCtx, x_scaled, y_scaled, width_scaled, height_scaled) {
    targetCtx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
    targetCtx.lineWidth = Math.max(1, Math.floor(3 * PIXELATION_SCALE_FACTOR));
    const spacing_scaled = Math.max(1, Math.floor(12 * PIXELATION_SCALE_FACTOR));

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

function drawPixelatedSoccerBall(targetCtx, body) {
    const x_scaled = body.position.x * PIXELATION_SCALE_FACTOR;
    const y_scaled = body.position.y * PIXELATION_SCALE_FACTOR;
    const radius_scaled = body.circleRadius * PIXELATION_SCALE_FACTOR;
    const segmentAngle = Math.PI / 3;
    const pixelSizeOnLowRes = Math.max(1, Math.floor(5 * PIXELATION_SCALE_FACTOR));

    targetCtx.beginPath();
    targetCtx.arc(x_scaled, y_scaled, radius_scaled, 0, 2 * Math.PI);
    targetCtx.fillStyle = 'white';
    targetCtx.fill();
    targetCtx.fillStyle = 'black';
    for (let angle = 0; angle < 2 * Math.PI; angle += segmentAngle / 2) {
        for (let r_scaled = radius_scaled * 0.4; r_scaled < radius_scaled; r_scaled += pixelSizeOnLowRes * 2) {
            if ( (Math.floor(angle / (segmentAngle/2)) % 2 === 0 && Math.floor(r_scaled / (pixelSizeOnLowRes*2)) % 2 === 0) ||
                 (Math.floor(angle / (segmentAngle/2)) % 2 !== 0 && Math.floor(r_scaled / (pixelSizeOnLowRes*2)) % 2 !== 0) ) {
                const patchX_scaled = x_scaled + (r_scaled + pixelSizeOnLowRes) * Math.cos(angle + segmentAngle/4);
                const patchY_scaled = y_scaled + (r_scaled + pixelSizeOnLowRes) * Math.sin(angle + segmentAngle/4);
                if (Math.sqrt(Math.pow(patchX_scaled - x_scaled, 2) + Math.pow(patchY_scaled - y_scaled, 2)) < radius_scaled - pixelSizeOnLowRes) {
                     targetCtx.fillRect(
                         Math.floor(patchX_scaled/pixelSizeOnLowRes)*pixelSizeOnLowRes - pixelSizeOnLowRes/2,
                         Math.floor(patchY_scaled/pixelSizeOnLowRes)*pixelSizeOnLowRes - pixelSizeOnLowRes/2,
                         pixelSizeOnLowRes, pixelSizeOnLowRes);
                }
            }
        }
    }
    targetCtx.beginPath();
    targetCtx.arc(x_scaled, y_scaled, radius_scaled, 0, 2 * Math.PI);
    targetCtx.strokeStyle = 'black';
    targetCtx.lineWidth = Math.max(1, Math.floor(2 * PIXELATION_SCALE_FACTOR));
    targetCtx.stroke();
}

// ===================================================================================
// Main Draw Loop (Refactored for Low-Resolution Rendering)
// ===================================================================================
function draw() {
    if (isGameOver) return;

    // --- Start Drawing to Low-Resolution Off-Screen Canvas ---
    lowResCtx.clearRect(0, 0, lowResCanvas.width, lowResCanvas.height);

    // 1. Base sky color on low-res canvas
    lowResCtx.fillStyle = "lightgray"; // Sky color
    lowResCtx.fillRect(0, 0, lowResCanvas.width, lowResCanvas.height);

    // 2. Dynamic sky (sun, clouds) on low-res canvas
    drawDynamicSky(lowResCtx);

    // 3. Grass on low-res canvas
    lowResCtx.fillStyle = "#228B22"; // Grass color from ground body render
    lowResCtx.fillRect(
        0,
        (GROUND_Y - GROUND_THICKNESS/2) * PIXELATION_SCALE_FACTOR,
        lowResCanvas.width,
        (CANVAS_HEIGHT - (GROUND_Y - GROUND_THICKNESS/2)) * PIXELATION_SCALE_FACTOR
    );

    // 4. Goals (nets) on low-res canvas
    drawPixelatedNet(lowResCtx,
        0,
        (GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT) * PIXELATION_SCALE_FACTOR,
        GOAL_WIDTH * PIXELATION_SCALE_FACTOR,
        GOAL_HEIGHT * PIXELATION_SCALE_FACTOR
    );
    drawPixelatedNet(lowResCtx,
        (CANVAS_WIDTH - GOAL_WIDTH) * PIXELATION_SCALE_FACTOR,
        (GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT) * PIXELATION_SCALE_FACTOR,
        GOAL_WIDTH * PIXELATION_SCALE_FACTOR,
        GOAL_HEIGHT * PIXELATION_SCALE_FACTOR
    );

    // 5. All physics bodies on low-res canvas
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
        } else if (body.label === 'ball') {
            drawPixelatedSoccerBall(lowResCtx, body);
        } else if (body.isStatic) {
            if (body.render && body.render.fillStyle) {
                lowResCtx.fillStyle = body.render.fillStyle;
            } else {
                lowResCtx.fillStyle = '#CCC';
            }
            // Avoid filling ground again if already done, but other static bodies like walls/posts are fine.
            // The main ground rect is drawn before this loop. Goal posts will be filled here.
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
    // --- End Drawing to Low-Resolution Off-Screen Canvas ---

    // --- Upscale lowResCanvas to mainCanvas ---
    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    mainCtx.imageSmoothingEnabled = false;
    mainCtx.mozImageSmoothingEnabled = false;
    mainCtx.webkitImageSmoothingEnabled = false;
    mainCtx.msImageSmoothingEnabled = false;
    mainCtx.drawImage(
        lowResCanvas,
        0, 0, lowResCanvas.width, lowResCanvas.height,
        0, 0, mainCanvas.width, mainCanvas.height
    );

    handlePlayerControls();
    requestAnimationFrame(draw);
}

// ===================================================================================
// Event Handlers and Game Logic
// ===================================================================================
function setupControls() {
    window.addEventListener('keydown', (e) => { keysPressed[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { keysPressed[e.key.toLowerCase()] = false; });
}

function setupCollisions() {
    Events.on(engine, 'collisionStart', (event) => {
        const pairs = event.pairs;
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            if (pair.bodyA.label === 'ball' && pair.bodyB.label === 'goal2') handleGoalScored(1);
            if (pair.bodyB.label === 'ball' && pair.bodyA.label === 'goal2') handleGoalScored(1);
            if (pair.bodyA.label === 'ball' && pair.bodyB.label === 'goal1') handleGoalScored(2);
            if (pair.bodyB.label === 'ball' && pair.bodyA.label === 'goal1') handleGoalScored(2);
            players.forEach(p => {
                 if ((pair.bodyA === p.body && pair.bodyB.label === 'Rectangle Body') || (pair.bodyB === p.body && pair.bodyA.label === 'Rectangle Body')) {
                     p.isGrounded = true;
                 }
            });
        }
    });
}

function handlePlayerControls() {
    const p1 = players[0];
    const currentMoveForceP1 = p1.isGrounded ? MOVE_FORCE : MOVE_FORCE * AIR_MOVE_FORCE_MULTIPLIER;
    if (keysPressed['a']) {
        Body.applyForce(p1.body, p1.body.position, { x: -currentMoveForceP1, y: 0 });
        console.log("Player 1 (Red) Action: 'a' (Move Left). Grounded: " + p1.isGrounded);
    }
    if (keysPressed['d']) {
        Body.applyForce(p1.body, p1.body.position, { x: currentMoveForceP1, y: 0 });
        console.log("Player 1 (Red) Action: 'd' (Move Right). Grounded: " + p1.isGrounded);
    }
    if (keysPressed['w'] && p1.isGrounded) {
        Body.applyForce(p1.body, p1.body.position, { x: 0, y: -JUMP_FORCE });
        p1.isGrounded = false;
        console.log("Player 1 (Red) Action: 'w' (Jump). Was Grounded: true");
    } else if (keysPressed['w'] && !p1.isGrounded) {
        console.log("Player 1 (Red) Action: 'w' (Jump attempted in air). Was Grounded: false");
    }

    const p2 = players[1];
    const currentMoveForceP2 = p2.isGrounded ? MOVE_FORCE : MOVE_FORCE * AIR_MOVE_FORCE_MULTIPLIER;
    if (keysPressed['arrowleft']) {
        Body.applyForce(p2.body, p2.body.position, { x: -currentMoveForceP2, y: 0 });
        console.log("Player 2 (Blue) Action: 'ArrowLeft' (Move Left). Grounded: " + p2.isGrounded);
    }
    if (keysPressed['arrowright']) {
        Body.applyForce(p2.body, p2.body.position, { x: currentMoveForceP2, y: 0 });
        console.log("Player 2 (Blue) Action: 'ArrowRight' (Move Right). Grounded: " + p2.isGrounded);
    }
    if (keysPressed['arrowup'] && p2.isGrounded) {
        Body.applyForce(p2.body, p2.body.position, { x: 0, y: -JUMP_FORCE });
        p2.isGrounded = false;
        console.log("Player 2 (Blue) Action: 'ArrowUp' (Jump). Was Grounded: true");
    } else if (keysPressed['arrowup'] && !p2.isGrounded) {
        console.log("Player 2 (Blue) Action: 'ArrowUp' (Jump attempted in air). Was Grounded: false");
    }
}

let goalScoredThisTick = false;
function handleGoalScored(scoringTeam) {
    if (isGameOver || goalScoredThisTick) return;
    goalScoredThisTick = true;

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
        gameMessageDisplay.textContent = "";
        gameMessageDisplay.classList.remove('has-text');
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
}

function startGame() {
    runner = Runner.create();
    Runner.run(runner, engine);
    roundTimerId = setInterval(() => {
        gameTimeRemaining--;
        timerDisplay.textContent = `Time: ${gameTimeRemaining}`; // Ensure "Time: " prefix
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
