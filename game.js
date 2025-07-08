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

// Moved activeTeam1Color and activeTeam2Color initialization after colorPalettes definition

let engine;
let world;
let runner;
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
// Initialize active team colors AFTER colorPalettes is defined
let activeTeam1Color = colorPalettes[0].team1;
let activeTeam2Color = colorPalettes[0].team2;
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
    console.log("SETUP: Initializing game state...");
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
    // initSpectators(); // Removed spectators
    initStadiumLights();

    if (roundTimerId) {
        clearInterval(roundTimerId);
        roundTimerId = null;
    }

    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    activeTheme = themes[currentThemeIndex];

    currentColorPaletteIndex = (currentColorPaletteIndex + 1) % colorPalettes.length;
    const currentPalette = colorPalettes[currentColorPaletteIndex];
    activeTeam1Color = currentPalette.team1; // به‌روزرسانی متغیر گلوبال
    activeTeam2Color = currentPalette.team2; // به‌روزرسانی متغیر گلوبال

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

    engine = Engine.create({ enableSleeping: false }); // Explicitly set enableSleeping
    world = engine.world;
    engine.world.gravity.y = 1.1;

    // Adjust collision handling parameters
    world.slop = 0.08; // Default is 0.05. Slightly more slop can prevent sticking.
    engine.positionIterations = 8; // Default is 6. More iterations for position correction.
    engine.velocityIterations = 6; // Default is 4. More iterations for velocity correction.
    console.log("SETUP: New engine and world created with custom collision settings (slop, iterations).");


    // --- Test objects for collision ---
    const testBoxA = Bodies.rectangle(CANVAS_WIDTH / 2 - 100, CANVAS_HEIGHT / 2 - 100, 40, 40, { label: "testBoxA", render: {fillStyle: 'orange'} });
    const testBoxB = Bodies.rectangle(CANVAS_WIDTH / 2 + 100, CANVAS_HEIGHT / 2 - 100, 40, 40, { label: "testBoxB", render: {fillStyle: 'purple'} });
    World.add(world, [testBoxA, testBoxB]);
    Body.setVelocity(testBoxA, { x: 10, y: 0 }); // Give testBoxA some velocity to ensure collision with testBoxB
    Body.setVelocity(testBoxB, { x: -10, y: 0 }); // Give testBoxB some velocity
    console.log("SETUP: Added test boxes A and B.");
    // --- End of Test objects ---

    render = Render.create({
        canvas: canvas,
        engine: engine,
        options: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, wireframes: false, background: activeTheme.background, enabled: false }
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
    pixelCtx.imageSmoothingEnabled = false;

    createField();
    createBall();

    players = [];
    const playerSpawnY = CANVAS_HEIGHT - GROUND_THICKNESS - PLAYER_RECT_SIZE / 2 - 5;
    players.push(createPlayer(CANVAS_WIDTH / 4, playerSpawnY, activeTeam1Color, true, false));
    players.push(createPlayer(CANVAS_WIDTH * 3 / 4, playerSpawnY, activeTeam2Color, false, true));
    
    setupInputListeners();

    runner = Runner.create();
    console.log("SETUP: New runner created.");

    Events.on(engine, 'beforeUpdate', updateGame);
    Events.on(engine, 'collisionStart', handleCollisions); // Restored
    // Events.on(engine, 'collisionStart', function(event) { // This line is now commented out/removed
    //     console.log('Collision event directly from engine:', event.pairs.length, 'pairs collided at time:', engine.timing.timestamp);
    // });

    // Start the game immediately
    isGameStarted = true;
    isGameOver = false;

    // throw new Error("DEBUG: Attempting to run original Runner.run! This line should have been replaced or commented out."); // Removed debug error
    Runner.run(runner, engine); // Restored
    console.log("SETUP: Matter.js Runner started immediately."); // Restored

    // // --- Manual Engine Update Loop (Keep commented unless specifically needed) ---
    // console.log("SETUP: Starting manual engine update loop.");
    // let lastTime = performance.now();
    // setInterval(function() {
    //     const currentTime = performance.now();
    //     const deltaTime = currentTime - lastTime;
    //     lastTime = currentTime;
    //
    //     Engine.update(engine, deltaTime);
    // }, 1000 / 60); // حدود 60 فریم بر ثانیه
    // --- End of Manual Engine Update Loop ---

    startGameTimer();

    if (typeof gameRenderLoopId !== 'undefined') {
        cancelAnimationFrame(gameRenderLoopId);
    }
    gameRenderLoopId = requestAnimationFrame(gameRenderLoop);
    console.log("SETUP: Started new gameRenderLoopId:", gameRenderLoopId);

    updateScoreDisplay();
    updateTimerDisplay();
    showGameMessage("Game Started! Controls: A/D Move, W Jump");
    
    console.log("SETUP: Game started immediately!");
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
    const chamferOptions = { chamfer: { radius: 5 } }; // آپشن chamfer برای دیوار و زمین

    const ground = Bodies.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT - GROUND_THICKNESS / 2, CANVAS_WIDTH, GROUND_THICKNESS, {
        isStatic: true,
        label: 'ground',
        render: { fillStyle: activeTheme.ground },
        ...chamferOptions // افزودن chamfer
    });
    const leftWall = Bodies.rectangle(WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, {
        isStatic: true,
        label: 'wall-left',
        render: { fillStyle: activeTheme.walls },
        ...chamferOptions // افزودن chamfer
    });
    const rightWall = Bodies.rectangle(CANVAS_WIDTH - WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, {
        isStatic: true,
        label: 'wall-right',
        render: { fillStyle: activeTheme.walls },
        ...chamferOptions // افزودن chamfer
    });
    const ceiling = Bodies.rectangle(CANVAS_WIDTH / 2, WALL_THICKNESS / 2, CANVAS_WIDTH, WALL_THICKNESS, {
        isStatic: true,
        label: 'ceiling',
        render: { fillStyle: activeTheme.walls },
        ...chamferOptions // افزودن chamfer
    });

    const { actualGoalOpeningHeight: localActualGoalOpeningHeight } = getFieldDerivedConstants();
    const goalSensorY = CANVAS_HEIGHT - GROUND_THICKNESS - localActualGoalOpeningHeight / 2;

    const goalSensorRenderInvisible = { visible: true, fillStyle: 'rgba(255, 0, 255, 0.5)' }; // Made visible for debugging
    const leftGoalSensor = Bodies.rectangle(WALL_THICKNESS + GOAL_SENSOR_DEPTH / 2, goalSensorY, GOAL_SENSOR_DEPTH, localActualGoalOpeningHeight, { isStatic: true, isSensor: true, label: 'goal-left', render: goalSensorRenderInvisible });
    const rightGoalSensor = Bodies.rectangle(CANVAS_WIDTH - WALL_THICKNESS - GOAL_SENSOR_DEPTH / 2, goalSensorY, GOAL_SENSOR_DEPTH, localActualGoalOpeningHeight, { isStatic: true, isSensor: true, label: 'goal-right', render: goalSensorRenderInvisible });

    const goalPostRenderStyle = { fillStyle: '#FFFFFF' };
    const crossbarY = CANVAS_HEIGHT - GROUND_THICKNESS - GOAL_HEIGHT + CROSSBAR_THICKNESS / 2;
    const leftCrossbar = Bodies.rectangle(WALL_THICKNESS + GOAL_MOUTH_VISUAL_WIDTH / 2, crossbarY, GOAL_MOUTH_VISUAL_WIDTH, CROSSBAR_THICKNESS, { isStatic: true, label: 'crossbar-left', render: goalPostRenderStyle });
    const rightCrossbar = Bodies.rectangle(CANVAS_WIDTH - WALL_THICKNESS - GOAL_MOUTH_VISUAL_WIDTH / 2, crossbarY, GOAL_MOUTH_VISUAL_WIDTH, CROSSBAR_THICKNESS, { isStatic: true, label: 'crossbar-right', render: goalPostRenderStyle });
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
    updateSpectators();
    
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

        // --- Enhanced Square Rolling and Stability Logic ---
        const MAX_ROTATION_ANGLE = Math.PI / 6; // حداکثر 30 درجه چرخش از حالت عمود
        const SNAP_TO_ANGLE_THRESHOLD = 0.02; // (حدود 1 درجه)
        const RESTORING_TORQUE_FACTOR = 0.005; // قدرت بازگرداندن به زاویه صفر

        if (player.isRotating) { // بازیکن در حال حرکت با کلیدها
            console.log(`UPS: Player ${player.playerTeam} isRotating. Vel: ${player.playerBody.angularVelocity.toFixed(3)}, Angle: ${player.playerBody.angle.toFixed(3)}, Target: ${player.targetAngle.toFixed(3)}, RollDir: ${player.rollDirection}`); // DEBUG LOG
            const currentAngle = player.playerBody.angle;
            const targetAngleDuringRoll = player.targetAngle;
            const angularSpeed = player.rollDirection * PLAYER_ROLL_ANGULAR_VELOCITY_TARGET;

            // Body.setAngularVelocity(player.playerBody, angularSpeed); // موقتا غیرفعال شود تا ببینیم آیا translate کار می‌کند

            if (player.isGrounded) {
                const rollSpeed = Math.abs(angularSpeed) * (PLAYER_RECT_SIZE / 2); // این هنوز به angularSpeed نیاز دارد
                // برای تست، یک سرعت ثابت برای translate در نظر بگیریم:
                const testTranslateSpeed = player.rollDirection * PLAYER_ROLL_TRANSLATE_SPEED * 2; // سرعت تست بیشتر
                Body.translate(player.playerBody, { x: testTranslateSpeed, y: 0 });
                console.log(`UPS: Translating player ${player.playerTeam} by x: ${testTranslateSpeed}`); // DEBUG LOG
            }

            let overShot = false;
            // ... (منطق overShot بدون تغییر) ...
            if (player.rollDirection === 1 && currentAngle >= targetAngleDuringRoll - SNAP_TO_ANGLE_THRESHOLD) {
                overShot = true;
            } else if (player.rollDirection === -1 && currentAngle <= targetAngleDuringRoll + SNAP_TO_ANGLE_THRESHOLD) {
                overShot = true;
            }


            if (overShot) {
                console.log(`UPS: Player ${player.playerTeam} overShot. Setting angle to ${targetAngleDuringRoll}`); // DEBUG LOG
                Body.setAngle(player.playerBody, targetAngleDuringRoll);
                Body.setAngularVelocity(player.playerBody, 0); // سرعت زاویه‌ای را صفر کن
                player.isRotating = false;
                player.rollDirection = 0; // مهم: rollDirection را صفر کن
                player.currentFace = (Math.round(targetAngleDuringRoll / (Math.PI / 2)) % 4 + 4) % 4;
                player.targetAngle = 0;
            }
        } else {
            // ... (منطق بازگشت به حالت عمود که قبلا اصلاح شد) ...
            const currentAngle = player.playerBody.angle;
            const desiredAngle = 0; // هدف: بازگشت به عمود

            // فقط اگر بازیکن روی زمین است و هیچ کلید حرکتی فشار داده نشده (برای بازیکن انسان)
            // و بازیکن در حال حاضر برای حرکتی برنامه‌ریزی نشده (rollDirection === 0)
            // یا اگر بازیکن AI است و برای حرکتی برنامه‌ریزی نشده
            let shouldSnapToVertical = false;
            if (!player.isAI && player.isGrounded && !keysPressed['KeyA'] && !keysPressed['KeyD'] && player.rollDirection === 0) {
                shouldSnapToVertical = true;
            } else if (player.isAI && player.isGrounded && player.rollDirection === 0 && !player.isRotating) {
                // برای AI، فقط اگر isRotating هم false باشد (یعنی AI هم فعلا قصد چرخش ندارد)
                shouldSnapToVertical = true;
            }

            if (shouldSnapToVertical) {
                const angleDifference = desiredAngle - currentAngle;
                if (Math.abs(angleDifference) > SNAP_TO_ANGLE_THRESHOLD) {
                    // کاهش سرعت زاویه‌ای فعلی برای جلوگیری از چرخش بیش از حد
                    Body.setAngularVelocity(player.playerBody, player.playerBody.angularVelocity * 0.80);

                    // اعمال یک گشتاور کوچک برای بازگشت به desiredAngle
                    // این روش اعمال نیرو برای گشتاور ممکن است نیاز به تنظیم دقیق داشته باشد
                    // یا می‌توان از Body.setAngularVelocity با یک مقدار کوچک به سمت desiredAngle استفاده کرد.
                    // برای سادگی فعلاً از یک snap نرم‌تر استفاده می‌کنیم:
                    if (Math.abs(player.playerBody.angularVelocity) < 0.05) { // اگر به اندازه کافی کند شده
                         Body.setAngle(player.playerBody, currentAngle + angleDifference * 0.1); // حرکت آرام به سمت زاویه هدف
                    }
                } else {
                    Body.setAngle(player.playerBody, desiredAngle);
                    Body.setAngularVelocity(player.playerBody, 0);
                }
                player.targetAngle = desiredAngle;
                if (Math.abs(currentAngle - desiredAngle) < SNAP_TO_ANGLE_THRESHOLD) {
                     player.currentFace = 0;
                }
            }

            // محدود کردن زاویه کلی بازیکن برای جلوگیری از چپه شدن (این بخش خوب به نظر می‌رسد)
            if (player.playerBody.angle > MAX_ROTATION_ANGLE && player.playerBody.angularVelocity > 0) {
                 Body.setAngularVelocity(player.playerBody, player.playerBody.angularVelocity * 0.5);
            } else if (player.playerBody.angle < -MAX_ROTATION_ANGLE && player.playerBody.angularVelocity < 0) {
                 Body.setAngularVelocity(player.playerBody, player.playerBody.angularVelocity * 0.5);
            }
        }
        // --- End of Enhanced Square Rolling and Stability Logic ---
    });
}


