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

// ===================================================================================
// Global Variables
// ===================================================================================
let mainCanvas, lowResCanvas, lowResCtx;
let engine, world, runner;
let players = [];
let ball;
let goals = { team1: [], team2: [] };
let particles = [];
let screenShake = { magnitude: 0, duration: 0, startTime: 0 };
let gameTimeRemaining = 120;
let roundTimerId;
let isGameOver = false;
let team1Score = 0;
let team2Score = 0;
let kickCooldown = 0;
let isKicking = false;
let aiKicking = false;
let kickAnimState = [0, 0]; // 0: idle, 1: animating forward, 2: animating back
let kickAnimStart = [0, 0]; // timestamp (ms) when animation started for each player
const KICK_ANIM_DURATION = 120; // ms for forward or back
// Change KICK_MAX_ANGLE sign for reverse rotation
const KICK_MAX_ANGLE = -18 * Math.PI / 180;

// Three.js variables
let scene, camera, renderer;
let field, player1Mesh, player2Mesh, ballMesh;
let directionalLight, ambientLight;

// ===================================================================================
// Constants
// ===================================================================================
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PIXELATION_SCALE_FACTOR = 4; // Global pixelation factor
const ROUND_DURATION_SECONDS = 120;

// Physics constants
const GROUND_Y = 580;
const GROUND_THICKNESS = 40;
const WALL_THICKNESS = 20;
const BALL_RADIUS = 15;

// Player Constants
const PLAYER_FRICTION = 0.8;
const PLAYER_RESTITUTION = 0;
const PLAYER_DENSITY = 0.003;
const PLAYER_SIZE = 40;
const PLAYER_WIDTH = PLAYER_SIZE;
const PLAYER_HEIGHT = PLAYER_SIZE;
const JUMP_FORCE = 0.18;
const MOVE_FORCE = 0.015;
const AIR_MOVE_FORCE_MULTIPLIER = 0.1; // Reduced from 0.3 to 0.1 (10%)

// Goal constants
const GOAL_HEIGHT = 120;
const GOAL_WIDTH = 30; // Original goal area width
const GOAL_POST_WIDTH = 6; // Thinner goal posts (was 10)

// Collision categories
const worldCategory = 0x0001;
const playerCategory = 0x0002;
const ballCategory = 0x0004;
const goalPostCategory = 0x0008;

// AI Player index
const AI_PLAYER_INDEX = 1; // Player 2 is AI

const keysPressed = {};

// ===================================================================================
// Export Constants for AI
// ===================================================================================
window.CANVAS_WIDTH = CANVAS_WIDTH;
window.CANVAS_HEIGHT = CANVAS_HEIGHT;
window.PLAYER_SIZE = PLAYER_SIZE;
window.PLAYER_WIDTH = PLAYER_WIDTH;
window.PLAYER_HEIGHT = PLAYER_HEIGHT;
window.JUMP_FORCE = JUMP_FORCE;
window.MOVE_FORCE = MOVE_FORCE;
window.AIR_MOVE_FORCE_MULTIPLIER = AIR_MOVE_FORCE_MULTIPLIER;
window.BALL_RADIUS = BALL_RADIUS;
window.GROUND_Y = GROUND_Y;
window.GOAL_HEIGHT = GOAL_HEIGHT;
window.GOAL_WIDTH = GOAL_WIDTH;
window.aiKicking = aiKicking;

// ===================================================================================
// Setup Function
// ===================================================================================
function setup() {
    console.log("Starting game setup...");
    
    // Initialize Three.js
    initThreeJS();
    
    // Initialize UI elements
    initUI();
    
    // Initialize audio
    initializeAudio();
    
    // Start game loop
    startGame();
    console.log("Game setup completed!");
}

function initThreeJS() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    
    // Create camera with better isometric view
    camera = new THREE.PerspectiveCamera(60, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 2000);
    camera.position.set(400, 500, 800); // Better isometric position
    camera.lookAt(400, 0, 300); // Look at center of field
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
    renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Create lights
    ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(200, 400, 200);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 1000;
    directionalLight.shadow.camera.left = -400;
    directionalLight.shadow.camera.right = 400;
    directionalLight.shadow.camera.top = 400;
    directionalLight.shadow.camera.bottom = -400;
    scene.add(directionalLight);
    
    // Create field
    createField3D();
    
    // Create players
    createPlayers3D();
    
    // Create ball
    createBall3D();
    
    // Setup controls
    setupControls();
    
    // Setup camera controls
    setupCameraControls();
}

