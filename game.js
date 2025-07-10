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
        isStatic: true, render: { fillStyle: '#FFFFFF' }, label: "goalPost1",
        collisionFilter: { category: goalPostCategory, mask: playerCategory | ballCategory }
    });
    // Sensor remains wider to define scoring area
    const goal1Sensor = Bodies.rectangle(GOAL_WIDTH / 2, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, GOAL_WIDTH, GOAL_HEIGHT, {
        isStatic: true, isSensor: true, label: 'goal1', render: { visible: false }
    });
    goals.team1 = [goal1Post, goal1Sensor];

    const goal2Post = Bodies.rectangle(CANVAS_WIDTH - GOAL_POST_WIDTH / 2, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, GOAL_POST_WIDTH, GOAL_HEIGHT, {
        isStatic: true, render: { fillStyle: '#FFFFFF' }, label: "goalPost2",
        collisionFilter: { category: goalPostCategory, mask: playerCategory | ballCategory }
    });
    const goal2Sensor = Bodies.rectangle(CANVAS_WIDTH - GOAL_WIDTH / 2, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, GOAL_WIDTH, GOAL_HEIGHT, {
        isStatic: true, isSensor: true, label: 'goal2', render: { visible: false }
    });
    goals.team2 = [goal2Post, goal2Sensor];
    
    World.add(world, [ground, leftWall, rightWall, ceiling, goal1Post, goal1Sensor, goal2Post, goal2Sensor]);
    console.log("Field created");
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
    console.log("Players created");
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
    console.log("Ball created");
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

// Draw football field lines and corner flags (chalk lines)
function drawFootballFieldLines(ctx) {
    // Side-view: all lines are drawn on the grass line (GROUND_Y - GROUND_THICKNESS/2)
    const scale = PIXELATION_SCALE_FACTOR;
    const grassY = (GROUND_Y - GROUND_THICKNESS / 2) * scale;
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(2, Math.floor(4 * scale));

    // Center mark (short vertical line)
    ctx.beginPath();
    ctx.moveTo((CANVAS_WIDTH / 2 - 10) * scale, grassY);
    ctx.lineTo((CANVAS_WIDTH / 2 + 10) * scale, grassY);
    ctx.stroke();

    // Penalty box lines (short verticals at each end)
    const penaltyBoxWidth = 120 * scale;
    ctx.beginPath();
    ctx.moveTo(penaltyBoxWidth, grassY);
    ctx.lineTo(penaltyBoxWidth, grassY - 20 * scale);
    ctx.moveTo((CANVAS_WIDTH - penaltyBoxWidth) * scale, grassY);
    ctx.lineTo((CANVAS_WIDTH - penaltyBoxWidth) * scale, grassY - 20 * scale);
    ctx.stroke();

    // Goal box lines (shorter verticals at each end)
    const goalBoxWidth = 50 * scale;
    ctx.beginPath();
    ctx.moveTo(goalBoxWidth, grassY);
    ctx.lineTo(goalBoxWidth, grassY - 12 * scale);
    ctx.moveTo((CANVAS_WIDTH - goalBoxWidth) * scale, grassY);
    ctx.lineTo((CANVAS_WIDTH - goalBoxWidth) * scale, grassY - 12 * scale);
    ctx.stroke();

    // Penalty spots (small circles)
    const penaltySpotRadius = 3 * scale;
    ctx.beginPath();
    ctx.arc(80 * scale, grassY, penaltySpotRadius, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc((CANVAS_WIDTH - 80) * scale, grassY, penaltySpotRadius, 0, 2 * Math.PI);
    ctx.fill();

    // Center spot (small circle)
    ctx.beginPath();
    ctx.arc((CANVAS_WIDTH / 2) * scale, grassY, penaltySpotRadius, 0, 2 * Math.PI);
    ctx.fill();

    // Corner arcs (small quarter arcs at ground corners)
    const cornerArcRadius = 10 * scale;
    ctx.beginPath();
    ctx.arc(0, grassY, cornerArcRadius, 0, 0.5 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH * scale, grassY, cornerArcRadius, Math.PI, 1.5 * Math.PI, true);
    ctx.stroke();

    // Corner flags (unchanged)
    const flagHeight = 18 * scale;
    const flagWidth = 4 * scale;
    const flagColor = '#FFD700'; // Gold/yellow
    // Left
    ctx.fillStyle = flagColor;
    ctx.fillRect(2 * scale, grassY - flagHeight, flagWidth, flagHeight);
    ctx.beginPath();
    ctx.moveTo((2 + flagWidth) * scale, grassY - flagHeight);
    ctx.lineTo((2 + flagWidth + 6) * scale, grassY - flagHeight + 4 * scale);
    ctx.lineTo((2 + flagWidth) * scale, grassY - flagHeight + 8 * scale);
    ctx.closePath();
    ctx.fill();
    // Right
    ctx.fillRect((CANVAS_WIDTH - flagWidth - 2) * scale, grassY - flagHeight, flagWidth, flagHeight);
    ctx.beginPath();
    ctx.moveTo((CANVAS_WIDTH - 2) * scale, grassY - flagHeight);
    ctx.lineTo((CANVAS_WIDTH - 2 - 6) * scale, grassY - flagHeight + 4 * scale);
    ctx.lineTo((CANVAS_WIDTH - 2) * scale, grassY - flagHeight + 8 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

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
    // Draw field lines and corner flags
    drawFootballFieldLines(lowResCtx);

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
        } else if (body.label === 'ball') {
            drawSimplifiedSoccerBall(lowResCtx, body);
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
        if (!body.isSensor && body.label !== 'ball') {
            lowResCtx.lineWidth = Math.max(1, Math.floor(2 * PIXELATION_SCALE_FACTOR));
            lowResCtx.strokeStyle = '#000000';
            lowResCtx.stroke();
        }
    });

    updateAndDrawParticles(lowResCtx); // Update and draw particles on the low-res canvas

    lowResCtx.restore(); // Restore context state after shake translation

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
    window.addEventListener('keyup', (e) => { keysPressed[e.key.toLowerCase()] = false; });
}

