// --- Matter.js Aliases ---
const Engine = Matter.Engine;
const Render = Matter.Render;
const Runner = Matter.Runner;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Events = Matter.Events;
const Composite = Matter.Composite;
// Constraint removed as it's not used for simple square players initially

// --- DOM Element References ---
const canvas = document.getElementById('gameCanvas');
const team1ScoreDisplay = document.getElementById('team1ScoreDisplay');
const team2ScoreDisplay = document.getElementById('team2ScoreDisplay');
const timerDisplay = document.getElementById('timerDisplay');
const gameMessageDisplay = document.getElementById('gameMessage');

// --- Game Constants ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const ROUND_DURATION_SECONDS = 90;
const BALL_RADIUS = 15;

const PIXEL_SCALE = 6; // More pixelated
const PIXEL_CANVAS_WIDTH = CANVAS_WIDTH / PIXEL_SCALE;
const PIXEL_CANVAS_HEIGHT = CANVAS_HEIGHT / PIXEL_SCALE;

// --- Game Variables ---
let pixelCanvas;
let pixelCtx;

let engine;
let world;
// let runner;
let render; // Added for Render.create
let isGameOver = false;
let isGameStarted = false;
let restartDebounce = false;

let team1Score = 0;
let team2Score = 0;
let ball;
let players = [];

let gameTimeRemaining = ROUND_DURATION_SECONDS;
let roundTimerId = null;
let gameRenderLoopId;
let particles = [];

// --- Field Constants ---
const GROUND_THICKNESS = 40;
const WALL_THICKNESS = 20;
const GOAL_HEIGHT = 120;
const GOAL_SENSOR_DEPTH = 30;
const GOAL_MOUTH_VISUAL_WIDTH = 60;
const CROSSBAR_THICKNESS = 10;
let actualGoalOpeningHeight = GOAL_HEIGHT - CROSSBAR_THICKNESS;

// --- Color Palettes ---
const colorPalettes = [
    { name: "Classic", team1: '#D9534F', team2: '#428BCA' },
    { name: "Nature", team1: '#5CB85C', team2: '#F0AD4E' },
    { name: "Royal", team1: '#6A0DAD', team2: '#FFA500' },
    { name: "Mono", team1: '#666666', team2: '#CCCCCC' }
];
let currentColorPaletteIndex = -1;

// --- Themes ---
const themes = [
    { 
        name: "Grass Day", 
        background: '#87CEEB', // Sky blue
        ground: '#228B22', // Forest green grass
        groundSecondary: '#32CD32', // Lime green for grass stripes
        walls: '#8B4513', // Brown wooden walls
        ballThemeColor: '#FFFFFF', 
        net: 'rgba(220, 220, 220, 0.8)',
        skyColor: '#87CEEB',
        cloudColor: '#FFFFFF',
        sunColor: '#FFD700'
    },
    { 
        name: "Night Sky", 
        background: '#191970', // Midnight blue
        ground: '#006400', // Dark green
        groundSecondary: '#228B22',
        walls: '#2F4F4F', // Dark slate gray
        ballThemeColor: '#E0E0E0', 
        net: 'rgba(180, 180, 200, 0.5)',
        skyColor: '#191970',
        cloudColor: '#696969',
        sunColor: '#F0F8FF' // Moon color
    },
    { 
        name: "Desert", 
        background: '#F4A460', // Sandy brown
        ground: '#DEB887', // Burlywood
        groundSecondary: '#D2B48C',
        walls: '#A0522D', 
        ballThemeColor: '#FAFAFA', 
        net: 'rgba(100, 100, 100, 0.5)',
        skyColor: '#F4A460',
        cloudColor: '#F5DEB3',
        sunColor: '#FF4500'
    }
];
let currentThemeIndex = -1;
let activeTheme = themes[0];

// --- Animated Elements ---
let clouds = [];
let sunPosition = { x: 0, y: 0 };
let gameTime = 0;
let gameStartTime = 0;
let spectators = [];
let stadiumLights = [];

// --- Game States ---
let gameState = 'playing'; // 'playing', 'gameOver'
// Menu buttons removed

// --- Dynamic Sun System ---
const SUN_COLORS = {
    dawn: '#FF6B6B',     // Red sunrise
    morning: '#FFD93D',  // Yellow morning
    noon: '#FFD700',     // Golden noon
    afternoon: '#FFA500', // Orange afternoon
    evening: '#FF4500',  // Red evening
    night: '#F0F8FF'     // Moon white
};
const BALL_PANEL_COLOR_PRIMARY = '#FFFFFF';
const BALL_PANEL_COLOR_SECONDARY = '#333333';


// --- Player Constants ---
const PLAYER_FRICTION = 0.7;
const PLAYER_RESTITUTION = 0.1;
const PLAYER_DENSITY = 0.0035;
const PLAYER_RECT_SIZE = 50;

// --- Control Constants ---
const PLAYER_JUMP_COOLDOWN_FRAMES = 35;
const PLAYER_MOVE_FORCE = 0.008; // Will be adapted for square's rolling motion (torque)
const PLAYER_ROLL_ANGULAR_VELOCITY_TARGET = 0.20;
const PLAYER_ROLL_TRANSLATE_SPEED = 1.0;

const PLAYER_VARIABLE_JUMP_INITIAL_FORCE = 0.06;
const PLAYER_VARIABLE_JUMP_SUSTAINED_FORCE = 0.007;
const PLAYER_VARIABLE_JUMP_MAX_HOLD_FRAMES = 10;
const PLAYER_MAX_JUMP_IMPULSE = 0.135;
const COYOTE_TIME_FRAMES = 7;

const KICK_RANGE = PLAYER_RECT_SIZE / 2 + BALL_RADIUS + 10;
const KICK_FORCE_MAGNITUDE = 0.065;
const TIMED_JUMP_SHOT_BONUS_FACTOR = 1.6;
const JUMP_SHOT_LOFT_FACTOR = 1.6;
const PLAYER_AIR_CONTROL_FACTOR = 0.35;

const AI_ACTION_RANGE = PLAYER_RECT_SIZE * 2.5;
const AI_MOVE_FORCE = 0.0035;
const AI_KICK_ATTEMPT_STRENGTH = 0.075;
const AI_KICK_BALL_RANGE = KICK_RANGE + 5;
const AI_TIMED_JUMP_ANTICIPATION_FRAMES = 10;
const PLAYER_ACTION_COOLDOWN_FRAMES = 20;


const LANDING_DAMPING_FACTOR = 0.9;

const keysPressed = {};

// --- Sound Functions ---
const soundEnabled = true;
let audioContext;

// Initialize Web Audio API
function initAudioContext() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.warn('Web Audio API not supported:', e);
    }
}