function setupCameraControls() {
    let isMouseDown = false;
    let mouseX = 0;
    let mouseY = 0;
    let cameraDistance = 800;
    let cameraAngleX = 45;
    let cameraAngleY = 45;
    
    const canvas = document.getElementById('gameCanvas');
    
    canvas.addEventListener('mousedown', (event) => {
        isMouseDown = true;
        mouseX = event.clientX;
        mouseY = event.clientY;
    });
    
    canvas.addEventListener('mouseup', () => {
        isMouseDown = false;
    });
    
    canvas.addEventListener('mousemove', (event) => {
        if (isMouseDown) {
            const deltaX = event.clientX - mouseX;
            const deltaY = event.clientY - mouseY;
            
            cameraAngleY += deltaX * 0.5;
            cameraAngleX += deltaY * 0.5;
            
            // Clamp camera angles
            cameraAngleX = Math.max(10, Math.min(80, cameraAngleX));
            
            updateCameraPosition();
            
            mouseX = event.clientX;
            mouseY = event.clientY;
        }
    });
    
    canvas.addEventListener('wheel', (event) => {
        cameraDistance += event.deltaY * 0.5;
        cameraDistance = Math.max(400, Math.min(1200, cameraDistance));
        updateCameraPosition();
    });
    
    function updateCameraPosition() {
        const radiansX = cameraAngleX * Math.PI / 180;
        const radiansY = cameraAngleY * Math.PI / 180;
        
        camera.position.x = 400 + cameraDistance * Math.sin(radiansY) * Math.cos(radiansX);
        camera.position.y = cameraDistance * Math.sin(radiansX);
        camera.position.z = 300 + cameraDistance * Math.cos(radiansY) * Math.cos(radiansX);
        
        camera.lookAt(400, 0, 300);
    }
}