function setupCollisions() {
    Events.on(engine, 'collisionStart', (event) => {
        const pairs = event.pairs;
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;

            // Goal scoring
            if (bodyA.label === 'ball' && bodyB.label === 'goal2') {
                handleGoalScored(1);
                audioManager.playSound('goal');
            } else if (bodyB.label === 'ball' && bodyA.label === 'goal2') {
                handleGoalScored(1);
                audioManager.playSound('goal');
            } else if (bodyA.label === 'ball' && bodyB.label === 'goal1') {
                handleGoalScored(2);
                audioManager.playSound('goal');
            } else if (bodyB.label === 'ball' && bodyA.label === 'goal1') {
                handleGoalScored(2);
                audioManager.playSound('goal');
            }

            // Player grounding
            players.forEach(p => {
                 if ((bodyA === p.body && bodyB.label === 'Rectangle Body') || (bodyB === p.body && bodyA.label === 'Rectangle Body')) {
                     p.isGrounded = true;
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
                audioManager.playSound('bounce'); // Using bounce for post hit too
            } else if (bodyB.label === 'ball' && (bodyA.label === 'goalPost1' || bodyA.label === 'goalPost2')) {
                triggerScreenShake(5, 15);
                audioManager.playSound('bounce');
            }

            // Player hitting ball (kick sound)
            if ((bodyA.label === 'ball' && (bodyB.label === 'player1' || bodyB.label === 'player2')) ||
                (bodyB.label === 'ball' && (bodyA.label === 'player1' || bodyA.label === 'player2'))) {
                audioManager.playSound('kick');
            }
        }
    });
}

function handlePlayerControls() {
    const p1 = players[0];
    const currentMoveForceP1 = p1.isGrounded ? MOVE_FORCE : MOVE_FORCE * AIR_MOVE_FORCE_MULTIPLIER;

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
    } else if (keysPressed['w'] && !p1.isGrounded) {
        // Optional: sound for attempted jump in air? Probably not.
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
    if (isGameOver || goalScoredThisTick) return;
    goalScoredThisTick = true; // Prevent immediate re-triggering

    // Probabilistic "Near Miss Post Effect" (20% chance)
    if (Math.random() < 0.20) {
        triggerScreenShake(5, 15); // Use existing shake magnitude and duration

        // Determine ball's bounce direction based on which goal it was heading for
        let bounceXVelocity;
        if (scoringTeam === 1) { // Team 1 scored, ball was heading towards goal 2 (right side)
            bounceXVelocity = -(3 + Math.random() * 2); // Bounce left
        } else { // Team 2 scored, ball was heading towards goal 1 (left side)
            bounceXVelocity = (3 + Math.random() * 2); // Bounce right
        }
        const bounceYVelocity = -(2 + Math.random() * 2); // Bounce slightly up

        Body.setVelocity(ball, { x: bounceXVelocity, y: bounceYVelocity });

        // Apply a bit of spin for more dynamic bounce
        Body.setAngularVelocity(ball, (Math.random() - 0.5) * 0.2);


        gameMessageDisplay.textContent = "تیرک!"; // "Post!"
        gameMessageDisplay.classList.add('has-text');

        // Clear "Post!" message after a short delay, but don't reset positions
        setTimeout(() => {
            if (gameMessageDisplay.textContent === "تیرک!") { // Only clear if it's still the post message
                gameMessageDisplay.textContent = "";
                gameMessageDisplay.classList.remove('has-text');
            }
        }, 1000); // Keep post message for 1 second

        // Reset goalScoredThisTick after a very short delay to allow ball to clear sensor
        setTimeout(() => {
            goalScoredThisTick = false;
        }, 50);
        // Note: The original goalScoredThisTick reset (for actual goals) is now part of the 'else' block.
        return; // Do not proceed to score the goal
    }

    // Normal Goal Scoring (80% chance)
    if (scoringTeam === 1) {
        team1Score++;
        team1ScoreDisplay.textContent = `Team 1: ${team1Score}`;
    } else {
        team2Score++;
        team2ScoreDisplay.textContent = `Team 2: ${team2Score}`;
    }
    gameMessageDisplay.textContent = "گل!"; // "Goal!"
    gameMessageDisplay.classList.add('has-text');
    
    // Standard reset after a goal
    setTimeout(() => {
        resetPositions();
        if (gameMessageDisplay.textContent === "گل!") { // Only clear if it's still the goal message
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