// Create simple tones for sound effects
function createTone(frequency, duration, type = 'sine', volume = 0.1) {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// Sound effects
function playSound(soundFileName) {
    if (!soundEnabled || !audioContext) return;
    
    try {
        switch(soundFileName) {
            case 'jump.wav':
                createTone(440, 0.15, 'square', 0.08); // Jump sound
                setTimeout(() => createTone(660, 0.1, 'sine', 0.06), 50);
                break;
            case 'kick.wav':
                createTone(200, 0.1, 'square', 0.12); // Kick sound
                setTimeout(() => createTone(150, 0.05, 'triangle', 0.08), 30);
                break;
            case 'goal.wav':
                // Goal celebration sound
                createTone(523, 0.2, 'sine', 0.1); // C
                setTimeout(() => createTone(659, 0.2, 'sine', 0.1), 100); // E
                setTimeout(() => createTone(784, 0.3, 'sine', 0.12), 200); // G
                break;
            case 'ball_hit_wall.wav':
                createTone(300, 0.08, 'square', 0.06); // Wall hit
                break;
            default:
                console.warn(`Unknown sound: ${soundFileName}`);
        }
    } catch (e) {
        console.warn(`Sound generation failed for ${soundFileName}:`, e);
    }
}

// Initialize clouds
function initClouds() {
    clouds = [];
    const numClouds = 6; // More clouds
    for (let i = 0; i < numClouds; i++) {
        clouds.push({
            x: Math.random() * (PIXEL_CANVAS_WIDTH + 60) - 30,
            y: Math.random() * (PIXEL_CANVAS_HEIGHT * 0.5) + 5,
            size: Math.random() * 20 + 8,
            speed: Math.random() * 0.4 + 0.05,
            opacity: Math.random() * 0.5 + 0.2,
            type: Math.floor(Math.random() * 3) // Different cloud types
        });
    }
    
    // Initialize sun at dawn position
    sunPosition.x = PIXEL_CANVAS_WIDTH * 0.1; // Start from left (sunrise)
    sunPosition.y = PIXEL_CANVAS_HEIGHT * 0.3;
}

// Initialize spectators
function initSpectators() {
    spectators = [];
    const stadiumSections = [
        // Left stand
        { startX: 2, endX: 25, y: PIXEL_CANVAS_HEIGHT * 0.2, rows: 4 },
        // Right stand  
        { startX: PIXEL_CANVAS_WIDTH - 25, endX: PIXEL_CANVAS_WIDTH - 2, y: PIXEL_CANVAS_HEIGHT * 0.2, rows: 4 },
        // Top stand
        { startX: PIXEL_CANVAS_WIDTH * 0.3, endX: PIXEL_CANVAS_WIDTH * 0.7, y: 5, rows: 3 }
    ];
    
    stadiumSections.forEach(section => {
        for (let row = 0; row < section.rows; row++) {
            for (let x = section.startX; x < section.endX; x += 3) {
                if (Math.random() > 0.3) { // 70% chance of spectator
                    spectators.push({
                        x: x + Math.random() * 2,
                        y: section.y + row * 4,
                        color: `hsl(${Math.random() * 360}, 60%, ${40 + Math.random() * 30}%)`,
                        animation: Math.random() * 100,
                        type: Math.floor(Math.random() * 3)
                    });
                }
            }
        }
    });
}

// Initialize stadium lights
function initStadiumLights() {
    stadiumLights = [
        { x: PIXEL_CANVAS_WIDTH * 0.2, y: PIXEL_CANVAS_HEIGHT * 0.1, intensity: 0.8 },
        { x: PIXEL_CANVAS_WIDTH * 0.5, y: PIXEL_CANVAS_HEIGHT * 0.05, intensity: 1.0 },
        { x: PIXEL_CANVAS_WIDTH * 0.8, y: PIXEL_CANVAS_HEIGHT * 0.1, intensity: 0.8 }
    ];
}

// Menu and help functions removed - game starts directly

// --- Initialization Function ---
function setup() {
    console.log("Simplified SETUP: Initializing basic canvas and render loop...");
    isGameStarted = false;
    isGameOver = false;
    restartDebounce = false;
    team1Score = 0;
    team2Score = 0;
    gameTimeRemaining = ROUND_DURATION_SECONDS;
    actualGoalOpeningHeight = GOAL_HEIGHT - CROSSBAR_THICKNESS;
    particles = [];
    gameTime = 0;
    gameStartTime = Date.now();
    gameState = 'playing';

    // Clear keys
    Object.keys(keysPressed).forEach(key => {
        keysPressed[key] = false;
    });

    // Initialize audio and visual elements
    if (!audioContext) {
        initAudioContext();
    }
    initClouds();
    initStadiumLights();

    if (roundTimerId) {
        clearInterval(roundTimerId);
        roundTimerId = null;
    }

    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    activeTheme = themes[currentThemeIndex];

    currentColorPaletteIndex = (currentColorPaletteIndex + 1) % colorPalettes.length;
    const currentPalette = colorPalettes[currentColorPaletteIndex];
    const activeTeam1Color = currentPalette.team1;
    const activeTeam2Color = currentPalette.team2;

    if (engine) {
        console.log("SETUP: Clearing previous engine and world.");
        World.clear(world, false);
        Engine.clear(engine);
        Events.off(engine);
        if (runner) {
            Runner.stop(runner);
            console.log("SETUP: Stopped previous runner.");
        }
    }

    engine = Engine.create();
    world = engine.world;
    // engine.world.gravity.y = 1.1;

    render = Render.create({
        canvas: canvas,
        engine: engine,
        options: {
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            wireframes: false,
            background: '#0000FF',
            enabled: false
        }
    });

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const mainCtx = canvas.getContext('2d');
    mainCtx.imageSmoothingEnabled = false;

    if (!pixelCanvas) {
        pixelCanvas = document.createElement('canvas');
        pixelCanvas.width = PIXEL_CANVAS_WIDTH;
        pixelCanvas.height = PIXEL_CANVAS_HEIGHT;
        pixelCtx = pixelCanvas.getContext('2d');
    }
    if (pixelCtx) {
        pixelCtx.imageSmoothingEnabled = false;
    } else {
        console.error("Failed to get pixelCtx");
        return;
    }
    
    // createField();
    // createBall();
    // players = [];
    // const playerSpawnY = CANVAS_HEIGHT - GROUND_THICKNESS - PLAYER_RECT_SIZE / 2 - 5;
    // players.push(createPlayer(CANVAS_WIDTH / 4, playerSpawnY, activeTeam1Color, true, false));
    // players.push(createPlayer(CANVAS_WIDTH * 3 / 4, playerSpawnY, activeTeam2Color, false, true));
    // setupInputListeners();
    // runner = Runner.create();
    // Events.on(engine, 'beforeUpdate', updateGame);
    // Events.on(engine, 'collisionStart', handleCollisions);
    // Runner.run(runner, engine);
    // startGameTimer();

    if (typeof gameRenderLoopId !== 'undefined') {
        cancelAnimationFrame(gameRenderLoopId);
    }
    gameRenderLoopId = requestAnimationFrame(gameRenderLoop);
    console.log("Simplified SETUP: Started gameRenderLoop.");

    // updateScoreDisplay();
    // updateTimerDisplay();
    // showGameMessage("Game Started! Controls: A/D Move");
    // createTone(440, 100, 'sine', 0.15);
    // setTimeout(() => createTone(554, 100, 'sine', 0.15), 100);
    // setTimeout(() => createTone(659, 200, 'sine', 0.15), 200);
    // console.log("SETUP: Game started immediately!");
    // console.log("Players:", players.length);
    // console.log("Ball:", ball ? "Created" : "Missing");
    // console.log("Clouds:", clouds ? clouds.length : 0);
}

// --- Timer Functions ---
function startGameTimer() {
    if (roundTimerId) clearInterval(roundTimerId);
    gameTimeRemaining = ROUND_DURATION_SECONDS;
    updateTimerDisplay();
    roundTimerId = setInterval(updateRoundTimer, 1000);
}

function updateRoundTimer() {
    if (!isGameStarted || isGameOver) {
        if (roundTimerId) clearInterval(roundTimerId);
        roundTimerId = null;
        return;
    }
    gameTimeRemaining--;
    updateTimerDisplay();
    if (gameTimeRemaining < 0) {
        gameTimeRemaining = 0;
        updateTimerDisplay();
        if (roundTimerId) clearInterval(roundTimerId);
        roundTimerId = null;
        checkWinCondition();
    }
}

function updateTimerDisplay() {
    timerDisplay.textContent = `Time: ${gameTimeRemaining}`;
}

function getFieldDerivedConstants() {
    return { actualGoalOpeningHeight: GOAL_HEIGHT - CROSSBAR_THICKNESS };
}

function createField() {
    const ground = Bodies.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT - GROUND_THICKNESS / 2, CANVAS_WIDTH, GROUND_THICKNESS, { isStatic: true, label: 'ground', render: { fillStyle: '#228B22' } });
    
    // Create invisible walls for ball physics only
    const leftWall = Bodies.rectangle(-WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, label: 'wall-left', render: { visible: false } });
    const rightWall = Bodies.rectangle(CANVAS_WIDTH + WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, label: 'wall-right', render: { visible: false } });
    const ceiling = Bodies.rectangle(CANVAS_WIDTH / 2, -WALL_THICKNESS / 2, CANVAS_WIDTH, WALL_THICKNESS, { isStatic: true, label: 'ceiling', render: { visible: false } });

    const { actualGoalOpeningHeight: localActualGoalOpeningHeight } = getFieldDerivedConstants();
    const goalSensorY = CANVAS_HEIGHT - GROUND_THICKNESS - localActualGoalOpeningHeight / 2;

    const goalSensorRenderInvisible = { visible: false };
    const leftGoalSensor = Bodies.rectangle(30, goalSensorY, GOAL_SENSOR_DEPTH, localActualGoalOpeningHeight, { isStatic: true, isSensor: true, label: 'goal-left', render: goalSensorRenderInvisible });
    const rightGoalSensor = Bodies.rectangle(CANVAS_WIDTH - 30, goalSensorY, GOAL_SENSOR_DEPTH, localActualGoalOpeningHeight, { isStatic: true, isSensor: true, label: 'goal-right', render: goalSensorRenderInvisible });

    const goalPostRenderStyle = { fillStyle: '#FFFFFF' };
    const crossbarY = CANVAS_HEIGHT - GROUND_THICKNESS - GOAL_HEIGHT + CROSSBAR_THICKNESS / 2;
    const leftCrossbar = Bodies.rectangle(50, crossbarY, GOAL_MOUTH_VISUAL_WIDTH, CROSSBAR_THICKNESS, { isStatic: true, label: 'crossbar-left', render: goalPostRenderStyle });
    const rightCrossbar = Bodies.rectangle(CANVAS_WIDTH - 50, crossbarY, GOAL_MOUTH_VISUAL_WIDTH, CROSSBAR_THICKNESS, { isStatic: true, label: 'crossbar-right', render: goalPostRenderStyle });
    
    World.add(world, [ ground, leftWall, rightWall, ceiling, leftGoalSensor, rightGoalSensor, leftCrossbar, rightCrossbar ]);
}

function createBall() {
    ball = Bodies.circle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3, BALL_RADIUS, {
        label: 'ball',
        density: 0.001, friction: 0.01, frictionAir: 0.008, restitution: 0.7,
        render: { strokeStyle: BALL_PANEL_COLOR_SECONDARY, lineWidth: 1 }
    });
    World.add(world, ball);
}

function createPlayer(x, y, teamColor, isTeam1, isAI) {
    const playerLabelPrefix = isTeam1 ? 'player-t1' : 'player-t2';
    const options = {
        density: PLAYER_DENSITY,
        friction: PLAYER_FRICTION,
        restitution: PLAYER_RESTITUTION,
        render: { fillStyle: teamColor },
        label: `${playerLabelPrefix}-square`,
        chamfer: { radius: 2 },
        inertia: Infinity,
    };

    const playerBody = Bodies.rectangle(x, y, PLAYER_RECT_SIZE, PLAYER_RECT_SIZE, options);
    World.add(world, playerBody);

    return {
        playerBody: playerBody,
        playerTeam: isTeam1 ? 1 : 2,
        color: teamColor,
        actionCooldown: 0,
        jumpCooldown: 0,
        isAI: isAI,
        isGrounded: false,
        lastJumpTime: 0,
        isAttemptingVariableJump: false,
        variableJumpForceAppliedDuration: 0,
        totalJumpImpulseThisJump: 0,
        coyoteTimeFramesRemaining: 0,
        jumpInputBuffered: false,
        wasGrounded: false,
        targetAngle: 0,
        isRotating: false,
        currentFace: 0,
        rollDirection: 0
    };
}

function setupInputListeners() {
    // Remove existing listeners to prevent duplicates
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    
    // Add new listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

function handleKeyDown(event) {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyH', 'Space', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Escape'].includes(event.code)) {
        event.preventDefault();
    }
    keysPressed[event.code] = true;

    const humanPlayer = players.find(p => !p.isAI);
    if (humanPlayer && event.code === 'KeyW' && !humanPlayer.isGrounded && humanPlayer.jumpCooldown === 0) {
        if (humanPlayer.coyoteTimeFramesRemaining <= 0) {
             humanPlayer.jumpInputBuffered = true;
             setTimeout(() => { humanPlayer.jumpInputBuffered = false; }, 200);
        }
    }
}

function handleKeyUp(event) {
    keysPressed[event.code] = false;
    const humanPlayer = players.find(p => !p.isAI);
    if (humanPlayer) {
        if (event.code === 'KeyW') {
            humanPlayer.isAttemptingVariableJump = false;
        }
    }
}

function updatePlayerAnimations() {
    // Visual feedback for square rotation/state can be added here later if needed.
}

function updateGame() {
    // Always update visual elements
    updateClouds();
    updateSun();

    if (gameState === 'gameOver') {
        // Game over state - restart game
        if (keysPressed['KeyW']) {
            console.log("GAME_OVER: Restarting game");
            setup(); // Restart the entire game
            keysPressed['KeyW'] = false;
        }
        return;
    }

    if (!isGameStarted || isGameOver) return;

    gameTime++;
    updatePlayerStates();
    handleHumanPlayerControls();
    updateAIPlayers();
    updatePlayerAnimations();
    updateParticles();
}

// Update cloud positions
function updateClouds() {
    clouds.forEach(cloud => {
        cloud.x += cloud.speed;
        if (cloud.x > PIXEL_CANVAS_WIDTH + 30) {
            cloud.x = -30;
            cloud.y = Math.random() * (PIXEL_CANVAS_HEIGHT * 0.5) + 5;
        }
    });
    
    // Update background clouds animation
    if (window.backgroundClouds) {
        window.backgroundClouds.forEach(cloud => {
            // This is handled in drawBackgroundClouds now for better performance
        });
    }
}

// Update sun position based on game time
function updateSun() {
    const elapsedTime = (Date.now() - gameStartTime) / 1000; // seconds
    const dayDuration = 180; // 3 minutes for full day cycle
    const progress = (elapsedTime % dayDuration) / dayDuration;
    
    // Sun moves in an arc across the sky
    const angle = progress * Math.PI; // 0 to PI (sunrise to sunset)
    sunPosition.x = PIXEL_CANVAS_WIDTH * 0.1 + Math.cos(Math.PI - angle) * PIXEL_CANVAS_WIDTH * 0.8;
    sunPosition.y = PIXEL_CANVAS_HEIGHT * 0.05 + Math.sin(angle) * PIXEL_CANVAS_HEIGHT * 0.3;
}

// Get current sun color based on position
function getCurrentSunColor() {
    const elapsedTime = (Date.now() - gameStartTime) / 1000;
    const dayDuration = 180;
    const progress = (elapsedTime % dayDuration) / dayDuration;
    
    if (progress < 0.15) return SUN_COLORS.dawn;
    if (progress < 0.3) return SUN_COLORS.morning;
    if (progress < 0.5) return SUN_COLORS.noon;
    if (progress < 0.7) return SUN_COLORS.afternoon;
    if (progress < 0.85) return SUN_COLORS.evening;
    return SUN_COLORS.night;
}

// Update spectators animation
function updateSpectators() {
    spectators.forEach(spectator => {
        spectator.animation += 0.1;
        if (Math.random() < 0.001) { // Occasional wave
            spectator.animation = 0;
        }
    });
}

// Menu input function removed - game starts directly