function initUI() {
    // Update UI element references
    team1ScoreDisplay = document.getElementById('team1Score');
    team2ScoreDisplay = document.getElementById('team2Score');
    timerDisplay = document.getElementById('timer');
    gameMessageDisplay = document.getElementById('gameMessage');
    
    // Initialize scores
    team1ScoreDisplay.textContent = `Team 1: ${team1Score}`;
    team2ScoreDisplay.textContent = `Team 2: ${team2Score}`;
    timerDisplay.textContent = `Time: ${gameTimeRemaining}`;
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
            const idx = (body.label === 'player1') ? 0 : 1;
            // --- Time-based smooth kick animation for both players ---
            let angle = 0;
            if (kickAnimState[idx] !== 0) {
                const now = performance.now();
                let t = (now - kickAnimStart[idx]) / KICK_ANIM_DURATION;
                const sign = (body.position.x < ball.position.x) ? 1 : -1;
                if (kickAnimState[idx] === 1) { // animating forward
                    if (t >= 1) {
                        t = 1;
                        kickAnimState[idx] = 2;
                        kickAnimStart[idx] = now;
                    }
                    angle = sign * KICK_MAX_ANGLE * Math.sin(t * Math.PI/2);
                } else if (kickAnimState[idx] === 2) { // animating back
                    if (t >= 1) {
                        t = 1;
                        kickAnimState[idx] = 3; // Start smooth return
                        kickAnimStart[idx] = now;
                    }
                    angle = sign * KICK_MAX_ANGLE * Math.sin((1-t) * Math.PI/2);
                } else if (kickAnimState[idx] === 3) { // smooth return to zero
                    let t2 = (now - kickAnimStart[idx]) / (KICK_ANIM_DURATION * 1.2); // slower return
                    if (t2 >= 1) {
                        t2 = 1;
                        kickAnimState[idx] = 0;
                    }
                    // Ease out
                    angle = sign * KICK_MAX_ANGLE * (1-t2) * 0.2; // small overshoot
                }
            }
            if (angle !== 0) {
                lowResCtx.save();
                const px = body.position.x * PIXELATION_SCALE_FACTOR;
                const py = body.position.y * PIXELATION_SCALE_FACTOR;
                lowResCtx.translate(px, py);
                lowResCtx.rotate(angle);
                lowResCtx.fillStyle = player.color;
                lowResCtx.beginPath();
                lowResCtx.rect(-PLAYER_WIDTH/2 * PIXELATION_SCALE_FACTOR, -PLAYER_HEIGHT/2 * PIXELATION_SCALE_FACTOR, PLAYER_WIDTH * PIXELATION_SCALE_FACTOR, PLAYER_HEIGHT * PIXELATION_SCALE_FACTOR);
                lowResCtx.fill();
                lowResCtx.restore();
            } else {
                lowResCtx.fillStyle = player.color;
                lowResCtx.beginPath();
                lowResCtx.rect(
                    (body.position.x - PLAYER_WIDTH/2) * PIXELATION_SCALE_FACTOR,
                    (body.position.y - PLAYER_HEIGHT/2) * PIXELATION_SCALE_FACTOR,
                    PLAYER_WIDTH * PIXELATION_SCALE_FACTOR,
                    PLAYER_HEIGHT * PIXELATION_SCALE_FACTOR
                );
                lowResCtx.fill();
            }
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
    // Animate player2 kick (AI)
    if (typeof window.aiKicking !== 'undefined' && window.aiKicking) {
        if (kickAnimState[1] === 0) {
            kickAnimState[1] = 1;
            kickAnimStart[1] = performance.now();
        }
    }

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
    aiKicking = false;
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
    }

    // --- S key: Kick logic ---
    if (isKicking && kickCooldown <= 0 && p1.isGrounded) {
        // Check if ball is close enough to player1's foot
        const footX = p1.body.position.x + (p1.body.position.x < ball.position.x ? PLAYER_WIDTH/2 : -PLAYER_WIDTH/2);
        const footY = p1.body.position.y + PLAYER_HEIGHT/2;
        const dx = ball.position.x - footX;
        const dy = ball.position.y - footY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < PLAYER_WIDTH * 0.8) {
            // Apply a strong forward and much stronger upward force to the ball (chip)
            const kickDir = p1.body.position.x < ball.position.x ? 1 : -1;
            Body.applyForce(ball, ball.position, { x: 0.04 * kickDir, y: -0.045 });
            audioManager.playSound('kick');
            kickCooldown = 20; // ~0.33s at 60fps
            kickAnimState[0] = 1; // Start animating forward for player1
            kickAnimStart[0] = performance.now();
        }
    }
    if (kickCooldown > 0) kickCooldown--;
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

// ===================================================================================
// 3D Creation Functions
// ===================================================================================
function createField3D() {
    // Create field ground
    const fieldGeometry = new THREE.PlaneGeometry(800, 600);
    const fieldMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 }); // Green
    field = new THREE.Mesh(fieldGeometry, fieldMaterial);
    field.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    field.receiveShadow = true;
    scene.add(field);
    
    // Create field lines
    createFieldLines();
    
    // Create goal posts
    createGoalPosts();
    
    // Create corner flags
    createCornerFlags();
}