function handleHumanPlayerControls() {
    const player = players[0];
    if (!player || player.isAI) return;

    console.log(`HPC: Keys A: ${keysPressed['KeyA']}, D: ${keysPressed['KeyD']}, Grounded: ${player.isGrounded}, Rotating: ${player.isRotating}`); // DEBUG LOG

    if (player.jumpCooldown > 0) player.jumpCooldown--;

    if (!player.isRotating && player.isGrounded) {
        let roll = 0;
        if (keysPressed['KeyA']) {
            roll = -1;
        } else if (keysPressed['KeyD']) {
            roll = 1;
        }
        console.log(`HPC: Calculated roll: ${roll}`); // DEBUG LOG

        if (roll !== 0) {
            player.isRotating = true;
            player.rollDirection = roll;
            const snappedCurrentAngle = Math.round(player.playerBody.angle / (Math.PI / 2)) * (Math.PI / 2);
            player.targetAngle = snappedCurrentAngle + roll * (Math.PI / 2);
            Body.setAngularVelocity(player.playerBody, player.rollDirection * PLAYER_ROLL_ANGULAR_VELOCITY_TARGET);
            console.log(`HPC: Initiating roll. Direction: ${player.rollDirection}, TargetAngle: ${player.targetAngle}, AngularVel: ${player.rollDirection * PLAYER_ROLL_ANGULAR_VELOCITY_TARGET}`); // DEBUG LOG
        }
    }

    const canStartNewJumpAttempt = (player.isGrounded || player.coyoteTimeFramesRemaining > 0);
    const commonJumpConditionsMet = player.jumpCooldown === 0;

    if (keysPressed['KeyW'] && commonJumpConditionsMet) {
        if (!player.isAttemptingVariableJump && canStartNewJumpAttempt && !player.isRotating) {
            player.isGrounded = false;
            player.coyoteTimeFramesRemaining = 0;
            player.jumpInputBuffered = false;
            player.isAttemptingVariableJump = true;
            player.variableJumpForceAppliedDuration = 0;
            player.totalJumpImpulseThisJump = PLAYER_VARIABLE_JUMP_INITIAL_FORCE;

            Body.applyForce(player.playerBody, player.playerBody.position, { x: 0, y: -PLAYER_VARIABLE_JUMP_INITIAL_FORCE });

            player.jumpCooldown = PLAYER_JUMP_COOLDOWN_FRAMES;
            player.lastJumpTime = Date.now();
            playSound('jump.wav');

        } else if (player.isAttemptingVariableJump) {
            if (player.variableJumpForceAppliedDuration < PLAYER_VARIABLE_JUMP_MAX_HOLD_FRAMES &&
                player.totalJumpImpulseThisJump < PLAYER_MAX_JUMP_IMPULSE) {

                let forceToApply = PLAYER_VARIABLE_JUMP_SUSTAINED_FORCE;
                if (player.totalJumpImpulseThisJump + forceToApply > PLAYER_MAX_JUMP_IMPULSE) {
                    forceToApply = PLAYER_MAX_JUMP_IMPULSE - player.totalJumpImpulseThisJump;
                }

                if (forceToApply > 0) {
                    Body.applyForce(player.playerBody, player.playerBody.position, { x: 0, y: -forceToApply });
                    player.totalJumpImpulseThisJump += forceToApply;
                }
                player.variableJumpForceAppliedDuration++;
            } else {
                player.isAttemptingVariableJump = false;
            }
        }
    }

    if (player.jumpInputBuffered && player.isGrounded && commonJumpConditionsMet && !player.isAttemptingVariableJump && !player.isRotating) {
        player.isGrounded = false;
        player.coyoteTimeFramesRemaining = 0;
        player.jumpInputBuffered = false;
        player.isAttemptingVariableJump = true;
        player.variableJumpForceAppliedDuration = 0;
        player.totalJumpImpulseThisJump = PLAYER_VARIABLE_JUMP_INITIAL_FORCE;

        Body.applyForce(player.playerBody, player.playerBody.position, { x: 0, y: -PLAYER_VARIABLE_JUMP_INITIAL_FORCE });

        player.jumpCooldown = PLAYER_JUMP_COOLDOWN_FRAMES;
        player.lastJumpTime = Date.now();
        playSound('jump.wav');
    }

    if (player.jumpInputBuffered && (!player.isGrounded || player.isAttemptingVariableJump || !commonJumpConditionsMet) ) {
         player.jumpInputBuffered = false;
    }
}