function updatePlayerStates() {
    players.forEach(player => {
        if (!player.isAI) {
            if (player.wasGrounded && !player.isGrounded && !player.isAttemptingVariableJump && player.playerBody.velocity.y > -0.5) {
                player.coyoteTimeFramesRemaining = COYOTE_TIME_FRAMES;
            }

            if (player.coyoteTimeFramesRemaining > 0) {
                player.coyoteTimeFramesRemaining--;
            }
            player.wasGrounded = player.isGrounded;
        }

        if (player.isGrounded && !player.isAttemptingVariableJump) {
            player.totalJumpImpulseThisJump = 0;
        }

        // --- Square Rolling Logic ---
        if (player.isRotating) {
            const currentAngle = player.playerBody.angle;
            const targetAngle = player.targetAngle;
            const angularSpeed = player.rollDirection * PLAYER_ROLL_ANGULAR_VELOCITY_TARGET;

            Body.setAngularVelocity(player.playerBody, angularSpeed);

            if (player.isGrounded) {
                // Movement speed should match rotation speed for natural rolling
                const rollSpeed = Math.abs(angularSpeed) * (PLAYER_RECT_SIZE / 2);
                Body.translate(player.playerBody, { x: player.rollDirection * rollSpeed * 0.6, y: 0 });
            }

            let overShot = false;
            if (player.rollDirection === 1 && currentAngle >= targetAngle - (PLAYER_ROLL_ANGULAR_VELOCITY_TARGET * 0.1)) {
                overShot = true;
            } else if (player.rollDirection === -1 && currentAngle <= targetAngle + (PLAYER_ROLL_ANGULAR_VELOCITY_TARGET * 0.1)) {
                overShot = true;
            }

            if (overShot) {
                Body.setAngle(player.playerBody, targetAngle);
                Body.setAngularVelocity(player.playerBody, 0);
                // Snap position more accurately if needed, e.g. based on number of rolls
                // For now, the continuous translate should be okay.
                player.isRotating = false;
                player.rollDirection = 0;
                player.currentFace = (Math.round(targetAngle / (Math.PI / 2)) % 4 + 4) % 4;
            }
        } else {
            if (player.isGrounded && !keysPressed['KeyA'] && !keysPressed['KeyD']) {
                if (Math.abs(player.playerBody.angularVelocity) > 0.01) {
                    Body.setAngularVelocity(player.playerBody, player.playerBody.angularVelocity * 0.80); // Stronger damping
                } else if (Math.abs(player.playerBody.angularVelocity) > 0) {
                    Body.setAngularVelocity(player.playerBody, 0);
                }
                // Snap to the nearest 90-degree angle if not actively controlled and velocity is low
                if (Math.abs(player.playerBody.angularVelocity) < 0.01) {
                    const currentAngle = player.playerBody.angle;
                    const nearestTargetFace = Math.round(currentAngle / (Math.PI / 2));
                    const nearestTargetAngle = nearestTargetFace * (Math.PI / 2);
                    if(Math.abs(currentAngle - nearestTargetAngle) > 0.001) { // Only snap if not already very close
                        Body.setAngle(player.playerBody, nearestTargetAngle);
                    }
                    player.targetAngle = nearestTargetAngle;
                    player.currentFace = (nearestTargetFace % 4 + 4) % 4;
                }
            }
        }
    });
}


function handleHumanPlayerControls() {
    const player = players[0];
    if (!player || player.isAI) return;

    if (!player.isRotating && player.isGrounded) {
        let roll = 0;
        if (keysPressed['KeyA']) {
            roll = -1;
        } else if (keysPressed['KeyD']) {
            roll = 1;
        }

        if (roll !== 0) {
            player.isRotating = true;
            player.rollDirection = roll;
            // Ensure targetAngle is based on the *current* snapped face to avoid accumulation errors
            const snappedCurrentAngle = Math.round(player.playerBody.angle / (Math.PI / 2)) * (Math.PI / 2);
            player.targetAngle = snappedCurrentAngle + roll * (Math.PI / 2);

            Body.setAngularVelocity(player.playerBody, player.rollDirection * PLAYER_ROLL_ANGULAR_VELOCITY_TARGET);
        }
    }
}


// Advanced AI System
const AI_STATES = {
    DEFENDING: 'defending',
    ATTACKING: 'attacking',
    INTERCEPTING: 'intercepting',
    EMERGENCY_DEFENSE: 'emergency_defense',
    POSITIONING: 'positioning',
    CHALLENGING: 'challenging'
};

const AI_FORMATION = {
    DEFENSIVE: { homeX: 0.8, aggressiveness: 0.3, riskTolerance: 0.2 },
    BALANCED: { homeX: 0.7, aggressiveness: 0.6, riskTolerance: 0.5 },
    ATTACKING: { homeX: 0.6, aggressiveness: 0.8, riskTolerance: 0.7 },
    DESPERATE: { homeX: 0.5, aggressiveness: 1.0, riskTolerance: 0.9 }
};

function updateAIPlayers() {
    players.forEach((player) => {
        if (player.isAI) {
            if (player.actionCooldown > 0) player.actionCooldown--;
            
            // Initialize AI brain if not exists
            if (!player.aiBrain) {
                initializeAIBrain(player);
            }
            
            // Update AI brain and execute advanced logic
            updateAIBrain(player);
            executeAdvancedAILogic(player);
        }
    });
}

function initializeAIBrain(player) {
    player.aiBrain = {
        currentState: AI_STATES.POSITIONING,
        formation: AI_FORMATION.BALANCED,
        lastDecisionTime: 0,
        decisionInterval: 100,
        threatLevel: 0,
        confidence: 0.5,
        lastBallPosition: { x: 0, y: 0 },
        predictedBallPosition: { x: 0, y: 0 },
        riskAssessment: 0.5,
        strategicTarget: null,
        emergencyMode: false,
        reactionTime: 150 + Math.random() * 100
    };
}

function updateAIBrain(player) {
    if (!ball || !player.aiBrain) return;
    
    const brain = player.aiBrain;
    const now = Date.now();
    
    // Update ball prediction
    brain.predictedBallPosition = {
        x: ball.position.x + ball.velocity.x * 10,
        y: ball.position.y + ball.velocity.y * 10
    };
    
    // Assess threat level
    const distanceToBall = Matter.Vector.magnitude(Matter.Vector.sub(ball.position, player.playerBody.position));
    const ballToAIGoal = Math.abs(ball.position.x - (CANVAS_WIDTH - 30));
    brain.threatLevel = Math.max(0, 1 - (ballToAIGoal / CANVAS_WIDTH));
    
    // Consider ball velocity towards AI goal
    if (ball.velocity.x > 0 && ball.position.x > CANVAS_WIDTH * 0.5) {
        brain.threatLevel = Math.min(1, brain.threatLevel + 0.3);
    }
    
    // Choose formation based on game state
    const scoreDiff = team2Score - team1Score;
    const timeLeft = gameTimeRemaining / ROUND_DURATION_SECONDS;
    
    if (scoreDiff < 0 && timeLeft < 0.3) {
        brain.formation = AI_FORMATION.DESPERATE;
    } else if (brain.threatLevel > 0.7) {
        brain.formation = AI_FORMATION.DEFENSIVE;
    } else if (scoreDiff > 0) {
        brain.formation = AI_FORMATION.DEFENSIVE;
    } else {
        brain.formation = AI_FORMATION.BALANCED;
    }
}

function executeAdvancedAILogic(player) {
    if (!ball || !player.aiBrain) return;
    
    const brain = player.aiBrain;
    const ballPos = ball.position;
    const playerPos = player.playerBody.position;
    const distanceToBall = Matter.Vector.magnitude(Matter.Vector.sub(ballPos, playerPos));
    
    // AI positioning logic
    const aiGoalX = CANVAS_WIDTH - 30;
    const opponentGoalX = 30;
    const idealX = aiGoalX - (CANVAS_WIDTH * brain.formation.homeX);
    
    let targetX = idealX;
    let moveDirection = 0;
    
    // Emergency defense
    if (ballPos.x > CANVAS_WIDTH * 0.8 && ball.velocity.x > 0) {
        targetX = Math.max(aiGoalX - 60, ballPos.x - 40);
        brain.currentState = AI_STATES.EMERGENCY_DEFENSE;
    }
    // Ball in AI half - defend
    else if (ballPos.x > CANVAS_WIDTH * 0.6) {
        targetX = Math.min(ballPos.x + 30, aiGoalX - 50);
        brain.currentState = AI_STATES.DEFENDING;
    }
    // Ball in opponent half - attack or return
    else if (ballPos.x < CANVAS_WIDTH * 0.4) {
        if (distanceToBall < 80 && brain.formation.aggressiveness > 0.6) {
            targetX = ballPos.x;
            brain.currentState = AI_STATES.ATTACKING;
        } else {
            targetX = idealX;
            brain.currentState = AI_STATES.POSITIONING;
        }
    }
    // Middle field
    else {
        if (distanceToBall < 60) {
            targetX = ballPos.x;
            brain.currentState = AI_STATES.INTERCEPTING;
        } else {
            targetX = idealX;
            brain.currentState = AI_STATES.POSITIONING;
        }
    }
    
    // Calculate movement
    const directionToTarget = targetX - playerPos.x;
    if (Math.abs(directionToTarget) > PLAYER_RECT_SIZE / 2) {
        moveDirection = Math.sign(directionToTarget);
    }
    
    // Execute movement
    if (moveDirection !== 0 && !player.isRotating && player.isGrounded) {
        player.isRotating = true;
        player.rollDirection = moveDirection;
        const currentAngle = player.playerBody.angle;
        const snappedCurrentAngle = Math.round(currentAngle / (Math.PI / 2)) * (Math.PI / 2);
        player.targetAngle = snappedCurrentAngle + player.rollDirection * (Math.PI / 2);
        Body.setAngularVelocity(player.playerBody, player.rollDirection * PLAYER_ROLL_ANGULAR_VELOCITY_TARGET);
    }
}

// Old AI function removed - replaced with advanced AI system

function perpDistToLine(p1, p2, p3) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (dx === 0 && dy === 0) return Matter.Vector.magnitude(Matter.Vector.sub(p3,p1));
    const t = ((p3.x - p1.x) * dx + (p3.y - p1.y) * dy) / (dx * dx + dy * dy);
    let closestPoint;
    if (t < 0) closestPoint = p1;
    else if (t > 1) closestPoint = p2;
    else closestPoint = { x: p1.x + t * dx, y: p1.y + t * dy };
    return Matter.Vector.magnitude(Matter.Vector.sub(p3, closestPoint));
}


let goalScoredRecently = false;
function handleGoalScored(scoringTeam) {
    if (isGameOver || goalScoredRecently) return;
    goalScoredRecently = true;
    
    // Play goal sound melody
    createTone(523, 150, 'square', 0.2); // C5
    setTimeout(() => createTone(659, 150, 'square', 0.2), 150); // E5
    setTimeout(() => createTone(784, 300, 'square', 0.2), 300); // G5
    
    if (scoringTeam === 1) team1Score++; else if (scoringTeam === 2) team2Score++;
    updateScoreDisplay();

    const { actualGoalOpeningHeight } = getFieldDerivedConstants();
    spawnParticles(ball.position.x, ball.position.y, 25, 'gold', 0, -1, 3, 40, 2);

    gameMessageDisplay.textContent = `GOAL!!! TEAM ${scoringTeam}!`;
    gameMessageDisplay.style.fontSize = '3em';
    gameMessageDisplay.style.color = 'gold';
    gameMessageDisplay.style.textShadow = '2px 2px #000';

    if (checkWinCondition()) {
        goalScoredRecently = false;
        gameMessageDisplay.style.fontSize = '';
        gameMessageDisplay.style.color = '';
        gameMessageDisplay.style.textShadow = '';
        return;
    }

    setTimeout(() => {
        if (gameMessageDisplay.textContent === `GOAL!!! TEAM ${scoringTeam}!`) {
            showGameMessage('');
        }
        gameMessageDisplay.style.fontSize = '';
        gameMessageDisplay.style.color = '';
        gameMessageDisplay.style.textShadow = '';
        goalScoredRecently = false;
    }, 2200);
    resetPositions();
}