function createFieldLines() {
    const lineMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    
    // Center line
    const centerLineGeometry = new THREE.BoxGeometry(2, 600, 2);
    const centerLine = new THREE.Mesh(centerLineGeometry, lineMaterial);
    centerLine.position.set(400, 1, 300);
    scene.add(centerLine);
    
    // Center circle
    const centerCircleGeometry = new THREE.RingGeometry(50, 52, 32);
    const centerCircle = new THREE.Mesh(centerCircleGeometry, lineMaterial);
    centerCircle.rotation.x = -Math.PI / 2;
    centerCircle.position.set(400, 1, 300);
    scene.add(centerCircle);
    
    // Penalty areas
    const penaltyAreaGeometry = new THREE.BoxGeometry(200, 2, 2);
    
    // Left penalty area (top)
    const leftPenaltyTop = new THREE.Mesh(penaltyAreaGeometry, lineMaterial);
    leftPenaltyTop.position.set(300, 1, 200);
    scene.add(leftPenaltyTop);
    
    // Left penalty area (bottom)
    const leftPenaltyBottom = new THREE.Mesh(penaltyAreaGeometry, lineMaterial);
    leftPenaltyBottom.position.set(300, 1, 400);
    scene.add(leftPenaltyBottom);
    
    // Right penalty area (top)
    const rightPenaltyTop = new THREE.Mesh(penaltyAreaGeometry, lineMaterial);
    rightPenaltyTop.position.set(500, 1, 200);
    scene.add(rightPenaltyTop);
    
    // Right penalty area (bottom)
    const rightPenaltyBottom = new THREE.Mesh(penaltyAreaGeometry, lineMaterial);
    rightPenaltyBottom.position.set(500, 1, 400);
    scene.add(rightPenaltyBottom);
    
    // Penalty area vertical lines
    const penaltyVerticalGeometry = new THREE.BoxGeometry(2, 2, 200);
    
    // Left penalty area vertical lines
    const leftPenaltyLeft = new THREE.Mesh(penaltyVerticalGeometry, lineMaterial);
    leftPenaltyLeft.position.set(200, 1, 300);
    scene.add(leftPenaltyLeft);
    
    const leftPenaltyRight = new THREE.Mesh(penaltyVerticalGeometry, lineMaterial);
    leftPenaltyRight.position.set(400, 1, 300);
    scene.add(leftPenaltyRight);
    
    // Right penalty area vertical lines
    const rightPenaltyLeft = new THREE.Mesh(penaltyVerticalGeometry, lineMaterial);
    rightPenaltyLeft.position.set(400, 1, 300);
    scene.add(rightPenaltyLeft);
    
    const rightPenaltyRight = new THREE.Mesh(penaltyVerticalGeometry, lineMaterial);
    rightPenaltyRight.position.set(600, 1, 300);
    scene.add(rightPenaltyRight);
}

function createGoalPosts() {
    const goalPostGeometry = new THREE.BoxGeometry(GOAL_POST_WIDTH, GOAL_HEIGHT, GOAL_POST_WIDTH);
    const goalPostMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    
    // Left goal posts
    const leftGoalLeft = new THREE.Mesh(goalPostGeometry, goalPostMaterial);
    leftGoalLeft.position.set(GOAL_POST_WIDTH/2, GOAL_HEIGHT/2, 300 - GOAL_WIDTH/2);
    leftGoalLeft.castShadow = true;
    scene.add(leftGoalLeft);
    
    const leftGoalRight = new THREE.Mesh(goalPostGeometry, goalPostMaterial);
    leftGoalRight.position.set(GOAL_POST_WIDTH/2, GOAL_HEIGHT/2, 300 + GOAL_WIDTH/2);
    leftGoalRight.castShadow = true;
    scene.add(leftGoalRight);
    
    // Left goal crossbar
    const leftCrossbarGeometry = new THREE.BoxGeometry(GOAL_WIDTH + GOAL_POST_WIDTH, GOAL_POST_WIDTH, GOAL_POST_WIDTH);
    const leftCrossbar = new THREE.Mesh(leftCrossbarGeometry, goalPostMaterial);
    leftCrossbar.position.set(GOAL_POST_WIDTH/2, GOAL_HEIGHT, 300);
    leftCrossbar.castShadow = true;
    scene.add(leftCrossbar);
    
    // Right goal posts
    const rightGoalLeft = new THREE.Mesh(goalPostGeometry, goalPostMaterial);
    rightGoalLeft.position.set(CANVAS_WIDTH - GOAL_POST_WIDTH/2, GOAL_HEIGHT/2, 300 - GOAL_WIDTH/2);
    rightGoalLeft.castShadow = true;
    scene.add(rightGoalLeft);
    
    const rightGoalRight = new THREE.Mesh(goalPostGeometry, goalPostMaterial);
    rightGoalRight.position.set(CANVAS_WIDTH - GOAL_POST_WIDTH/2, GOAL_HEIGHT/2, 300 + GOAL_WIDTH/2);
    rightGoalRight.castShadow = true;
    scene.add(rightGoalRight);
    
    // Right goal crossbar
    const rightCrossbarGeometry = new THREE.BoxGeometry(GOAL_WIDTH + GOAL_POST_WIDTH, GOAL_POST_WIDTH, GOAL_POST_WIDTH);
    const rightCrossbar = new THREE.Mesh(rightCrossbarGeometry, goalPostMaterial);
    rightCrossbar.position.set(CANVAS_WIDTH - GOAL_POST_WIDTH/2, GOAL_HEIGHT, 300);
    rightCrossbar.castShadow = true;
    scene.add(rightCrossbar);
}