function updateAIPlayers() {
    players.forEach((player) => {
        if (player.isAI) {
            if (player.actionCooldown > 0) player.actionCooldown--;
            if (player.jumpCooldown > 0) player.jumpCooldown--;

            executeAIPlayerLogic(player);
        }
    });
}

function executeAIPlayerLogic(player) {
    if (!ball) return;

    const ballPos = ball.position;
    const playerPos = player.playerBody.position;
    const distanceToBall = Matter.Vector.magnitude(Matter.Vector.sub(ballPos, playerPos));
    let AImoveDirection = 0; // -1 for left, 1 for right, 0 for no move

    const aiGoalX = CANVAS_WIDTH - WALL_THICKNESS; // AI's own goal (right)
    const opponentGoalX = WALL_THICKNESS; // Player's goal (left) - AI should attack this
    const { actualGoalOpeningHeight } = getFieldDerivedConstants();
    const ownGoalCenterY = CANVAS_HEIGHT - GROUND_THICKNESS - actualGoalOpeningHeight / 2;

    const isBallInAIHalf = ballPos.x > CANVAS_WIDTH / 2;
    const isBallNearAIGoal = ballPos.x > CANVAS_WIDTH * 0.75; // Increased sensitivity
    const isBallMovingTowardsAIGoal = ball.velocity.x > 0.5; // Added threshold

    // Consider game state for decision making
    const isAIAhead = team2Score > team1Score;
    const isGameNearEnd = gameTimeRemaining < 30; // Example: last 30 seconds

    let intent = 'pursue_ball';

    // --- BEGIN Enhanced Decision Making ---
    const dangerOfOwnGoal = isBallNearAIGoal &&
                           Math.abs(ballPos.y - ownGoalCenterY) < actualGoalOpeningHeight / 1.5 &&
                           Math.abs(playerPos.x - ballPos.x) < PLAYER_RECT_SIZE &&
                           playerPos.x > ballPos.x; // Player is between ball and opponent goal

    if (dangerOfOwnGoal) {
        intent = 'clear_ball_safely';
    } else if (isBallNearAIGoal && isBallMovingTowardsAIGoal) {
        intent = 'emergency_defense';
    } else if (isBallInAIHalf && distanceToBall > AI_ACTION_RANGE * 1.2 && ballPos.x > CANVAS_WIDTH * 0.65) {
        intent = 'defend_goal_line';
    } else if (isBallInAIHalf && distanceToBall > AI_ACTION_RANGE) {
        intent = 'defensive_positioning';
    } else if (!isBallInAIHalf && playerPos.x > CANVAS_WIDTH * 0.6 && (!isAIAhead || !isGameNearEnd)) {
        // Less aggressive advancement if ahead and game is ending
        intent = 'advance_to_attack';
    } else if (isAIAhead && isGameNearEnd && isBallInAIHalf) {
        intent = 'hold_position_defensive'; // Play safer if ahead and game ending
    }


    switch (intent) {
        case 'clear_ball_safely':
            // Aim to clear the ball towards sidelines or less dangerous areas
            if (ballPos.x > playerPos.x) { // Ball is to the right of AI (towards own goal)
                AImoveDirection = -1; // Move left to get behind ball
            } else {
                AImoveDirection = 1; // Move right to push ball away
            }
            // Add logic for vertical positioning if needed
            break;
        case 'emergency_defense':
            const emergencyDefenseX = aiGoalX - GOAL_MOUTH_VISUAL_WIDTH * 1.2;
            const directionToEmergencyPos = emergencyDefenseX - playerPos.x;
            if (Math.abs(directionToEmergencyPos) > PLAYER_RECT_SIZE / 3) { // More reactive
                AImoveDirection = Math.sign(directionToEmergencyPos);
            }
            break;
        case 'defend_goal_line':
            const defensiveTargetXGoalLine = aiGoalX - GOAL_MOUTH_VISUAL_WIDTH * 1.0;
            const directionToTargetXGoalLine = defensiveTargetXGoalLine - playerPos.x;
            if (Math.abs(directionToTargetXGoalLine) > PLAYER_RECT_SIZE / 2) {
                AImoveDirection = Math.sign(directionToTargetXGoalLine);
            }
            break;
        case 'defensive_positioning':
            const idealDefensiveX = Math.min(ballPos.x + 60, aiGoalX - GOAL_MOUTH_VISUAL_WIDTH * 1.5); // Increased follow distance
            const finalDefensiveTargetX = Math.max(CANVAS_WIDTH / 2 + WALL_THICKNESS, Math.min(aiGoalX - WALL_THICKNESS - PLAYER_RECT_SIZE, idealDefensiveX));
            const dirToDefTarget = finalDefensiveTargetX - playerPos.x;
            if (Math.abs(dirToDefTarget) > PLAYER_RECT_SIZE / 2) {
                AImoveDirection = Math.sign(dirToDefTarget);
            }
            break;
        case 'advance_to_attack':
            const offensiveMidfieldTargetX = CANVAS_WIDTH * 0.3 + (Math.random() - 0.5) * (CANVAS_WIDTH * 0.1);
            const dirToAdvanceTarget = offensiveMidfieldTargetX - playerPos.x;
            if (Math.abs(dirToAdvanceTarget) > PLAYER_RECT_SIZE) {
                AImoveDirection = Math.sign(dirToAdvanceTarget);
            }
            break;
        case 'hold_position_defensive':
            // Stay in own half, perhaps try to keep ball away from player
            const safeDefensiveX = CANVAS_WIDTH * 0.6 + (Math.random() * CANVAS_WIDTH * 0.1);
            const dirToSafePos = safeDefensiveX - playerPos.x;
             if (Math.abs(dirToSafePos) > PLAYER_RECT_SIZE) {
                AImoveDirection = Math.sign(dirToSafePos);
            }
            break;
        case 'pursue_ball':
        default:
            const dirToBallX = ballPos.x - playerPos.x;
            if (Math.abs(dirToBallX) > BALL_RADIUS + PLAYER_RECT_SIZE / 2 * 0.3 ) { // Closer pursuit
                AImoveDirection = Math.sign(dirToBallX);
            }
            break;
    }
    // --- END Enhanced Decision Making ---

    if (AImoveDirection !== 0 && !player.isRotating && player.isGrounded) {
        player.isRotating = true;
        player.rollDirection = AImoveDirection;
        const currentAngle = player.playerBody.angle;
        const snappedCurrentAngle = Math.round(currentAngle / (Math.PI / 2)) * (Math.PI / 2);
        player.targetAngle = snappedCurrentAngle + player.rollDirection * (Math.PI / 2);
        Body.setAngularVelocity(player.playerBody, player.rollDirection * PLAYER_ROLL_ANGULAR_VELOCITY_TARGET);
    }

    // --- AI Jump and Kick Logic ---
    if (player.jumpCooldown === 0 && distanceToBall < AI_ACTION_RANGE * 1.3 && !player.isRotating) { // Increased range for jump consideration
        const ballIsHigh = ballPos.y < playerPos.y - PLAYER_RECT_SIZE / 2 * 0.6;
        const ballIsLowAndNear = ballPos.y > playerPos.y + PLAYER_RECT_SIZE / 2 * 0.3 && distanceToBall < AI_KICK_BALL_RANGE * 0.8;
        let shouldJump = ballIsHigh ||
                         (distanceToBall < AI_KICK_BALL_RANGE * 0.7 && Math.abs(ballPos.y - playerPos.y) < PLAYER_RECT_SIZE) ||
                         intent === 'emergency_defense' ||
                         intent === 'defend_goal_line' ||
                         intent === 'clear_ball_safely';

        // More aggressive jumping if behind or game is not ending
        if (!isAIAhead && !isGameNearEnd && distanceToBall < AI_ACTION_RANGE) {
            shouldJump = shouldJump || Math.random() < 0.1; // Random jump chance when attacking
        }

        if (shouldJump && player.isGrounded) {
            player.isGrounded = false;
            player.jumpCooldown = PLAYER_JUMP_COOLDOWN_FRAMES * (1.0 + Math.random() * 0.3); // Slightly reduced cooldown variation
            player.lastJumpTime = Date.now();
            playSound('jump.wav');

            let horizontalActionForceDirection = 0;

            if (intent === 'emergency_defense' || intent === 'defend_goal_line' || intent === 'clear_ball_safely') {
                // When defending, jump towards the ball to clear it away from goal
                // Ensure the jump doesn't push the ball into own goal
                if (ballPos.x > playerPos.x && playerPos.x < aiGoalX - PLAYER_RECT_SIZE) { // AI is to the left of ball
                    horizontalActionForceDirection = 0.002 + Math.random() * 0.002; // Push right
                } else if (ballPos.x < playerPos.x && playerPos.x > opponentGoalX + PLAYER_RECT_SIZE) { // AI is to the right of ball
                    horizontalActionForceDirection = -0.002 - Math.random() * 0.002; // Push left
                }
            } else {
                // When attacking, move towards opponent goal
                 if (playerPos.x > opponentGoalX + PLAYER_RECT_SIZE * 2) { // If far from opponent goal, move towards it
                    horizontalActionForceDirection = -0.0015 - Math.random() * 0.001;
                } else if (playerPos.x < opponentGoalX + PLAYER_RECT_SIZE) { // If too close or behind opponent goal line (unlikely)
                     horizontalActionForceDirection = 0.001 + Math.random() * 0.001;
                }
            }

            const jumpStrengthFactor = (intent === 'emergency_defense' || intent === 'clear_ball_safely') ? 1.25 : 0.9;
            const verticalJumpForce = -PLAYER_MAX_JUMP_IMPULSE * jumpStrengthFactor * (0.7 + Math.random() * 0.35);
            Body.applyForce(player.playerBody, playerPos, { x: horizontalActionForceDirection, y: verticalJumpForce });
        }
    }
}

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
    playSound('goal.wav');
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

        showGameMessage(`${reason} Final Score: ${team1Score}-${team2Score}. Press '${restartKey}' to return to menu.`);
        if (runner) Runner.stop(runner);
        if (roundTimerId) {
            clearInterval(roundTimerId);
            roundTimerId = null;
        }
        
        // Auto return to menu after 5 seconds
        setTimeout(() => {
            if (gameState === 'gameOver') {
                gameState = 'menu';
                isGameOver = false;
                isGameStarted = false;
                showGameMessage('');
            }
        }, 5000);
        
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
    console.log('handleCollisions function was called at time:', engine.timing.timestamp); // لاگ جدید برای تست فراخوانی تابع
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
                const kickOrigin = playerPhysicsBodyCollided.position;
                
                if (playerCollidedObject.isAI) {
                    const ballToOwnGoalVector = Matter.Vector.sub({x: ownGoalX, y: goalCenterY}, ballBody.position);
                    const playerToBallVector = Matter.Vector.sub(ballBody.position, playerPhysicsBodyCollided.position);

                    // Check if kicking directly towards own goal
                    const kickTowardsOwnGoalAngleThreshold = Math.PI / 2.5; // Generous angle to avoid own goal
                    const angleToOwnGoal = Matter.Vector.angle(playerToBallVector, ballToOwnGoalVector);

                    let isOwnGoalRisk = false;
                    if (playerPhysicsBodyCollided.position.x > ballBody.position.x && // Player is to the right of the ball
                        ownGoalX > playerPhysicsBodyCollided.position.x && // Own goal is to the right of player
                        Math.abs(angleToOwnGoal) > Math.PI - kickTowardsOwnGoalAngleThreshold // Kicking towards general direction of own goal
                    ) {
                        isOwnGoalRisk = true;
                    } else if (playerPhysicsBodyCollided.position.x < ballBody.position.x && // Player is to the left of the ball
                               ownGoalX < playerPhysicsBodyCollided.position.x && // Own goal is to the left of player (should not happen for AI team 2)
                               Math.abs(angleToOwnGoal) < kickTowardsOwnGoalAngleThreshold
                    ) {
                         // This case is for AI team 1 if it were implemented, or if AI is on left side.
                         // For current AI (Team 2, right goal), this part of condition is less relevant
                         // but good to have for robustness.
                        isOwnGoalRisk = true;
                    }


                    if (isOwnGoalRisk && Math.abs(ballBody.position.x - ownGoalX) < CANVAS_WIDTH / 3) {
                        // HIGH RISK of own goal - clear the ball safely
                        // Kick upwards and towards the center or opponent's side
                        kickTargetPos.x = CANVAS_WIDTH / 2 + (Math.random() - 0.5) * (CANVAS_WIDTH * 0.2); // Kick towards center/opponent side
                        kickTargetPos.y = goalCenterY - actualGoalOpeningHeight * (0.5 + Math.random() * 0.5); // Kick high
                        kickForce *= 0.8; // Slightly less force for a clearance
                    } else {
                        // Standard AI kick logic (aim for opponent goal)
                        const ballToOpponentGoal = Math.abs(ballBody.position.x - opponentGoalX);
                        // If ball is very close to own goal, prioritize clearing it further
                        if (Math.abs(ballBody.position.x - ownGoalX) < PLAYER_RECT_SIZE * 2) {
                             kickTargetPos.x = opponentGoalX;
                             kickTargetPos.y = goalCenterY - actualGoalOpeningHeight * (0.2 + Math.random() * 0.3); // Higher loft
                        } else {
                            kickTargetPos.x = opponentGoalX;
                            kickTargetPos.y = goalCenterY + (Math.random() - 0.8) * actualGoalOpeningHeight * 0.7; // More variation, aim slightly lower on average
                        }
                    }

                    // The rest of the kick vector calculation remains similar
                    let kickVector = Matter.Vector.sub(kickTargetPos, kickOrigin);
                    kickVector = Matter.Vector.normalise(kickVector);

                    // Ensure kick direction is generally correct, especially after own-goal avoidance
                    const expectedDirectionTowardsOpponentGoal = Math.sign(opponentGoalX - kickOrigin.x);
                    if (isOwnGoalRisk) {
                        // If clearing, ensure clearance is away from own goal
                        if (kickOrigin.x < CANVAS_WIDTH / 2) { // If AI is on left half (e.g. after crossing over)
                            if (kickVector.x < 0.1) kickVector.x = 0.1 + Math.random() * 0.2; // Ensure positive x (rightward)
                        } else { // AI on right half
                            if (kickVector.x > -0.1) kickVector.x = -0.1 - Math.random() * 0.2; // Ensure negative x (leftward)
                        }
                        kickVector.y = -Math.abs(kickVector.y * (1.5 + Math.random())); // Ensure strong upward component for clearance
                        kickVector = Matter.Vector.normalise(kickVector);
                    } else if (Math.sign(kickVector.x) !== expectedDirectionTowardsOpponentGoal && expectedDirectionTowardsOpponentGoal !== 0) {
                        // If not an own goal risk, but kick vector is still weirdly pointed, try to correct
                        kickVector.x = expectedDirectionTowardsOpponentGoal * Math.abs(kickVector.x);
                        if (Math.abs(kickVector.x) < 0.2) { // Ensure some horizontal component
                             kickVector.x = expectedDirectionTowardsOpponentGoal * 0.2;
                        }
                        kickVector = Matter.Vector.normalise(kickVector);
                    }


                    const baseKickXSign = Math.sign(kickVector.x);
                    // Adjust kickAngleFactorY based on situation
                    if (isOwnGoalRisk) {
                        kickAngleFactorY = -1.5 - Math.random() * 0.5; // Stronger upward kick for clearance
                    } else if (isTimedShot){
                        kickAngleFactorY = -0.6 * JUMP_SHOT_LOFT_FACTOR;
                    } else {
                        kickAngleFactorY = -0.5 - Math.random() * 0.3; // General shots
                    }

                    kickVector.y = Math.min(kickAngleFactorY, kickVector.y * Math.sign(kickAngleFactorY));
                    // Removed the fixed x component setting to allow more natural kick angles based on target
                    kickVector = Matter.Vector.normalise(kickVector);

                    playSound('kick.wav');
                    Body.applyForce(ballBody, ballBody.position, { x: kickVector.x * kickForce, y: kickVector.y * kickForce });

                } else { // Human player collision with ball
                    // Human player - normal targeting
                    if(isTimedShot){
                         kickTargetPos.y = goalCenterY - (actualGoalOpeningHeight * 0.05) + (Math.random() * actualGoalOpeningHeight * 0.1);
                    } else {
                         kickTargetPos.y = goalCenterY - (actualGoalOpeningHeight * 0.25) + (Math.random() * actualGoalOpeningHeight * 0.5);
                    }

                    let kickVector = Matter.Vector.sub(kickTargetPos, kickOrigin);
                    kickVector = Matter.Vector.normalise(kickVector);

                    const baseKickXSign = Math.sign(kickVector.x);
                    kickVector.y = Math.min(kickAngleFactorY, kickVector.y * Math.sign(kickAngleFactorY));
                    kickVector.x = baseKickXSign * (isTimedShot ? (0.8 + Math.random()*0.2) : (0.4 + Math.random()*0.4) );
                    kickVector = Matter.Vector.normalise(kickVector);

                    playSound('kick.wav');
                    Body.applyForce(ballBody, ballBody.position, { x: kickVector.x * kickForce, y: kickVector.y * kickForce });
                }

            } else if (otherBody) {
                    console.log('Ball collided with:', otherBody.label, 'at time:', engine.timing.timestamp); // لاگ جدید
                if (isGameStarted && !isGameOver) {
                    if (otherBody.label === 'goal-left') handleGoalScored(2);
                    else if (otherBody.label === 'goal-right') handleGoalScored(1);
                }
                if (otherBody.label.includes('wall') || otherBody.label.includes('ceiling') || otherBody.label.includes('crossbar')) {
                    if (Matter.Vector.magnitude(ballBody.velocity) > 1.5) {
                        playSound('ball_hit_wall.wav');
                        let particleColor = '#DDDDDD';
                        if (otherBody.label.includes('crossbar')) particleColor = '#EEEEEE';
                        const collisionPoint = pair.collision.supports && pair.collision.supports.length > 0 ? pair.collision.supports[0] : ballBody.position;
                        const collisionNormal = pair.collision.normal;
                        const particleBaseVelX = collisionNormal.x * 0.5;
                        const particleBaseVelY = collisionNormal.y * 0.5;
                        spawnParticles(collisionPoint.x, collisionPoint.y, 4, particleColor, particleBaseVelX, particleBaseVelY, 1.5, 15, 1);
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
    // Always render the game
    customRenderAll();
    
    // Render to main canvas
    const mainCtx = canvas.getContext('2d');
    mainCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    mainCtx.imageSmoothingEnabled = false;

    // --- Apply Rounded Corners to mainCtx ---
    const mainCornerRadius = 20; // شعاع به پیکسل‌های canvas اصلی (می‌توانید این را تنظیم کنید)
    mainCtx.save(); // ذخیره حالت فعلی canvas
    mainCtx.beginPath();
    mainCtx.moveTo(mainCornerRadius, 0);
    mainCtx.lineTo(CANVAS_WIDTH - mainCornerRadius, 0);
    mainCtx.arcTo(CANVAS_WIDTH, 0, CANVAS_WIDTH, mainCornerRadius, mainCornerRadius);
    mainCtx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - mainCornerRadius);
    mainCtx.arcTo(CANVAS_WIDTH, CANVAS_HEIGHT, CANVAS_WIDTH - mainCornerRadius, CANVAS_HEIGHT, mainCornerRadius);
    mainCtx.lineTo(mainCornerRadius, CANVAS_HEIGHT);
    mainCtx.arcTo(0, CANVAS_HEIGHT, 0, CANVAS_HEIGHT - mainCornerRadius, mainCornerRadius);
    mainCtx.lineTo(0, mainCornerRadius);
    mainCtx.arcTo(0, 0, mainCornerRadius, 0, mainCornerRadius);
    mainCtx.closePath();
    mainCtx.clip(); // هر چیزی که بعد از این کشیده شود، به این مسیر محدود می‌شود
    // --- End of Rounded Corners ---

    mainCtx.drawImage(pixelCanvas, 0, 0, PIXEL_CANVAS_WIDTH, PIXEL_CANVAS_HEIGHT, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    mainCtx.restore(); // بازگرداندن حالت canvas (حذف clipping mask)
    
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
        // --- NEW LOGIC FOR STRIPED GRASS ---
        const mainGrassColor = color; // color is activeTheme.ground
        const stripeGrassColor = activeTheme.groundSecondary || shadeColor(color, 0.15); // Darker stripes
        const stripeWidth = Math.max(2, Math.round(20 / PIXEL_SCALE)); // Width of each stripe in pixels on pixelCanvas
        const numStripes = Math.floor(pWidth / stripeWidth);

        for (let i = 0; i < numStripes; i++) {
            const currentX = -pWidth / 2 + i * stripeWidth;
            pixelCtx.fillStyle = (i % 2 === 0) ? mainGrassColor : stripeGrassColor;
            pixelCtx.fillRect(currentX, -pHeight / 2, stripeWidth, pHeight);
        }
        // Fill any remaining part if pWidth is not perfectly divisible by stripeWidth
        const remainingWidth = pWidth - numStripes * stripeWidth;
        if (remainingWidth > 0) {
            pixelCtx.fillStyle = (numStripes % 2 === 0) ? mainGrassColor : stripeGrassColor;
            pixelCtx.fillRect(-pWidth / 2 + numStripes * stripeWidth, -pHeight / 2, remainingWidth, pHeight);
        }

        // Add subtle grass blade texture (optional, can be kept or modified)
        // REMOVE OR COMMENT OUT THE FOLLOWING BLOCK TO REMOVE DOTS:
        /*
        pixelCtx.fillStyle = shadeColor(mainGrassColor, -0.05);
        const grassBlade = Math.max(1, Math.round(1 / PIXEL_SCALE));
        for (let x_tex = -pWidth / 2; x_tex < pWidth / 2; x_tex += grassBlade * 3) {
            for (let y_tex = -pHeight / 2; y_tex < pHeight / 2; y_tex += grassBlade * 3) {
                if (Math.random() > 0.65) {
                    pixelCtx.fillRect(x_tex + Math.random() * grassBlade, y_tex + Math.random() * grassBlade, grassBlade, grassBlade);
                }
            }
        }
        */
        // --- END OF NEW LOGIC FOR STRIPED GRASS ---
    } else if (label.includes('wall-left') || label.includes('wall-right')) {
        const darkerWall = shadeColor(color, -0.15);
        const stripeWidth = Math.max(1, Math.round(5 / PIXEL_SCALE));
        for (let i = -pWidth / 2; i < pWidth / 2; i += stripeWidth * 2) {
            pCtx.fillStyle = color;
            pCtx.fillRect(i, -pHeight / 2, stripeWidth, pHeight);
            pCtx.fillStyle = darkerWall;
            pCtx.fillRect(i + stripeWidth, -pHeight / 2, stripeWidth, pHeight);
        }
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
    if (gameState !== 'playing' && gameState !== 'gameOver') return; // Show score in game over too

    const pixelSize = Math.max(1, Math.round(1 / PIXEL_SCALE));
    const margin = 3 * pixelSize; // فاصله از لبه‌ها
    const scoreboardHeight = 12 * pixelSize; // ارتفاع کلی اسکوربورد
    const scoreBoxWidth = 25 * pixelSize; // عرض بخش امتیاز هر تیم
    const timeBoxWidth = 20 * pixelSize;  // عرض بخش زمان
    // const teamNameWidth = 30 * pixelSize; // For team names if needed later

    const scoreboardY = margin;
    let currentX = margin;

    // Helper function to determine text color contrast (simplified YIQ formula)
    function getTextColorForBg(hexcolor){
        if (hexcolor.startsWith('#')) hexcolor = hexcolor.slice(1);
        const r = parseInt(hexcolor.substring(0,2),16);
        const g = parseInt(hexcolor.substring(2,4),16);
        const b = parseInt(hexcolor.substring(4,6),16);
        const brightness = (r*299 + g*587 + b*114) / 1000;
        return brightness < 128 ? '#FFFFFF' : '#000000'; // White for dark bg, Black for light bg
    }

    // --- Team 1 Score ---
    pixelCtx.fillStyle = activeTeam1Color;
    pixelCtx.fillRect(currentX, scoreboardY, scoreBoxWidth, scoreboardHeight);
    pixelCtx.fillStyle = getTextColorForBg(activeTeam1Color);
    // Adjust text position to center it better, considering text length
    const score1Text = team1Score.toString();
    const score1TextWidth = score1Text.length * 3 * pixelSize * 1.5; // Approximate width of text (3px wide chars in fontMap, scaled by 1.5)
    drawPixelText(currentX + (scoreBoxWidth - score1TextWidth) / 2, scoreboardY + scoreboardHeight / 2 - (1.5 * pixelSize), score1Text, pixelSize * 1.5); // Slightly larger score text
    currentX += scoreBoxWidth + pixelSize; // Add a small gap

    // --- Timer ---
    pixelCtx.fillStyle = '#222222'; // Dark background for timer
    pixelCtx.fillRect(currentX, scoreboardY, timeBoxWidth, scoreboardHeight);
    pixelCtx.fillStyle = '#FFFFFF'; // White text for timer
    const minutes = Math.floor(Math.max(0, gameTimeRemaining) / 60);
    const seconds = Math.max(0, gameTimeRemaining) % 60;
    const timeText = `${minutes.toString().padStart(1, '0')}:${seconds.toString().padStart(2, '0')}`;
    const timeTextWidth = timeText.length * 3 * pixelSize * 1.2; // Approximate width
    drawPixelText(currentX + (timeBoxWidth - timeTextWidth) / 2, scoreboardY + scoreboardHeight/2 - (1.2*pixelSize), timeText, pixelSize * 1.2);
    currentX += timeBoxWidth + pixelSize; // Add a small gap
    
    // --- Team 2 Score ---
    pixelCtx.fillStyle = activeTeam2Color;
    pixelCtx.fillRect(currentX, scoreboardY, scoreBoxWidth, scoreboardHeight);
    pixelCtx.fillStyle = getTextColorForBg(activeTeam2Color);
    const score2Text = team2Score.toString();
    const score2TextWidth = score2Text.length * 3 * pixelSize * 1.5; // Approximate width
    drawPixelText(currentX + (scoreBoxWidth - score2TextWidth) / 2, scoreboardY + scoreboardHeight / 2 - (1.5 * pixelSize), score2Text, pixelSize * 1.5);
    // currentX += scoreBoxWidth; // Not needed for last element
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
    
    // Draw sky gradient background
    const currentSunColor = getCurrentSunColor();
    const gradient = pixelCtx.createLinearGradient(0, 0, 0, PIXEL_CANVAS_HEIGHT);
    
    // Dynamic sky colors based on sun
    let skyTop, skyMid, skyBottom;
    if (currentSunColor === SUN_COLORS.dawn || currentSunColor === SUN_COLORS.evening) {
        skyTop = '#FF6B6B';
        skyMid = '#FFD93D'; 
        skyBottom = '#87CEEB';
    } else if (currentSunColor === SUN_COLORS.night) {
        skyTop = '#191970';
        skyMid = '#000033';
        skyBottom = '#191970';
    } else {
        skyTop = shadeColor(activeTheme.skyColor, 0.2);
        skyMid = activeTheme.skyColor;
        skyBottom = shadeColor(activeTheme.skyColor, -0.3);
    }
    
    gradient.addColorStop(0, skyTop);
    gradient.addColorStop(0.6, skyMid);
    gradient.addColorStop(1, skyBottom);
    pixelCtx.fillStyle = gradient;
    pixelCtx.fillRect(0, 0, PIXEL_CANVAS_WIDTH, PIXEL_CANVAS_HEIGHT);
    
    // Draw stadium lights first (background lighting)
    stadiumLights.forEach(light => drawStadiumLight(light));
    
    // Draw spectators
    spectators.forEach(spectator => drawSpectator(spectator));
    
    // Draw clouds
    clouds.forEach(cloud => drawCloud(cloud));
    
    // Draw sun/moon with dynamic color
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

    // --- New Goal Rendering Logic ---
    const goalPostColor = '#FFFFFF'; // رنگ تیرک‌ها
    const netColor = activeTheme.net || 'rgba(200, 200, 200, 0.6)'; // رنگ تور
    const postThickness = Math.max(2, Math.round(6 / PIXEL_SCALE)); // ضخامت تیرک‌ها در pixelCanvas

    const goalPixelHeight = Math.round(GOAL_HEIGHT / PIXEL_SCALE);
    const goalPixelMouthWidth = Math.round(GOAL_MOUTH_VISUAL_WIDTH / PIXEL_SCALE); // عرض دهانه دروازه
    const goalPixelDepth = Math.round((GOAL_MOUTH_VISUAL_WIDTH * 0.6) / PIXEL_SCALE); // عمق دروازه (قابل تنظیم)

    const groundY = Math.round((CANVAS_HEIGHT - GROUND_THICKNESS) / PIXEL_SCALE);
    const goalTopY = groundY - goalPixelHeight;

    // Helper function to draw a "3D" post (ساده شده)
    function drawPost(x, y, width, height, depth, color) {
        const darkColor = shadeColor(color, -0.2);
        const darkerColor = shadeColor(color, -0.4);

        // Front face
        pixelCtx.fillStyle = color;
        pixelCtx.fillRect(x - width / 2, y, width, height);

        // Top face (اگر افقی است، یا برای عمق تیرک عمودی)
        // این بخش برای تیرک‌های ایزومتریک واقعی نیاز به محاسبات پرسپکتیو دارد
        // برای سادگی، یک سایه ساده می‌گذاریم
        if (height < width * 2) { // تیرک افقی
             pixelCtx.fillStyle = darkColor;
             pixelCtx.beginPath();
             pixelCtx.moveTo(x - width/2, y);
             pixelCtx.lineTo(x - width/2 + depth * 0.5, y - depth * 0.25);
             pixelCtx.lineTo(x + width/2 + depth * 0.5, y - depth * 0.25);
             pixelCtx.lineTo(x + width/2, y);
             pixelCtx.closePath();
             pixelCtx.fill();
        } else { // تیرک عمودی
            pixelCtx.fillStyle = darkColor;
            pixelCtx.beginPath();
            pixelCtx.moveTo(x + width / 2, y);
            pixelCtx.lineTo(x + width / 2 + depth * 0.5, y + depth * 0.25);
            pixelCtx.lineTo(x + width / 2 + depth * 0.5, y + height + depth * 0.25);
            pixelCtx.lineTo(x + width / 2, y + height);
            pixelCtx.closePath();
            pixelCtx.fill();
        }
    }

    pixelCtx.strokeStyle = netColor;
    pixelCtx.lineWidth = Math.max(1, Math.round(1 / PIXEL_SCALE));

    // --- Render Left Goal ---
    const leftGoalFrontX = Math.round(WALL_THICKNESS / PIXEL_SCALE);
    // تیرک چپ عمودی
    drawPost(leftGoalFrontX + postThickness / 2, goalTopY, postThickness, goalPixelHeight, postThickness * 2, goalPostColor);
    // تیرک راست عمودی دروازه چپ
    drawPost(leftGoalFrontX + goalPixelMouthWidth - postThickness / 2, goalTopY, postThickness, goalPixelHeight, postThickness * 2, goalPostColor);
    // تیرک افقی بالای دروازه چپ
    drawPost(leftGoalFrontX + goalPixelMouthWidth / 2, goalTopY, goalPixelMouthWidth - postThickness, postThickness, postThickness * 2, goalPostColor);

    // تور دروازه چپ (ساده شده)
    const netTopBackY_L = goalTopY + postThickness / 2; // کمی داخل‌تر از بالای تیرک
    // const netBottomBackY_L = groundY - postThickness / 2; // دیگر استفاده نمی‌شود به این شکل
    const netBackX_L_Start = leftGoalFrontX + postThickness + goalPixelDepth * 0.2;
    const netBackX_L_End = leftGoalFrontX + goalPixelMouthWidth - postThickness - goalPixelDepth * 0.2;
    const netDepthAnchorY_L = groundY - Math.max(1, Math.round(1 / PIXEL_SCALE)); // جدید: تور تا نزدیک زمین در عقب

    for (let i = 0; i <= 5; i++) { // خطوط افقی تور
        const t = i / 5;
        const yFront = goalTopY + postThickness + t * (goalPixelHeight - postThickness * 2); // جلوی تور از بالای تیرک تا پایین تیرک
        // yBack باید از بالای تور در عقب (netTopBackY_L) تا پایین تور در عقب (netDepthAnchorY_L) اینترپوله شود
        const yBack = netTopBackY_L + t * (netDepthAnchorY_L - netTopBackY_L);
        const xBackStart = netBackX_L_Start + t * (goalPixelDepth*0.3);
        const xBackEnd = netBackX_L_End - t * (goalPixelDepth*0.3);

        pixelCtx.beginPath();
        pixelCtx.moveTo(leftGoalFrontX + postThickness, yFront); // اتصال به جلوی تیرک
        pixelCtx.lineTo(xBackStart, yBack);
        pixelCtx.lineTo(xBackEnd, yBack);
        pixelCtx.lineTo(leftGoalFrontX + goalPixelMouthWidth - postThickness, yFront); // اتصال به جلوی تیرک دیگر
        if(i < 5 && i > 0) pixelCtx.stroke(); // خطوط میانی تور
    }
    for (let i = 0; i <= 6; i++) { // خطوط عمودی تور
        const t = i / 6;
        const xFront = leftGoalFrontX + postThickness + t * (goalPixelMouthWidth - 2 * postThickness);
        const xBack = netBackX_L_Start + t * (netBackX_L_End - netBackX_L_Start);

        pixelCtx.beginPath();
        pixelCtx.moveTo(xFront, goalTopY + postThickness);
        pixelCtx.lineTo(xBack, netTopBackY_L);
        pixelCtx.lineTo(xBack, netDepthAnchorY_L); // جدید: تا پایین‌تر
        // pixelCtx.lineTo(xFront, groundY - postThickness); // اگر تور تا پایین می‌آید
        pixelCtx.stroke();
    }


    // --- Render Right Goal ---
    const rightGoalFrontX = PIXEL_CANVAS_WIDTH - Math.round(WALL_THICKNESS / PIXEL_SCALE) - goalPixelMouthWidth;
    // تیرک چپ عمودی دروازه راست
    drawPost(rightGoalFrontX + postThickness / 2, goalTopY, postThickness, goalPixelHeight, postThickness * 2, goalPostColor);
    // تیرک راست عمودی دروازه راست
    drawPost(rightGoalFrontX + goalPixelMouthWidth - postThickness / 2, goalTopY, postThickness, goalPixelHeight, postThickness * 2, goalPostColor);
    // تیرک افقی بالای دروازه راست
    drawPost(rightGoalFrontX + goalPixelMouthWidth / 2, goalTopY, goalPixelMouthWidth - postThickness, postThickness, postThickness * 2, goalPostColor);

    // تور دروازه راست (ساده شده)
    const netTopBackY_R = goalTopY + postThickness / 2;
    // const netBottomBackY_R = groundY - postThickness / 2; // دیگر استفاده نمی‌شود
    const netBackX_R_Start = rightGoalFrontX + postThickness + goalPixelDepth * 0.2;
    const netBackX_R_End = rightGoalFrontX + goalPixelMouthWidth - postThickness - goalPixelDepth * 0.2;
    const netDepthAnchorY_R = groundY - Math.max(1, Math.round(1 / PIXEL_SCALE)); // جدید: تور تا نزدیک زمین در عقب

    for (let i = 0; i <= 5; i++) { // خطوط افقی تور
        const t = i / 5;
        const yFront = goalTopY + postThickness + t * (goalPixelHeight - postThickness * 2);
        // yBack باید از بالای تور در عقب (netTopBackY_R) تا پایین تور در عقب (netDepthAnchorY_R) اینترپوله شود
        const yBack = netTopBackY_R + t * (netDepthAnchorY_R - netTopBackY_R);
        const xBackStart = netBackX_R_Start + t * (goalPixelDepth*0.3);
        const xBackEnd = netBackX_R_End - t * (goalPixelDepth*0.3);

        pixelCtx.beginPath();
        pixelCtx.moveTo(rightGoalFrontX + postThickness, yFront);
        pixelCtx.lineTo(xBackStart, yBack);
        pixelCtx.lineTo(xBackEnd, yBack);
        pixelCtx.lineTo(rightGoalFrontX + goalPixelMouthWidth - postThickness, yFront);
        if(i < 5 && i > 0) pixelCtx.stroke();
    }
     for (let i = 0; i <= 6; i++) { // خطوط عمودی تور
        const t = i / 6;
        const xFront = rightGoalFrontX + postThickness + t * (goalPixelMouthWidth - 2 * postThickness);
        const xBack = netBackX_R_Start + t * (netBackX_R_End - netBackX_R_Start);

        pixelCtx.beginPath();
        pixelCtx.moveTo(xFront, goalTopY + postThickness);
        pixelCtx.lineTo(xBack, netTopBackY_R);
        pixelCtx.lineTo(xBack, netDepthAnchorY_R); // جدید: تا پایین‌تر
        pixelCtx.stroke();
    }
    // --- End of New Goal Rendering Logic ---
}

document.addEventListener('DOMContentLoaded', setup);

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