function checkWinCondition() {
    if (isGameOver) return true;
    let winner = null;
    let reason = "";

    if (gameTimeRemaining <= 0) {
        if (team1Score > team2Score) {
            winner = 1;
            reason = `Time's Up! Player 1 Wins!`;
        } else if (team2Score > team1Score) {
            winner = 2;
            reason = `Time's Up! Player 2 Wins!`;
        } else {
            winner = 0;
            reason = `Time's Up! It's a Draw!`;
        }
    }

    if (winner !== null) {
        isGameOver = true;
        gameState = 'gameOver';
        const restartKey = 'W';

        // Play game end sound
        if (winner === 0) {
            // Draw sound
            createTone(330, 200, 'sine', 0.2);
            setTimeout(() => createTone(294, 200, 'sine', 0.2), 200);
            setTimeout(() => createTone(262, 400, 'sine', 0.2), 400);
        } else {
            // Win sound
            createTone(523, 150, 'square', 0.2);
            setTimeout(() => createTone(659, 150, 'square', 0.2), 150);
            setTimeout(() => createTone(784, 150, 'square', 0.2), 300);
            setTimeout(() => createTone(1047, 300, 'square', 0.2), 450);
        }

        showGameMessage(`${reason} Final Score: ${team1Score}-${team2Score}. Press '${restartKey}' to restart.`);
        if (runner) Runner.stop(runner);
        if (roundTimerId) {
            clearInterval(roundTimerId);
            roundTimerId = null;
        }
        
        return true;
    }
    return false;
}

function resetPositions() {
    if (ball) {
        Body.setPosition(ball, { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 3 });
        Body.setVelocity(ball, { x: 0, y: 0 }); Body.setAngularVelocity(ball, 0);
    }
    const playerSpawnY = CANVAS_HEIGHT - GROUND_THICKNESS - PLAYER_RECT_SIZE / 2 - 5;
    const player1StartX = CANVAS_WIDTH / 4;
    const player2StartX = CANVAS_WIDTH * 3 / 4;

    players.forEach((player, index) => {
        const startX = (index === 0) ? player1StartX : player2StartX;
        const startY = playerSpawnY;

        if(player.playerBody) {
             World.remove(world, player.playerBody);
        }
        delete player.mainBody;
        delete player.kickingLeg;
        delete player.hipConstraint;
        delete player.head;
        delete player.torso;
        delete player.leftLeg_Instance;
        delete player.rightLeg_Instance;
        delete player.supportLeg;
        delete player.allParts;
        delete player.kickingLegSide;
        delete player.animationState;
        delete player.animationFrame;
        delete player.animationDuration;


        const newPlayerProps = createPlayer(startX, startY, player.color, player.playerTeam === 1, player.isAI);
        for (const key in player) {
            if (Object.hasOwnProperty.call(player, key) && !Object.hasOwnProperty.call(newPlayerProps,key) ) {
                delete player[key];
            }
        }
        Object.assign(player, newPlayerProps);

        Body.setPosition(player.playerBody, {x: startX, y: startY});
        Body.setVelocity(player.playerBody, {x:0, y:0});
        Body.setAngle(player.playerBody, 0);
        Body.setAngularVelocity(player.playerBody, 0);

        player.actionCooldown = 0;
        player.jumpCooldown = 0;
        player.isGrounded = true;
        player.targetAngle = 0;
        player.isRotating = false;
        player.currentFace = 0;
        player.rollDirection = 0;
    });
}

function handleCollisions(event) {
    if (!isGameStarted && !isGameOver) return;
    if (isGameOver && !goalScoredRecently) return;

    const pairs = event.pairs;
    const { actualGoalOpeningHeight } = getFieldDerivedConstants();

    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        let ballBody = null;
        let otherBody = null;
        let playerCollidedObject = null;
        let playerPhysicsBodyCollided = null;

        if (bodyA.label === 'ball') {
            ballBody = bodyA;
            otherBody = bodyB;
        } else if (bodyB.label === 'ball') {
            ballBody = bodyB;
            otherBody = bodyA;
        }

        if (ballBody) {
            for (const p of players) {
                if (otherBody === p.playerBody) {
                    playerCollidedObject = p;
                    playerPhysicsBodyCollided = otherBody;
                    break;
                }
            }

            if (playerCollidedObject) {
                let kickForce = KICK_FORCE_MAGNITUDE;
                let kickAngleFactorY = -0.7;
                let isTimedShot = false;
                const TIMED_JUMP_WINDOW_MS = 200;

                if ((Date.now() - playerCollidedObject.lastJumpTime) < TIMED_JUMP_WINDOW_MS && playerCollidedObject.lastJumpTime !== 0) {
                    kickForce *= TIMED_JUMP_SHOT_BONUS_FACTOR;
                    isTimedShot = true;
                     kickAngleFactorY *= JUMP_SHOT_LOFT_FACTOR;
                }

                // Determine opponent goal correctly
                const opponentGoalX = (playerCollidedObject.playerTeam === 1) ? CANVAS_WIDTH - WALL_THICKNESS : WALL_THICKNESS;
                const ownGoalX = (playerCollidedObject.playerTeam === 1) ? WALL_THICKNESS : CANVAS_WIDTH - WALL_THICKNESS;
                const goalCenterY = CANVAS_HEIGHT - GROUND_THICKNESS - actualGoalOpeningHeight / 2;

                // Special logic for AI to prevent own goals
                let kickTargetPos = { x: opponentGoalX, y: goalCenterY };
                
                if (playerCollidedObject.isAI) {
                    // AI is smarter about kick direction
                    const ballToOwnGoal = Math.abs(ballBody.position.x - ownGoalX);
                    const ballToOpponentGoal = Math.abs(ballBody.position.x - opponentGoalX);
                    
                    // If ball is closer to own goal, kick it away from own goal
                    if (ballToOwnGoal < ballToOpponentGoal * 0.7) {
                        kickTargetPos.x = opponentGoalX;
                        kickTargetPos.y = goalCenterY + (Math.random() - 0.5) * actualGoalOpeningHeight * 0.3;
                    } else {
                        // Normal attack towards opponent goal
                        kickTargetPos.x = opponentGoalX;
                        kickTargetPos.y = goalCenterY + (Math.random() - 0.5) * actualGoalOpeningHeight * 0.6;
                    }
                } else {
                    // Human player - normal targeting
                    if(isTimedShot){
                         kickTargetPos.y = goalCenterY - (actualGoalOpeningHeight * 0.05) + (Math.random() * actualGoalOpeningHeight * 0.1);
                    } else {
                         kickTargetPos.y = goalCenterY - (actualGoalOpeningHeight * 0.25) + (Math.random() * actualGoalOpeningHeight * 0.5);
                    }
                }

                const kickOrigin = playerPhysicsBodyCollided.position;
                let kickVector = Matter.Vector.sub(kickTargetPos, kickOrigin);
                kickVector = Matter.Vector.normalise(kickVector);

                // Ensure kick direction is correct
                const expectedDirection = Math.sign(opponentGoalX - kickOrigin.x);
                if (Math.sign(kickVector.x) !== expectedDirection && playerCollidedObject.isAI) {
                    // Force correct direction for AI
                    kickVector.x = expectedDirection * Math.abs(kickVector.x);
                }

                const baseKickXSign = Math.sign(kickVector.x);
                kickVector.y = Math.min(kickAngleFactorY, kickVector.y * Math.sign(kickAngleFactorY));
                kickVector.x = baseKickXSign * (isTimedShot ? (0.8 + Math.random()*0.2) : (0.4 + Math.random()*0.4) );
                kickVector = Matter.Vector.normalise(kickVector);

                // Play kick sound based on force
                const kickPitch = 150 + (kickForce * 50);
                createTone(kickPitch, 100, 'sawtooth', 0.2);
                setTimeout(() => createTone(kickPitch * 0.7, 50, 'square', 0.1), 50);
                
                Body.applyForce(ballBody, ballBody.position, { x: kickVector.x * kickForce, y: kickVector.y * kickForce });

            } else if (otherBody) {
                if (isGameStarted && !isGameOver) {
                    // Check goal scoring with better detection
                    if (otherBody.label === 'goal-left') {
                        console.log("Ball hit left goal sensor - Team 2 scores!");
                        handleGoalScored(2);
                    } else if (otherBody.label === 'goal-right') {
                        console.log("Ball hit right goal sensor - Team 1 scores!");
                        handleGoalScored(1);
                    }
                }
                if (otherBody.label.includes('wall') || otherBody.label.includes('ceiling') || otherBody.label.includes('crossbar')) {
                    const ballSpeed = Matter.Vector.magnitude(ballBody.velocity);
                    if (ballSpeed > 1.5) {
                        // Play wall hit sound based on speed
                        const hitPitch = 250 + (ballSpeed * 30);
                        createTone(hitPitch, 80, 'square', 0.15);
                        
                        let particleColor = '#DDDDDD';
                        if (otherBody.label.includes('crossbar')) {
                            particleColor = '#FFFF88';
                            // Special crossbar sound
                            createTone(800, 100, 'sine', 0.1);
                        }
                        
                        const collisionPoint = pair.collision.supports && pair.collision.supports.length > 0 ? pair.collision.supports[0] : ballBody.position;
                        const collisionNormal = pair.collision.normal;
                        const particleBaseVelX = collisionNormal.x * 0.5;
                        const particleBaseVelY = collisionNormal.y * 0.5;
                        spawnParticles(collisionPoint.x, collisionPoint.y, 6, particleColor, particleBaseVelX, particleBaseVelY, 2, 20, 1);
                    }
                }
            }
        }

        if (isGameStarted) {
            players.forEach(player => {
                if ((bodyA === player.playerBody && bodyB.label === 'ground') || (bodyB === player.playerBody && bodyA.label === 'ground')) {
                    player.isGrounded = true;
                }
            });
            
            // Player vs Player collisions
            let player1 = null, player2 = null;
            if (bodyA.label && bodyA.label.includes('player-t') && bodyB.label && bodyB.label.includes('player-t')) {
                player1 = players.find(p => p.playerBody === bodyA);
                player2 = players.find(p => p.playerBody === bodyB);
            }
            
            if (player1 && player2) {
                // Calculate collision force
                const velocityA = Matter.Vector.magnitude(bodyA.velocity);
                const velocityB = Matter.Vector.magnitude(bodyB.velocity);
                const totalVelocity = velocityA + velocityB;
                
                if (totalVelocity > 2) {
                    // Play collision sound
                    createTone(200 + Math.random() * 100, 150, 'sawtooth', 0.15);
                    
                    // Add collision particles
                    const collisionPoint = {
                        x: (bodyA.position.x + bodyB.position.x) / 2,
                        y: (bodyA.position.y + bodyB.position.y) / 2
                    };
                    spawnParticles(collisionPoint.x, collisionPoint.y, 8, '#FFFF00', 0, -1, 3, 15, 2);
                    
                    // Apply bounce effect
                    const forceMultiplier = Math.min(totalVelocity * 0.3, 0.8);
                    const direction1 = Matter.Vector.normalise(Matter.Vector.sub(bodyA.position, bodyB.position));
                    const direction2 = Matter.Vector.normalise(Matter.Vector.sub(bodyB.position, bodyA.position));
                    
                    Body.applyForce(bodyA, bodyA.position, {
                        x: direction1.x * forceMultiplier,
                        y: direction1.y * forceMultiplier * 0.5
                    });
                    
                    Body.applyForce(bodyB, bodyB.position, {
                        x: direction2.x * forceMultiplier,
                        y: direction2.y * forceMultiplier * 0.5
                    });
                }
            }
        }
    }
}


function updateScoreDisplay() {
    team1ScoreDisplay.textContent = `Team 1: ${team1Score}`;
    team2ScoreDisplay.textContent = `Team 2: ${team2Score}`;
}

function showGameMessage(message) {
    gameMessageDisplay.textContent = message;
}