function createCornerFlags() {
    const flagPoleGeometry = new THREE.CylinderGeometry(1, 1, 60, 8);
    const flagPoleMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown
    
    const flagGeometry = new THREE.PlaneGeometry(20, 15);
    const flagMaterial = new THREE.MeshLambertMaterial({ color: 0xFF0000 }); // Red
    
    // Corner flag positions
    const cornerPositions = [
        { x: 0, z: 0 },      // Top-left
        { x: CANVAS_WIDTH, z: 0 }, // Top-right
        { x: 0, z: CANVAS_HEIGHT }, // Bottom-left
        { x: CANVAS_WIDTH, z: CANVAS_HEIGHT } // Bottom-right
    ];
    
    cornerPositions.forEach((pos, index) => {
        // Create flag pole
        const flagPole = new THREE.Mesh(flagPoleGeometry, flagPoleMaterial);
        flagPole.position.set(pos.x, 30, pos.z);
        flagPole.castShadow = true;
        scene.add(flagPole);
        
        // Create flag
        const flag = new THREE.Mesh(flagGeometry, flagMaterial);
        flag.position.set(pos.x + (pos.x === 0 ? 10 : -10), 45, pos.z);
        flag.castShadow = true;
        scene.add(flag);
    });
}

function createPlayers3D() {
    // Player 1 (Red)
    const playerGeometry = new THREE.BoxGeometry(PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_WIDTH);
    const player1Material = new THREE.MeshLambertMaterial({ color: 0xD9534F });
    player1Mesh = new THREE.Mesh(playerGeometry, player1Material);
    player1Mesh.position.set(200, PLAYER_HEIGHT/2, 450);
    player1Mesh.castShadow = true;
    scene.add(player1Mesh);
    
    // Player 2 (Blue) - AI
    const player2Material = new THREE.MeshLambertMaterial({ color: 0x428BCA });
    player2Mesh = new THREE.Mesh(playerGeometry, player2Material);
    player2Mesh.position.set(600, PLAYER_HEIGHT/2, 450);
    player2Mesh.castShadow = true;
    scene.add(player2Mesh);
    
    // Store player data
    players = [
        { mesh: player1Mesh, team: 1, isGrounded: false, color: '#D9534F' },
        { mesh: player2Mesh, team: 2, isGrounded: false, color: '#428BCA' }
    ];
}

function createBall3D() {
    const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
    const ballMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
    ballMesh.position.set(CANVAS_WIDTH / 2, BALL_RADIUS, 100);
    ballMesh.castShadow = true;
    scene.add(ballMesh);
    
    // Store ball data
    ball = { 
        mesh: ballMesh, 
        position: ballMesh.position,
        velocity: { x: 0, y: 0, z: 0 }
    };
}

// ===================================================================================
// Collision Detection & Game Logic
// ===================================================================================
function checkCollisions() {
    if (!ball || !players) return;
    
    // Check ball-player collisions
    players.forEach((player, index) => {
        const distance = Math.sqrt(
            Math.pow(ball.mesh.position.x - player.mesh.position.x, 2) +
            Math.pow(ball.mesh.position.z - player.mesh.position.z, 2) +
            Math.pow(ball.mesh.position.y - player.mesh.position.y, 2)
        );
        
        if (distance < BALL_RADIUS + PLAYER_SIZE / 2) {
            handleBallPlayerCollision(player, index);
        }
    });
    
    // Check goal scoring
    checkGoalScoring();
    
    // Check wall collisions
    checkWallCollisions();
}

function handleBallPlayerCollision(player, playerIndex) {
    // Calculate collision response
    const dx = ball.mesh.position.x - player.mesh.position.x;
    const dz = ball.mesh.position.z - player.mesh.position.z;
    const dy = ball.mesh.position.y - player.mesh.position.y;
    
    const distance = Math.sqrt(dx * dx + dz * dz + dy * dy);
    
    if (distance > 0) {
        // Normalize direction
        const nx = dx / distance;
        const nz = dz / distance;
        const ny = dy / distance;
        
        // Push ball away from player
        const pushDistance = BALL_RADIUS + PLAYER_SIZE / 2 - distance;
        ball.mesh.position.x += nx * pushDistance;
        ball.mesh.position.z += nz * pushDistance;
        ball.mesh.position.y += ny * pushDistance;
        
        // Apply kick force if player is kicking
        if ((playerIndex === 0 && isKicking) || (playerIndex === 1 && window.aiKicking)) {
            applyKickForce(player, nx, nz, ny);
            if (typeof window.playKickSound === 'function') {
                window.playKickSound();
            }
        }
    }
}

function applyKickForce(player, nx, nz, ny) {
    const kickForce = 20;
    const kickDirectionX = nx * kickForce;
    const kickDirectionZ = nz * kickForce;
    const kickDirectionY = Math.abs(ny) * kickForce * 0.5; // Reduced upward force
    
    ball.velocity.x = kickDirectionX;
    ball.velocity.z = kickDirectionZ;
    ball.velocity.y = kickDirectionY;
    
    // Add some randomness
    ball.velocity.x += (Math.random() - 0.5) * 5;
    ball.velocity.z += (Math.random() - 0.5) * 5;
}

function checkGoalScoring() {
    const ballX = ball.mesh.position.x;
    const ballY = ball.mesh.position.y;
    const ballZ = ball.mesh.position.z;
    
    // Left goal (Team 1 scores)
    if (ballX < GOAL_POST_WIDTH && ballY < GOAL_HEIGHT && 
        ballZ > 300 - GOAL_WIDTH/2 && ballZ < 300 + GOAL_WIDTH/2) {
        scoreGoal(1);
    }
    
    // Right goal (Team 2 scores)
    if (ballX > CANVAS_WIDTH - GOAL_POST_WIDTH && ballY < GOAL_HEIGHT && 
        ballZ > 300 - GOAL_WIDTH/2 && ballZ < 300 + GOAL_WIDTH/2) {
        scoreGoal(2);
    }
}

function scoreGoal(team) {
    if (team === 1) {
        team1Score++;
        team1ScoreDisplay.textContent = `Team 1: ${team1Score}`;
    } else {
        team2Score++;
        team2ScoreDisplay.textContent = `Team 2: ${team2Score}`;
    }
    
    // Play goal sound
    if (typeof window.playGoalSound === 'function') {
        window.playGoalSound();
    }
    
    // Show goal message
    const teamName = team === 1 ? "قرمز" : "آبی";
    gameMessageDisplay.textContent = `گل! تیم ${teamName}`;
    gameMessageDisplay.classList.add('has-text');
    
    // Reset ball position
    resetBall();
    
    // Clear message after 2 seconds
    setTimeout(() => {
        gameMessageDisplay.textContent = '';
        gameMessageDisplay.classList.remove('has-text');
    }, 2000);
}

function resetBall() {
    ball.mesh.position.set(CANVAS_WIDTH / 2, BALL_RADIUS, 100);
    ball.velocity.x = 0;
    ball.velocity.y = 0;
    ball.velocity.z = 0;
}

function checkWallCollisions() {
    const ballX = ball.mesh.position.x;
    const ballZ = ball.mesh.position.z;
    
    // Left wall
    if (ballX < BALL_RADIUS) {
        ball.mesh.position.x = BALL_RADIUS;
        ball.velocity.x = Math.abs(ball.velocity.x) * 0.8; // Bounce with friction
    }
    
    // Right wall
    if (ballX > CANVAS_WIDTH - BALL_RADIUS) {
        ball.mesh.position.x = CANVAS_WIDTH - BALL_RADIUS;
        ball.velocity.x = -Math.abs(ball.velocity.x) * 0.8; // Bounce with friction
    }
    
    // Top wall (z-axis)
    if (ballZ < BALL_RADIUS) {
        ball.mesh.position.z = BALL_RADIUS;
        ball.velocity.z = Math.abs(ball.velocity.z) * 0.8; // Bounce with friction
    }
    
    // Bottom wall (z-axis)
    if (ballZ > CANVAS_HEIGHT - BALL_RADIUS) {
        ball.mesh.position.z = CANVAS_HEIGHT - BALL_RADIUS;
        ball.velocity.z = -Math.abs(ball.velocity.z) * 0.8; // Bounce with friction
    }
}