// --- Custom Pixel Art Rendering ---
function gameRenderLoop() {
    if (!pixelCtx || !canvas) {
        console.error("pixelCtx or canvas not available in gameRenderLoop");
        return;
    }

    try {
        pixelCtx.fillStyle = '#0000FF'; // Blue
        pixelCtx.fillRect(0, 0, PIXEL_CANVAS_WIDTH, PIXEL_CANVAS_HEIGHT);

        const mainCtx = canvas.getContext('2d');
        mainCtx.imageSmoothingEnabled = false;
        mainCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        mainCtx.drawImage(pixelCanvas, 0, 0, PIXEL_CANVAS_WIDTH, PIXEL_CANVAS_HEIGHT, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    } catch(e) {
        console.error("Error in simplified gameRenderLoop:", e);
        if (gameRenderLoopId) cancelAnimationFrame(gameRenderLoopId);
        return;
    }

    gameRenderLoopId = requestAnimationFrame(gameRenderLoop);
}


// --- Isometric Rendering Constants ---
const ISOMETRIC_ANGLE = Math.PI / 6;
const ISOMETRIC_DEPTH_FACTOR = 0.5;

function drawPlayer(pCtx, body, playerColor) {
    const x = body.position.x / PIXEL_SCALE;
    const y = body.position.y / PIXEL_SCALE;
    const size = PLAYER_RECT_SIZE / PIXEL_SCALE;
    const pixelSize = Math.max(1, Math.round(1 / PIXEL_SCALE));
    
    pCtx.save();
    pCtx.translate(x, y);
    pCtx.rotate(body.angle);
    
    // Draw player body (3D-ish rectangle)
    const bodyWidth = size * 0.7;
    const bodyHeight = size * 0.9;
    
    // Body shadow/depth
    pCtx.fillStyle = shadeColor(playerColor, -0.3);
    pCtx.fillRect(-bodyWidth/2 + pixelSize, -bodyHeight/2 + pixelSize, bodyWidth, bodyHeight);
    
    // Main body
    pCtx.fillStyle = playerColor;
    pCtx.fillRect(-bodyWidth/2, -bodyHeight/2, bodyWidth, bodyHeight);
    
    // Player details
    const headSize = size * 0.25;
    const headY = -bodyHeight/2 - headSize/2;
    
    // Head shadow
    pCtx.fillStyle = shadeColor('#FFDBAC', -0.2);
    pCtx.fillRect(-headSize/2 + pixelSize/2, headY + pixelSize/2, headSize, headSize);
    
    // Head
    pCtx.fillStyle = '#FFDBAC'; // Skin color
    pCtx.fillRect(-headSize/2, headY, headSize, headSize);
    
    // Jersey number
    pCtx.fillStyle = shadeColor(playerColor, 0.4);
    const numberSize = pixelSize * 2;
    pCtx.fillRect(-numberSize/2, -bodyHeight/4, numberSize, numberSize);
    
    // Legs
    const legWidth = size * 0.15;
    const legHeight = size * 0.3;
    const legY = bodyHeight/2 - legHeight/2;
    
    // Leg shadows
    pCtx.fillStyle = shadeColor(playerColor, -0.3);
    pCtx.fillRect(-legWidth + pixelSize/2, legY + pixelSize/2, legWidth, legHeight);
    pCtx.fillRect(pixelSize/2, legY + pixelSize/2, legWidth, legHeight);
    
    // Legs
    pCtx.fillStyle = playerColor;
    pCtx.fillRect(-legWidth, legY, legWidth, legHeight);
    pCtx.fillRect(0, legY, legWidth, legHeight);
    
    // Feet
    pCtx.fillStyle = '#000000';
    pCtx.fillRect(-legWidth, legY + legHeight - pixelSize, legWidth + pixelSize, pixelSize * 2);
    pCtx.fillRect(0, legY + legHeight - pixelSize, legWidth + pixelSize, pixelSize * 2);
    
    pCtx.restore();
}

function drawPixelIsoRectangle(pCtx, body, colorOverride = null) {
    const x = body.position.x / PIXEL_SCALE;
    const y = body.position.y / PIXEL_SCALE;
    let pWidth, pHeight;
    const label = body.label || '';

    if (label.includes('player-t')) {
        // Players are now drawn with drawPlayer function
        return;
    }
    else if (label === 'ground') { pWidth = CANVAS_WIDTH / PIXEL_SCALE; pHeight = GROUND_THICKNESS / PIXEL_SCALE; }
    else if (label.includes('wall-left')) { pWidth = WALL_THICKNESS / PIXEL_SCALE; pHeight = CANVAS_HEIGHT / PIXEL_SCALE; }
    else if (label.includes('wall-right')) { pWidth = WALL_THICKNESS / PIXEL_SCALE; pHeight = CANVAS_HEIGHT / PIXEL_SCALE; }
    else if (label === 'ceiling') { pWidth = CANVAS_WIDTH / PIXEL_SCALE; pHeight = WALL_THICKNESS / PIXEL_SCALE; }
    else if (label.includes('crossbar')) { pWidth = GOAL_MOUTH_VISUAL_WIDTH / PIXEL_SCALE; pHeight = CROSSBAR_THICKNESS / PIXEL_SCALE; }
    else {
        const boundsWidth = (body.bounds.max.x - body.bounds.min.x) / PIXEL_SCALE;
        const boundsHeight = (body.bounds.max.y - body.bounds.min.y) / PIXEL_SCALE;
        pWidth = Math.max(1, Math.round(boundsWidth));
        pHeight = Math.max(1, Math.round(boundsHeight));
    }

    if (typeof body.currentPixelWidth !== 'undefined') {
        pWidth = body.currentPixelWidth;
    }
    if (typeof body.currentPixelHeight !== 'undefined') {
        pHeight = body.currentPixelHeight;
    }

    const color = colorOverride || (body.render && body.render.fillStyle) || '#333';
    pCtx.fillStyle = color;

    pCtx.save();
    pCtx.translate(x, y);
    pCtx.rotate(body.angle);

    const depthX = pWidth * ISOMETRIC_DEPTH_FACTOR * Math.cos(ISOMETRIC_ANGLE);
    const depthY = pHeight * ISOMETRIC_DEPTH_FACTOR * Math.sin(ISOMETRIC_ANGLE) * 0.5;

    if (label === 'ground') {
        // Skip rendering - grass is drawn in stadium background
        return;
    } else if (label.includes('wall-left') || label.includes('wall-right')) {
        // Skip rendering walls - they're invisible
        return;
    }
     else {
        pCtx.beginPath();
        pCtx.moveTo(-pWidth / 2, -pHeight / 2);
        pCtx.lineTo(pWidth / 2, -pHeight / 2);
        pCtx.lineTo(pWidth / 2, pHeight / 2);
        pCtx.lineTo(-pWidth / 2, pHeight / 2);
        pCtx.closePath();
        pCtx.fill();
    }

    if (pHeight > 2 && pWidth > 2 && !label.includes('ground') && !label.includes('ceiling')) {
        const darkerColor = shadeColor(color, -0.2);
        pCtx.fillStyle = darkerColor;

        if (label.includes('wall-left')) {
            pCtx.beginPath();
            pCtx.moveTo(pWidth / 2, -pHeight / 2);
            pCtx.lineTo(pWidth / 2 + depthX, -pHeight / 2 - depthY);
            pCtx.lineTo(pWidth / 2 + depthX, pHeight / 2 - depthY);
            pCtx.lineTo(pWidth / 2, pHeight / 2);
            pCtx.closePath();
            pCtx.fill();
        } else if (label.includes('wall-right')) {
            pCtx.beginPath();
            pCtx.moveTo(-pWidth / 2, -pHeight / 2);
            pCtx.lineTo(-pWidth / 2 - depthX, -pHeight / 2 + depthY);
            pCtx.lineTo(-pWidth / 2 - depthX, pHeight / 2 + depthY);
            pCtx.lineTo(-pWidth / 2, pHeight / 2);
            pCtx.closePath();
            pCtx.fill();
        } else {
            pCtx.beginPath();
            pCtx.moveTo(-pWidth / 2, -pHeight / 2);
            pCtx.lineTo(-pWidth / 2 + depthX, -pHeight / 2 - depthY);
            pCtx.lineTo(pWidth / 2 + depthX, -pHeight / 2 - depthY);
            pCtx.lineTo(pWidth / 2, -pHeight / 2);
            pCtx.closePath();
            pCtx.fill();

            pCtx.beginPath();
            pCtx.moveTo(pWidth / 2, -pHeight / 2);
            pCtx.lineTo(pWidth / 2 + depthX, -pHeight / 2 - depthY);
            pCtx.lineTo(pWidth / 2 + depthX, pHeight / 2 - depthY);
            pCtx.lineTo(pWidth / 2, pHeight / 2);
            pCtx.closePath();
            pCtx.fill();
        }
    }
    pCtx.restore();
}

function shadeColor(color, percent) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = parseInt(R * (1 + percent));
    G = parseInt(G * (1 + percent));
    B = parseInt(B * (1 + percent));

    R = (R < 255) ? R : 255;
    G = (G < 255) ? G : 255;
    B = (B < 255) ? B : 255;

    R = (R > 0) ? R : 0;
    G = (G > 0) ? G : 0;
    B = (B > 0) ? B : 0;

    const RR = ((R.toString(16).length === 1) ? "0" + R.toString(16) : R.toString(16));
    const GG = ((G.toString(16).length === 1) ? "0" + G.toString(16) : G.toString(16));
    const BB = ((B.toString(16).length === 1) ? "0" + B.toString(16) : B.toString(16));

    return "#" + RR + GG + BB;
}

function drawStadiumBackground() {
    // Sky background
    const gradient = pixelCtx.createLinearGradient(0, 0, 0, PIXEL_CANVAS_HEIGHT * 0.4);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F6FF');
    pixelCtx.fillStyle = gradient;
    pixelCtx.fillRect(0, 0, PIXEL_CANVAS_WIDTH, PIXEL_CANVAS_HEIGHT * 0.4);
    
    // Draw clouds
    drawBackgroundClouds();
    
    // Draw stadium stands/seating
    const standHeight = PIXEL_CANVAS_HEIGHT * 0.4;
    const standDepth = 35;
    
    // Stadium structure
    pixelCtx.fillStyle = '#A0A0A0';
    pixelCtx.fillRect(0, 0, standDepth, standHeight);
    pixelCtx.fillRect(PIXEL_CANVAS_WIDTH - standDepth, 0, standDepth, standHeight);
    pixelCtx.fillRect(standDepth, 0, PIXEL_CANVAS_WIDTH - standDepth * 2, standDepth);
    
    // Stadium seats with better pattern
    for (let tier = 0; tier < 3; tier++) {
        const tierY = tier * (standHeight / 3) + 10;
        const tierHeight = standHeight / 3 - 5;
        
        // Left stand seats
        for (let x = 3; x < standDepth - 3; x += 2) {
            for (let y = tierY; y < tierY + tierHeight - 5; y += 3) {
                const seatColor = Math.random() > 0.6 ? 
                    (Math.random() > 0.5 ? '#FF4444' : '#4444FF') : 
                    (Math.random() > 0.5 ? '#44FF44' : '#FFFF44');
                pixelCtx.fillStyle = seatColor;
                pixelCtx.fillRect(x, y, 1, 2);
            }
        }
        
        // Right stand seats
        for (let x = PIXEL_CANVAS_WIDTH - standDepth + 3; x < PIXEL_CANVAS_WIDTH - 3; x += 2) {
            for (let y = tierY; y < tierY + tierHeight - 5; y += 3) {
                const seatColor = Math.random() > 0.6 ? 
                    (Math.random() > 0.5 ? '#FF4444' : '#4444FF') : 
                    (Math.random() > 0.5 ? '#44FF44' : '#FFFF44');
                pixelCtx.fillStyle = seatColor;
                pixelCtx.fillRect(x, y, 1, 2);
            }
        }
    }
    
    // Top stand seats
    for (let x = standDepth + 5; x < PIXEL_CANVAS_WIDTH - standDepth - 5; x += 3) {
        for (let y = 5; y < standDepth - 5; y += 2) {
            const seatColor = Math.random() > 0.7 ? '#00FF00' : '#FFFF00';
            pixelCtx.fillStyle = seatColor;
            pixelCtx.fillRect(x, y, 2, 1);
        }
    }
    
    // Floodlights
    drawFloodlights();
    
    // Draw soccer field with proper grass pattern
    drawSoccerField();
}