// ===================================================================================
// Updated Drawing Functions
// ===================================================================================
function draw3D() {
    // Update player positions based on physics (simplified for now)
    updatePlayerPositions();
    
    // Update ball position
    updateBallPosition();
    
    // Check collisions
    checkCollisions();
    
    // Render the scene
    renderer.render(scene, camera);
}

function updatePlayerPositions() {
    // Player 1 movement
    if (keysPressed['a']) {
        player1Mesh.position.x -= 5;
    }
    if (keysPressed['d']) {
        player1Mesh.position.x += 5;
    }
    if (keysPressed['q']) {
        player1Mesh.position.z -= 5;
    }
    if (keysPressed['e']) {
        player1Mesh.position.z += 5;
    }
    if (keysPressed['w'] && players[0].isGrounded) {
        player1Mesh.position.y += 10;
        players[0].isGrounded = false;
        if (typeof window.playJumpSound === 'function') {
            window.playJumpSound();
        }
        setTimeout(() => {
            player1Mesh.position.y = PLAYER_HEIGHT/2;
            players[0].isGrounded = true;
        }, 500);
    }
    
    // AI movement (simplified)
    if (typeof window.updateAI === "function") {
        window.updateAI();
    }
    
    // Keep players within bounds
    players.forEach(player => {
        player.mesh.position.x = Math.max(PLAYER_SIZE/2, Math.min(CANVAS_WIDTH - PLAYER_SIZE/2, player.mesh.position.x));
        player.mesh.position.z = Math.max(PLAYER_SIZE/2, Math.min(CANVAS_HEIGHT - PLAYER_SIZE/2, player.mesh.position.z));
    });
}

function updateBallPosition() {
    // Apply velocity
    ball.mesh.position.x += ball.velocity.x;
    ball.mesh.position.y += ball.velocity.y;
    ball.mesh.position.z += ball.velocity.z;
    
    // Apply gravity
    ball.velocity.y -= 0.8;
    
    // Ground collision
    if (ball.mesh.position.y < BALL_RADIUS) {
        ball.mesh.position.y = BALL_RADIUS;
        ball.velocity.y = 0;
        
        // Apply friction to horizontal movement
        ball.velocity.x *= 0.95;
        ball.velocity.z *= 0.95;
    }
    
    // Update ball data
    ball.position = ball.mesh.position;
}

// ===================================================================================
// Game Loop
// ===================================================================================
function startGame() {
    // Initialize AI
    if (typeof window.initializeAI === "function") {
        window.initializeAI(players[AI_PLAYER_INDEX], ball, null);
    }
    
    // Start game timer
    roundTimerId = setInterval(() => {
        gameTimeRemaining--;
        timerDisplay.textContent = `Time: ${gameTimeRemaining}`;
        if (gameTimeRemaining <= 0) {
            endGame();
        }
    }, 1000);
    
    // Start render loop
    animate();
}

function animate() {
    if (!isGameOver) {
        requestAnimationFrame(animate);
        draw3D();
    }
}

// ===================================================================================
// Control Functions
// ===================================================================================
function setupControls() {
    document.addEventListener('keydown', (event) => {
        keysPressed[event.key.toLowerCase()] = true;
        if (event.key.toLowerCase() === 's') {
            isKicking = true;
        }
    });
    
    document.addEventListener('keyup', (event) => {
        keysPressed[event.key.toLowerCase()] = false;
        if (event.key.toLowerCase() === 's') {
            isKicking = false;
        }
    });
    
    // Prevent default behavior for game keys
    document.addEventListener('keydown', (event) => {
        if (['w', 'a', 's', 'd', 'q', 'e'].includes(event.key.toLowerCase())) {
            event.preventDefault();
        }
    });
}

// ===================================================================================
// Utility Functions
// ===================================================================================
function initializeAudio() {
    // Audio initialization will be handled by audioManager.js
}

function endGame() {
    clearInterval(roundTimerId);
    isGameOver = true;
    let winnerMessage = "مساوی!";
    if (team1Score > team2Score) winnerMessage = "تیم قرمز برنده شد!";
    if (team2Score > team1Score) winnerMessage = "تیم آبی برنده شد!";
    gameMessageDisplay.textContent = `پایان بازی! ${winnerMessage}`;
    gameMessageDisplay.classList.add('has-text');
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', setup);