function drawBackgroundClouds() {
    // Moving clouds for background
    if (!window.backgroundClouds) {
        window.backgroundClouds = [
            {x: 30, y: 15, size: 8, speed: 0.2},
            {x: 80, y: 10, size: 6, speed: 0.15},
            {x: 140, y: 20, size: 10, speed: 0.3},
            {x: 200, y: 12, size: 7, speed: 0.25},
            {x: 260, y: 18, size: 9, speed: 0.18}
        ];
    }
    
    pixelCtx.fillStyle = '#FFFFFF';
    window.backgroundClouds.forEach(cloud => {
        // Update cloud position
        cloud.x += cloud.speed;
        if (cloud.x > PIXEL_CANVAS_WIDTH + 20) {
            cloud.x = -20;
        }
        
        // Simple cloud shape
        for (let i = 0; i < 5; i++) {
            const offsetX = (i - 2) * 3;
            const offsetY = Math.sin(i) * 2;
            pixelCtx.fillRect(cloud.x + offsetX, cloud.y + offsetY, cloud.size, cloud.size * 0.6);
        }
    });
}

function drawFloodlights() {
    // Stadium floodlight towers
    const lightPositions = [
        {x: 15, y: 5},
        {x: PIXEL_CANVAS_WIDTH - 25, y: 5},
        {x: PIXEL_CANVAS_WIDTH / 2 - 15, y: 2},
        {x: PIXEL_CANVAS_WIDTH / 2 + 15, y: 2}
    ];
    
    lightPositions.forEach(light => {
        // Tower
        pixelCtx.fillStyle = '#666666';
        pixelCtx.fillRect(light.x, light.y, 2, 15);
        
        // Light fixture
        pixelCtx.fillStyle = '#FFFF88';
        pixelCtx.fillRect(light.x - 1, light.y, 4, 3);
        
        // Light beam (subtle)
        pixelCtx.fillStyle = 'rgba(255, 255, 200, 0.1)';
        pixelCtx.fillRect(light.x - 5, light.y + 3, 12, 25);
    });
}

function drawSoccerField() {
    const fieldStartY = PIXEL_CANVAS_HEIGHT * 0.4;
    const fieldHeight = PIXEL_CANVAS_HEIGHT - fieldStartY;
    
    // Base grass color
    pixelCtx.fillStyle = '#228B22';
    pixelCtx.fillRect(0, fieldStartY, PIXEL_CANVAS_WIDTH, fieldHeight);
    
    // Grass stripes (static pattern)
    const stripeWidth = 8;
    pixelCtx.fillStyle = '#32CD32';
    for (let x = 0; x < PIXEL_CANVAS_WIDTH; x += stripeWidth * 2) {
        pixelCtx.fillRect(x, fieldStartY, stripeWidth, fieldHeight);
    }
    
    // Center circle
    pixelCtx.strokeStyle = '#FFFFFF';
    pixelCtx.lineWidth = 2;
    pixelCtx.beginPath();
    pixelCtx.arc(PIXEL_CANVAS_WIDTH / 2, fieldStartY + fieldHeight / 2, 20, 0, Math.PI * 2);
    pixelCtx.stroke();
    
    // Center line
    pixelCtx.beginPath();
    pixelCtx.moveTo(PIXEL_CANVAS_WIDTH / 2, fieldStartY);
    pixelCtx.lineTo(PIXEL_CANVAS_WIDTH / 2, PIXEL_CANVAS_HEIGHT);
    pixelCtx.stroke();
    
    // Goal areas
    const goalAreaWidth = 40;
    const goalAreaHeight = 25;
    const goalY = PIXEL_CANVAS_HEIGHT - 30;
    
    // Left goal area
    pixelCtx.strokeRect(0, goalY - goalAreaHeight, goalAreaWidth, goalAreaHeight);
    
    // Right goal area  
    pixelCtx.strokeRect(PIXEL_CANVAS_WIDTH - goalAreaWidth, goalY - goalAreaHeight, goalAreaWidth, goalAreaHeight);
}


function drawCloud(cloud) {
    const cloudSize = Math.max(3, Math.round(cloud.size / PIXEL_SCALE));
    const pixelSize = Math.max(1, Math.round(1 / PIXEL_SCALE));
    
    pixelCtx.globalAlpha = cloud.opacity;
    pixelCtx.fillStyle = activeTheme.cloudColor;
    
    // Different cloud types
    const cloudPatterns = [
        // Type 0: Fluffy cloud
        [
            { x: -cloudSize * 0.3, y: 0, size: cloudSize * 0.6 },
            { x: cloudSize * 0.2, y: -cloudSize * 0.2, size: cloudSize * 0.5 },
            { x: cloudSize * 0.4, y: cloudSize * 0.1, size: cloudSize * 0.4 },
            { x: -cloudSize * 0.1, y: -cloudSize * 0.3, size: cloudSize * 0.3 }
        ],
        // Type 1: Stretched cloud
        [
            { x: -cloudSize * 0.4, y: 0, size: cloudSize * 0.8 },
            { x: cloudSize * 0.1, y: -cloudSize * 0.1, size: cloudSize * 0.4 },
            { x: cloudSize * 0.3, y: cloudSize * 0.1, size: cloudSize * 0.3 }
        ],
        // Type 2: Small puffy cloud
        [
            { x: 0, y: 0, size: cloudSize * 0.7 },
            { x: -cloudSize * 0.2, y: -cloudSize * 0.1, size: cloudSize * 0.4 },
            { x: cloudSize * 0.2, y: cloudSize * 0.1, size: cloudSize * 0.3 }
        ]
    ];
    
    const pattern = cloudPatterns[cloud.type] || cloudPatterns[0];
    
    pattern.forEach(part => {
        const partX = Math.round(cloud.x + part.x);
        const partY = Math.round(cloud.y + part.y);
        const partSize = Math.max(pixelSize * 2, Math.round(part.size));
        
        // Draw more pixelated cloud part
        for (let x = 0; x < partSize; x += pixelSize) {
            for (let y = 0; y < partSize; y += pixelSize) {
                const distance = Math.sqrt((x - partSize/2) ** 2 + (y - partSize/2) ** 2);
                if (distance < partSize/2 && Math.random() > 0.15) {
                    pixelCtx.fillRect(partX + x - partSize/2, partY + y - partSize/2, pixelSize, pixelSize);
                }
            }
        }
    });
    
    pixelCtx.globalAlpha = 1.0;
}

function drawSpectator(spectator) {
    const pixelSize = Math.max(1, Math.round(1 / PIXEL_SCALE));
    const size = pixelSize * 2;
    
    // Body
    pixelCtx.fillStyle = spectator.color;
    pixelCtx.fillRect(spectator.x, spectator.y, size, size);
    
    // Head
    pixelCtx.fillStyle = '#FFDBAC';
    pixelCtx.fillRect(spectator.x, spectator.y - size, size, size);
    
    // Animation (occasional wave)
    if (Math.sin(spectator.animation) > 0.8) {
        pixelCtx.fillStyle = spectator.color;
        pixelCtx.fillRect(spectator.x + size, spectator.y - size/2, size/2, size/2);
    }
}

function drawStadiumLight(light) {
    const pixelSize = Math.max(1, Math.round(2 / PIXEL_SCALE));
    const lightSize = pixelSize * 3;
    
    // Light pole
    pixelCtx.fillStyle = '#444444';
    pixelCtx.fillRect(light.x - pixelSize/2, light.y, pixelSize, lightSize * 2);
    
    // Light fixture
    pixelCtx.fillStyle = '#CCCCCC';
    pixelCtx.fillRect(light.x - lightSize/2, light.y, lightSize, pixelSize);
    
    // Light glow
    const glowSize = lightSize * 2;
    const glowGradient = pixelCtx.createRadialGradient(
        light.x, light.y, 0,
        light.x, light.y, glowSize
    );
    glowGradient.addColorStop(0, `rgba(255, 255, 200, ${light.intensity * 0.3})`);
    glowGradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
    
    pixelCtx.fillStyle = glowGradient;
    pixelCtx.fillRect(light.x - glowSize, light.y - glowSize/2, glowSize * 2, glowSize);
}

function drawInGameScoreboard() {
    if (gameState !== 'playing') return;
    
    const scoreboardX = 5;
    const scoreboardY = 5;
    const scoreboardWidth = 80;
    const scoreboardHeight = 25;
    
    // TV-style scoreboard background with gradient
    const gradient = pixelCtx.createLinearGradient(scoreboardX, scoreboardY, scoreboardX, scoreboardY + scoreboardHeight);
    gradient.addColorStop(0, '#2C3E50');
    gradient.addColorStop(0.5, '#34495E');
    gradient.addColorStop(1, '#2C3E50');
    pixelCtx.fillStyle = gradient;
    pixelCtx.fillRect(scoreboardX, scoreboardY, scoreboardWidth, scoreboardHeight);
    
    // Border
    pixelCtx.strokeStyle = '#ECF0F1';
    pixelCtx.lineWidth = 1;
    pixelCtx.strokeRect(scoreboardX, scoreboardY, scoreboardWidth, scoreboardHeight);
    
    // Team 1 section (Red)
    pixelCtx.fillStyle = '#E74C3C';
    pixelCtx.fillRect(scoreboardX + 2, scoreboardY + 2, 25, 21);
    
    // Team 2 section (Blue)  
    pixelCtx.fillStyle = '#3498DB';
    pixelCtx.fillRect(scoreboardX + scoreboardWidth - 27, scoreboardY + 2, 25, 21);
    
    // Team labels
    pixelCtx.fillStyle = '#FFFFFF';
    drawPixelText(scoreboardX + 4, scoreboardY + 4, 'RED', 1);
    drawPixelText(scoreboardX + scoreboardWidth - 25, scoreboardY + 4, 'BLU', 1);
    
    // Team scores (larger)
    pixelCtx.fillStyle = '#FFFFFF';
    drawPixelText(scoreboardX + 12, scoreboardY + 13, team1Score.toString(), 2);
    drawPixelText(scoreboardX + scoreboardWidth - 17, scoreboardY + 13, team2Score.toString(), 2);
    
    // Separator
    pixelCtx.fillStyle = '#BDC3C7';
    pixelCtx.fillRect(scoreboardX + 30, scoreboardY + 2, 20, 21);
    
    // Timer section
    pixelCtx.fillStyle = '#000000';
    const minutes = Math.floor(gameTimeRemaining / 60);
    const seconds = gameTimeRemaining % 60;
    const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    drawPixelText(scoreboardX + 32, scoreboardY + 8, timeText, 1);
    
    // Live indicator
    if (gameTimeRemaining % 2 === 0) {
        pixelCtx.fillStyle = '#E74C3C';
        pixelCtx.fillRect(scoreboardX + 32, scoreboardY + 17, 3, 3);
        pixelCtx.fillStyle = '#FFFFFF';
        drawPixelText(scoreboardX + 37, scoreboardY + 17, 'LIVE', 1);
    }
}

function drawPixelText(x, y, text, pixelSize) {
    // Simple pixel font for numbers and letters
    const fontMap = {
        '0': [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
        '1': [[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]],
        '2': [[1,1,1],[0,0,1],[1,1,1],[1,0,0],[1,1,1]],
        '3': [[1,1,1],[0,0,1],[1,1,1],[0,0,1],[1,1,1]],
        '4': [[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]],
        '5': [[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
        '6': [[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]],
        '7': [[1,1,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]],
        '8': [[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]],
        '9': [[1,1,1],[1,0,1],[1,1,1],[0,0,1],[1,1,1]],
        'A': [[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
        'B': [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,1,0]],
        'C': [[0,1,1],[1,0,0],[1,0,0],[1,0,0],[0,1,1]],
        'D': [[1,1,0],[1,0,1],[1,0,1],[1,0,1],[1,1,0]],
        'E': [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
        'F': [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,0,0]],
        'G': [[0,1,1],[1,0,0],[1,0,1],[1,0,1],[0,1,1]],
        'H': [[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
        'I': [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
        'L': [[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,1,1]],
        'M': [[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1]],
        'N': [[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1]],
        'O': [[0,1,0],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
        'P': [[1,1,1],[1,0,1],[1,1,1],[1,0,0],[1,0,0]],
        'R': [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,0,1]],
        'S': [[0,1,1],[1,0,0],[0,1,0],[0,0,1],[1,1,0]],
        'T': [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
        'U': [[1,0,1],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
        'X': [[1,0,1],[1,0,1],[0,1,0],[1,0,1],[1,0,1]],
        ' ': [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]]
    };
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i].toUpperCase();
        const pattern = fontMap[char];
        if (pattern) {
            for (let row = 0; row < pattern.length; row++) {
                for (let col = 0; col < pattern[row].length; col++) {
                    if (pattern[row][col]) {
                        pixelCtx.fillRect(
                            x + i * 4 * pixelSize + col * pixelSize,
                            y + row * pixelSize,
                            pixelSize,
                            pixelSize
                        );
                    }
                }
            }
        }
    }
}

// Draw menu function removed - game starts directly

function drawPixelIsoCircle(pCtx, body, colorOverride = null) {
    const x = body.position.x / PIXEL_SCALE;
    const y = body.position.y / PIXEL_SCALE;
    const radius = (typeof body.currentPixelRadius !== 'undefined' ? body.currentPixelRadius : (body.circleRadius || BALL_RADIUS)) / PIXEL_SCALE;
    let baseColor = colorOverride || (body.render && body.render.fillStyle) || '#333';

    if (body.label === 'ball') {
        baseColor = BALL_PANEL_COLOR_PRIMARY;
        pCtx.fillStyle = baseColor;
        pCtx.beginPath();
        pCtx.arc(x, y, Math.max(1, radius), 0, Math.PI * 2);
        pCtx.fill();

        const panelColor = BALL_PANEL_COLOR_SECONDARY;
        const numPanels = 5;
        const panelRadius = radius * 0.35;
        const panelOffsetRadius = radius * 0.55;

        for (let i = 0; i < numPanels; i++) {
            const angleOffset = body.angle * 2;
            const angle = (i / numPanels) * Math.PI * 2 + angleOffset;

            const panelX = x + panelOffsetRadius * Math.cos(angle);
            const panelY = y + panelOffsetRadius * Math.sin(angle);

            pCtx.fillStyle = panelColor;
            pCtx.beginPath();
            pCtx.arc(panelX, panelY, Math.max(1, panelRadius), 0, Math.PI * 2);
            pCtx.fill();
        }
        if (radius > 1) {
            const darkerShade = shadeColor(baseColor, -0.1);
            pCtx.fillStyle = darkerShade;
            pCtx.beginPath();
            pCtx.arc(x + radius * 0.15, y + radius * 0.15, radius * 0.85, 0, Math.PI * 2);
            pCtx.fill();
        }

    } else {
        pCtx.fillStyle = baseColor;
        pCtx.beginPath();
        pCtx.arc(x, y, Math.max(1, radius), 0, Math.PI * 2);
        pCtx.fill();

        if (radius > 1) {
            const darkerColor = shadeColor(baseColor, -0.25);
            pCtx.fillStyle = darkerColor;
            pCtx.beginPath();
            pCtx.arc(x + radius * 0.2, y + radius * 0.2, radius * 0.8, 0, Math.PI * 2);
            pCtx.fill();

            pCtx.fillStyle = baseColor;
            pCtx.beginPath();
            pCtx.arc(x - radius * 0.1, y - radius * 0.1, radius * 0.5, 0, Math.PI * 2);
            pCtx.fill();
        }
    }
}


function customRenderAll() {
    // Always render the game without menu checks

    // Draw white background
    pixelCtx.fillStyle = '#FFFFFF';
    pixelCtx.fillRect(0, 0, PIXEL_CANVAS_WIDTH, PIXEL_CANVAS_HEIGHT);
    
    // Draw stadium background elements
    drawStadiumBackground();
    
    // Draw stadium lights first (background lighting)
    stadiumLights.forEach(light => drawStadiumLight(light));
    
    // Draw moving clouds
    if (clouds && clouds.length > 0) {
        clouds.forEach(cloud => drawCloud(cloud));
    }
    
    // Draw sun/moon with dynamic color
    const currentSunColor = getCurrentSunColor();
    const sunSize = Math.max(6, Math.round(8 / PIXEL_SCALE));
    const sunGlow = Math.max(10, Math.round(14 / PIXEL_SCALE));
    
    // Sun glow
    const sunGradient = pixelCtx.createRadialGradient(
        sunPosition.x, sunPosition.y, 0,
        sunPosition.x, sunPosition.y, sunGlow
    );
    sunGradient.addColorStop(0, currentSunColor + '80');
    sunGradient.addColorStop(1, currentSunColor + '00');
    pixelCtx.fillStyle = sunGradient;
    pixelCtx.fillRect(
        sunPosition.x - sunGlow, sunPosition.y - sunGlow,
        sunGlow * 2, sunGlow * 2
    );
    
    // Sun body (pixelated)
    const pixelSize = Math.max(1, Math.round(1 / PIXEL_SCALE));
    pixelCtx.fillStyle = currentSunColor;
    for (let x = 0; x < sunSize; x += pixelSize) {
        for (let y = 0; y < sunSize; y += pixelSize) {
            const distance = Math.sqrt((x - sunSize/2) ** 2 + (y - sunSize/2) ** 2);
            if (distance < sunSize/2) {
                pixelCtx.fillRect(
                    sunPosition.x - sunSize/2 + x,
                    sunPosition.y - sunSize/2 + y,
                    pixelSize, pixelSize
                );
            }
        }
    }

    const bodiesToRender = [];
    players.forEach(p => {
        bodiesToRender.push(p.playerBody);
    });
    if(ball) bodiesToRender.push(ball);

    const staticBodies = Composite.allBodies(world).filter(b => b.isStatic && !b.isSensor);
    bodiesToRender.push(...staticBodies);


    particles.forEach(particle => {
        pixelCtx.fillStyle = particle.color;
        pixelCtx.fillRect(
            Math.round(particle.x - particle.size / 2),
            Math.round(particle.y - particle.size / 2),
            Math.max(1, particle.size),
            Math.max(1, particle.size)
        );
    });


    bodiesToRender.forEach(body => {
        if (body.label === 'ball') {
            drawPixelIsoCircle(pixelCtx, body, BALL_PANEL_COLOR_PRIMARY);
        } else if (body.label && body.label.includes('player-t')) {
            const playerObject = players.find(p => p.playerBody === body);
            if (playerObject) {
                drawPlayer(pixelCtx, playerObject.playerBody, playerObject.color);
            }
        }
         else if (body.isStatic) {
             drawPixelIsoRectangle(pixelCtx, body, body.render.fillStyle);
        }
    });
    
    // Draw in-game scoreboard
    drawInGameScoreboard();
    
    // Draw in-canvas control buttons
    drawControlButtons();

    const goalPostColor = '#FFFFFF';
    const netColor = '#CCCCCC';
    const postPixelThickness = Math.max(1, Math.round(8 / PIXEL_SCALE));
    const goalPixelHeight = Math.round(GOAL_HEIGHT / PIXEL_SCALE);
    const goalMouthPixelWidth = Math.round(GOAL_MOUTH_VISUAL_WIDTH / PIXEL_SCALE);
    const goalBaseY = Math.round((CANVAS_HEIGHT - GROUND_THICKNESS) / PIXEL_SCALE);
    const goalTopActualY = goalBaseY - goalPixelHeight;

    const isoDepth = postPixelThickness * ISOMETRIC_DEPTH_FACTOR * 1.5;

    pixelCtx.lineWidth = Math.max(1, Math.round(1 / PIXEL_SCALE));

    // Left Goal (3D isometric)
    const leftGoalMouthX = 10;

    // Goal post depth/shadow
    pixelCtx.fillStyle = shadeColor(goalPostColor, -0.3);
    pixelCtx.fillRect(leftGoalMouthX + isoDepth, goalTopActualY - isoDepth * 0.5, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(leftGoalMouthX + goalMouthPixelWidth - postPixelThickness + isoDepth, goalTopActualY - isoDepth * 0.5, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(leftGoalMouthX + isoDepth, goalTopActualY - isoDepth * 0.5, goalMouthPixelWidth, postPixelThickness);

    // Main goal posts
    pixelCtx.fillStyle = goalPostColor;
    pixelCtx.fillRect(leftGoalMouthX, goalTopActualY, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(leftGoalMouthX + goalMouthPixelWidth - postPixelThickness, goalTopActualY, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(leftGoalMouthX, goalTopActualY, goalMouthPixelWidth, postPixelThickness);

    pixelCtx.fillStyle = shadeColor(goalPostColor, -0.1);
    pixelCtx.beginPath();
    pixelCtx.moveTo(leftGoalMouthX + postPixelThickness, goalTopActualY);
    pixelCtx.lineTo(leftGoalMouthX + postPixelThickness + isoDepth, goalTopActualY - isoDepth * 0.5);
    pixelCtx.lineTo(leftGoalMouthX + postPixelThickness + isoDepth, goalBaseY - isoDepth * 0.5);
    pixelCtx.lineTo(leftGoalMouthX + postPixelThickness, goalBaseY);
    pixelCtx.closePath();
    pixelCtx.fill();

    pixelCtx.beginPath();
    pixelCtx.moveTo(leftGoalMouthX + goalMouthPixelWidth - postPixelThickness, goalTopActualY);
    pixelCtx.lineTo(leftGoalMouthX + goalMouthPixelWidth - postPixelThickness + isoDepth, goalTopActualY - isoDepth * 0.5);
    pixelCtx.lineTo(leftGoalMouthX + goalMouthPixelWidth - postPixelThickness + isoDepth, goalBaseY - isoDepth*0.5);
    pixelCtx.lineTo(leftGoalMouthX + goalMouthPixelWidth - postPixelThickness, goalBaseY);
    pixelCtx.closePath();
    pixelCtx.fill();

    pixelCtx.beginPath();
    pixelCtx.moveTo(leftGoalMouthX, goalTopActualY);
    pixelCtx.lineTo(leftGoalMouthX + isoDepth, goalTopActualY - isoDepth*0.5);
    pixelCtx.lineTo(leftGoalMouthX + goalMouthPixelWidth + isoDepth, goalTopActualY - isoDepth*0.5);
    pixelCtx.lineTo(leftGoalMouthX + goalMouthPixelWidth, goalTopActualY);
    pixelCtx.closePath();
    pixelCtx.fill();


    pixelCtx.strokeStyle = netColor;
    const netTopFrontY = goalTopActualY + postPixelThickness;
    const netBottomFrontY = goalBaseY -1;
    const netFrontLeftX = leftGoalMouthX + postPixelThickness;
    const netFrontRightX = leftGoalMouthX + goalMouthPixelWidth - postPixelThickness;

    const netTopBackY = goalTopActualY - isoDepth * 0.5 + postPixelThickness;
    const netBottomBackY = goalBaseY - isoDepth * 0.5 -1;
    const netBackLeftX = leftGoalMouthX + isoDepth + postPixelThickness;
    const netBackRightX = leftGoalMouthX + goalMouthPixelWidth - postPixelThickness + isoDepth;

    for (let i = 0; i <= 4; i++) {
        const tFront = i / 4;
        const yFrontLine = netTopFrontY + (netBottomFrontY - netTopFrontY) * tFront;
        pixelCtx.beginPath();
        pixelCtx.moveTo(netFrontLeftX, yFrontLine);
        pixelCtx.lineTo(netFrontRightX, yFrontLine);
        pixelCtx.stroke();

        const tBack = i / 4;
        const yBackLine = netTopBackY + (netBottomBackY - netTopBackY) * tBack;
        pixelCtx.beginPath();
        pixelCtx.moveTo(netBackLeftX, yBackLine);
        pixelCtx.lineTo(netBackRightX, yBackLine);
        pixelCtx.stroke();
    }

    for (let i = 0; i <= 6; i++) {
        const tFront = i / 6;
        const xFrontLine = netFrontLeftX + (netFrontRightX - netFrontLeftX) * tFront;
        pixelCtx.beginPath();
        pixelCtx.moveTo(xFrontLine, netTopFrontY);
        pixelCtx.lineTo(xFrontLine, netBottomFrontY);
        pixelCtx.stroke();

        const tBack = i / 6;
        const xBackLine = netBackLeftX + (netBackRightX - netBackLeftX) * tBack;
        pixelCtx.beginPath();
        pixelCtx.moveTo(xBackLine, netTopBackY);
        pixelCtx.lineTo(xBackLine, netBottomBackY);
        pixelCtx.stroke();

        pixelCtx.beginPath();
        pixelCtx.moveTo(xFrontLine, netTopFrontY);
        pixelCtx.lineTo(xBackLine, netTopBackY);
        pixelCtx.stroke();

        pixelCtx.beginPath();
        pixelCtx.moveTo(xFrontLine, netBottomFrontY);
        pixelCtx.lineTo(xBackLine, netBottomBackY);
        pixelCtx.stroke();
    }


    // Right Goal (3D isometric)
    const rightGoalMouthX = PIXEL_CANVAS_WIDTH - goalMouthPixelWidth - 10;
    
    // Goal post depth/shadow
    pixelCtx.fillStyle = shadeColor(goalPostColor, -0.3);
    pixelCtx.fillRect(rightGoalMouthX + isoDepth, goalTopActualY - isoDepth*0.5, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(rightGoalMouthX + goalMouthPixelWidth - postPixelThickness + isoDepth, goalTopActualY - isoDepth*0.5, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(rightGoalMouthX + isoDepth, goalTopActualY - isoDepth*0.5, goalMouthPixelWidth, postPixelThickness);

    // Main goal posts
    pixelCtx.fillStyle = goalPostColor;
    pixelCtx.fillRect(rightGoalMouthX, goalTopActualY, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(rightGoalMouthX + goalMouthPixelWidth - postPixelThickness, goalTopActualY, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(rightGoalMouthX, goalTopActualY, goalMouthPixelWidth, postPixelThickness);

    pixelCtx.fillStyle = shadeColor(goalPostColor, -0.1);
    pixelCtx.beginPath();
    pixelCtx.moveTo(rightGoalMouthX + postPixelThickness, goalTopActualY);
    pixelCtx.lineTo(rightGoalMouthX + postPixelThickness + isoDepth, goalTopActualY - isoDepth * 0.5);
    pixelCtx.lineTo(rightGoalMouthX + postPixelThickness + isoDepth, goalBaseY - isoDepth * 0.5);
    pixelCtx.lineTo(rightGoalMouthX + postPixelThickness, goalBaseY);
    pixelCtx.closePath();
    pixelCtx.fill();

    pixelCtx.beginPath();
    pixelCtx.moveTo(rightGoalMouthX + goalMouthPixelWidth - postPixelThickness, goalTopActualY);
    pixelCtx.lineTo(rightGoalMouthX + goalMouthPixelWidth - postPixelThickness + isoDepth, goalTopActualY - isoDepth * 0.5);
    pixelCtx.lineTo(rightGoalMouthX + goalMouthPixelWidth - postPixelThickness + isoDepth, goalBaseY - isoDepth*0.5);
    pixelCtx.lineTo(rightGoalMouthX + goalMouthPixelWidth - postPixelThickness, goalBaseY);
    pixelCtx.closePath();
    pixelCtx.fill();

    pixelCtx.beginPath();
    pixelCtx.moveTo(rightGoalMouthX, goalTopActualY);
    pixelCtx.lineTo(rightGoalMouthX + isoDepth, goalTopActualY - isoDepth*0.5);
    pixelCtx.lineTo(rightGoalMouthX + goalMouthPixelWidth + isoDepth, goalTopActualY - isoDepth*0.5);
    pixelCtx.lineTo(rightGoalMouthX + goalMouthPixelWidth, goalTopActualY);
    pixelCtx.closePath();
    pixelCtx.fill();

    pixelCtx.strokeStyle = netColor;
    const rgNetFrontLeftX = rightGoalMouthX + postPixelThickness;
    const rgNetFrontRightX = rightGoalMouthX + goalMouthPixelWidth - postPixelThickness;
    const rgNetBackLeftX = rightGoalMouthX + isoDepth + postPixelThickness;
    const rgNetBackRightX = rightGoalMouthX + goalMouthPixelWidth - postPixelThickness + isoDepth;

    for (let i = 0; i <= 4; i++) {
        const tFront = i / 4;
        const yFrontLine = netTopFrontY + (netBottomFrontY - netTopFrontY) * tFront;
        pixelCtx.beginPath();
        pixelCtx.moveTo(rgNetFrontLeftX, yFrontLine);
        pixelCtx.lineTo(rgNetFrontRightX, yFrontLine);
        pixelCtx.stroke();

        const tBack = i / 4;
        const yBackLine = netTopBackY + (netBottomBackY - netTopBackY) * tBack;
        pixelCtx.beginPath();
        pixelCtx.moveTo(rgNetBackLeftX, yBackLine);
        pixelCtx.lineTo(rgNetBackRightX, yBackLine);
        pixelCtx.stroke();
    }

    for (let i = 0; i <= 6; i++) {
        const tFront = i / 6;
        const xFrontLine = rgNetFrontLeftX + (rgNetFrontRightX - rgNetFrontLeftX) * tFront;
        pixelCtx.beginPath();
        pixelCtx.moveTo(xFrontLine, netTopFrontY);
        pixelCtx.lineTo(xFrontLine, netBottomFrontY);
        pixelCtx.stroke();

        const tBack = i / 6;
        const xBackLine = rgNetBackLeftX + (rgNetBackRightX - rgNetBackLeftX) * tBack;
        pixelCtx.beginPath();
        pixelCtx.moveTo(xBackLine, netTopBackY);
        pixelCtx.lineTo(xBackLine, netBottomBackY);
        pixelCtx.stroke();

        pixelCtx.beginPath();
        pixelCtx.moveTo(xFrontLine, netTopFrontY);
        pixelCtx.lineTo(xBackLine, netTopBackY);
        pixelCtx.stroke();

        pixelCtx.beginPath();
        pixelCtx.moveTo(xFrontLine, netBottomFrontY);
        pixelCtx.lineTo(xBackLine, netBottomBackY);
        pixelCtx.stroke();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setup();
    setupControlButtons();
});

function drawControlButtons() {
    const buttonSize = 40;
    const buttonY = PIXEL_CANVAS_HEIGHT - buttonSize - 10;
    const leftButtonX = 15;
    const rightButtonX = leftButtonX + buttonSize + 10;
    
    // Store button positions for click detection
    window.controlButtons = {
        left: { x: leftButtonX, y: buttonY, width: buttonSize, height: buttonSize },
        right: { x: rightButtonX, y: buttonY, width: buttonSize, height: buttonSize }
    };
    
    // Left button
    pixelCtx.fillStyle = keysPressed['KeyA'] ? '#45a049' : '#4CAF50';
    pixelCtx.fillRect(leftButtonX, buttonY, buttonSize, buttonSize);
    
    // Button border
    pixelCtx.strokeStyle = '#2e7d32';
    pixelCtx.lineWidth = 2;
    pixelCtx.strokeRect(leftButtonX, buttonY, buttonSize, buttonSize);
    
    // Left arrow
    pixelCtx.fillStyle = '#FFFFFF';
    const arrowSize = 12;
    const centerX = leftButtonX + buttonSize / 2;
    const centerY = buttonY + buttonSize / 2;
    
    // Draw left arrow
    pixelCtx.beginPath();
    pixelCtx.moveTo(centerX - arrowSize/2, centerY);
    pixelCtx.lineTo(centerX + arrowSize/2, centerY - arrowSize/2);
    pixelCtx.lineTo(centerX + arrowSize/2, centerY + arrowSize/2);
    pixelCtx.closePath();
    pixelCtx.fill();
    
    // Right button
    pixelCtx.fillStyle = keysPressed['KeyD'] ? '#45a049' : '#4CAF50';
    pixelCtx.fillRect(rightButtonX, buttonY, buttonSize, buttonSize);
    
    // Button border
    pixelCtx.strokeRect(rightButtonX, buttonY, buttonSize, buttonSize);
    
    // Right arrow
    const rightCenterX = rightButtonX + buttonSize / 2;
    const rightCenterY = buttonY + buttonSize / 2;
    
    pixelCtx.fillStyle = '#FFFFFF';
    pixelCtx.beginPath();
    pixelCtx.moveTo(rightCenterX + arrowSize/2, rightCenterY);
    pixelCtx.lineTo(rightCenterX - arrowSize/2, rightCenterY - arrowSize/2);
    pixelCtx.lineTo(rightCenterX - arrowSize/2, rightCenterY + arrowSize/2);
    pixelCtx.closePath();
    pixelCtx.fill();
}

function setupControlButtons() {
    const canvas = document.getElementById('gameCanvas');
    
    // Mouse events
    canvas.addEventListener('mousedown', handleCanvasClick);
    canvas.addEventListener('mouseup', handleCanvasRelease);
    canvas.addEventListener('mouseleave', handleCanvasRelease);
    
    // Touch events
    canvas.addEventListener('touchstart', handleCanvasTouch);
    canvas.addEventListener('touchend', handleCanvasRelease);
}

function handleCanvasClick(event) {
    const rect = event.target.getBoundingClientRect();
    const scaleX = PIXEL_CANVAS_WIDTH / rect.width;
    const scaleY = PIXEL_CANVAS_HEIGHT / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    if (window.controlButtons) {
        const { left, right } = window.controlButtons;
        
        if (x >= left.x && x <= left.x + left.width && y >= left.y && y <= left.y + left.height) {
            keysPressed['KeyA'] = true;
            createTone(300, 50, 'square', 0.1);
        }
        
        if (x >= right.x && x <= right.x + right.width && y >= right.y && y <= right.y + right.height) {
            keysPressed['KeyD'] = true;
            createTone(350, 50, 'square', 0.1);
        }
    }
}

function handleCanvasTouch(event) {
    event.preventDefault();
    const rect = event.target.getBoundingClientRect();
    const scaleX = PIXEL_CANVAS_WIDTH / rect.width;
    const scaleY = PIXEL_CANVAS_HEIGHT / rect.height;
    
    for (let touch of event.changedTouches) {
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;
        
        if (window.controlButtons) {
            const { left, right } = window.controlButtons;
            
            if (x >= left.x && x <= left.x + left.width && y >= left.y && y <= left.y + left.height) {
                keysPressed['KeyA'] = true;
                createTone(300, 50, 'square', 0.1);
            }
            
            if (x >= right.x && x <= right.x + right.width && y >= right.y && y <= right.y + right.height) {
                keysPressed['KeyD'] = true;
                createTone(350, 50, 'square', 0.1);
            }
        }
    }
}

function handleCanvasRelease() {
    keysPressed['KeyA'] = false;
    keysPressed['KeyD'] = false;
}

// --- Particle System ---
function spawnParticles(x, y, count, color, baseVelocityX = 0, baseVelocityY = 0, spread = 2, life = 20, size = 1) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x / PIXEL_SCALE,
            y: y / PIXEL_SCALE,
            vx: (Math.random() - 0.5) * spread + baseVelocityX,
            vy: (Math.random() - 0.5) * spread + baseVelocityY - Math.random() * (spread/2),
            life: life + Math.random() * (life * 0.5),
            color: color,
            size: Math.max(1, Math.round(size / PIXEL_SCALE)),
            drag: 0.02,
            gravity: 0.05
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vx *= (1 - p.drag);
        p.vy *= (1 - p.drag);
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}
