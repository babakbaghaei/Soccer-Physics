// --- Matter.js Aliases ---
const Engine = Matter.Engine;
const Render = Matter.Render;
const Runner = Matter.Runner;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Events = Matter.Events;
const Composite = Matter.Composite;

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

const PIXEL_SCALE = 6;
const PIXEL_CANVAS_WIDTH = CANVAS_WIDTH / PIXEL_SCALE;
const PIXEL_CANVAS_HEIGHT = CANVAS_HEIGHT / PIXEL_SCALE;

// --- Collision Categories ---
const playerCategory = 0x0001;
const goalPostCategory = 0x0002;
const ballCategory = 0x0004;
const worldCategory = 0x0008; // For ground, walls, ceiling

// --- Game Variables ---
let pixelCanvas;
let pixelCtx;

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
const GOAL_HEIGHT = 120; // Height of the goal opening itself
const GOAL_SENSOR_DEPTH = 30; // Depth of the sensor inside the goal
const GOAL_MOUTH_VISUAL_WIDTH = 60; // Visual width of the goal mouth
const CROSSBAR_THICKNESS = 10; // Thickness of the horizontal crossbar
let actualGoalOpeningHeight = GOAL_HEIGHT - CROSSBAR_THICKNESS; // Recalculated in setup if needed, but used for sensor height

// --- Color Palettes ---
const colorPalettes = [
    { name: "Classic", team1: '#D9534F', team2: '#428BCA' },
    { name: "Nature", team1: '#5CB85C', team2: '#F0AD4E' },
    { name: "Royal", team1: '#6A0DAD', team2: '#FFA500' },
    { name: "Mono", team1: '#666666', team2: '#CCCCCC' }
];
let activeTeam1Color = colorPalettes[0].team1;
let activeTeam2Color = colorPalettes[0].team2;
let currentColorPaletteIndex = -1;

// --- Themes ---
const themes = [
    {
        name: "White Out",
        background: '#FFFFFF',
        ground: '#E0E0E0',
        groundSecondary: '#D0D0D0',
        walls: '#C0C0C0',
        ballThemeColor: '#333333',
        net: 'rgba(100, 100, 100, 0.5)',
        skyColor: '#FFFFFF',
        cloudColor: '#E8E8E8',
        sunColor: '#F0F0F0'
    },
    { 
        name: "Grass Day", 
        background: '#87CEEB',
        ground: '#228B22',
        groundSecondary: '#32CD32',
        walls: '#8B4513',
        ballThemeColor: '#FFFFFF', 
        net: 'rgba(220, 220, 220, 0.8)',
        skyColor: '#87CEEB',
        cloudColor: '#FFFFFF',
        sunColor: '#FFD700'
    },
    { 
        name: "Night Sky", 
        background: '#191970',
        ground: '#006400',
        groundSecondary: '#228B22',
        walls: '#2F4F4F',
        ballThemeColor: '#E0E0E0', 
        net: 'rgba(180, 180, 200, 0.5)',
        skyColor: '#191970',
        cloudColor: '#696969',
        sunColor: '#F0F8FF'
    },
    { 
        name: "Desert", 
        background: '#F4A460',
        ground: '#DEB887',
        groundSecondary: '#D2B48C',
        walls: '#A0522D', 
        ballThemeColor: '#FAFAFA', 
        net: 'rgba(100, 100, 100, 0.5)',
        skyColor: '#F4A460',
        cloudColor: '#F5DEB3',
        sunColor: '#FF4500'
    }
];
let currentThemeIndex = 0; // Start with White Out or Grass Day for testing
let activeTheme = themes[currentThemeIndex];

// --- Animated Elements ---
let clouds = [];
let sunPosition = { x: 0, y: 0 };
let gameTime = 0;
let gameStartTime = 0;
// spectators array is still here but initSpectators is commented out
let spectators = [];
let stadiumLights = [];

// --- Game States ---
let gameState = 'playing';

// --- Dynamic Sun System ---
const SUN_COLORS = {
    dawn: '#FF6B6B', morning: '#FFD93D', noon: '#FFD700',
    afternoon: '#FFA500', evening: '#FF4500', night: '#F0F8FF'
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
const PLAYER_MOVE_FORCE = 0.008;
const PLAYER_ROLL_ANGULAR_VELOCITY_TARGET = 0.20;
const PLAYER_ROLL_TRANSLATE_SPEED = 1.0;

const PLAYER_VARIABLE_JUMP_INITIAL_FORCE = 0.07;
const PLAYER_VARIABLE_JUMP_SUSTAINED_FORCE = 0.007;
const PLAYER_VARIABLE_JUMP_MAX_HOLD_FRAMES = 10;
const PLAYER_MAX_JUMP_IMPULSE = 0.18;
const COYOTE_TIME_FRAMES = 7;

const KICK_RANGE = PLAYER_RECT_SIZE / 2 + BALL_RADIUS + 10;
const KICK_FORCE_MAGNITUDE = 0.065;
const TIMED_JUMP_SHOT_BONUS_FACTOR = 1.6;
const JUMP_SHOT_LOFT_FACTOR = 1.6;
const PLAYER_AIR_CONTROL_FACTOR = 1.0;

const AI_ACTION_RANGE = PLAYER_RECT_SIZE * 2.5;
const AI_MOVE_FORCE = 0.0035;
const AI_KICK_ATTEMPT_STRENGTH = 0.075;
const AI_KICK_BALL_RANGE = KICK_RANGE + 5;
const AI_TIMED_JUMP_ANTICIPATION_FRAMES = 10;
const PLAYER_ACTION_COOLDOWN_FRAMES = 20;

const LANDING_DAMPING_FACTOR = 0.9;
const keysPressed = {};

// --- AI Intent Constants ---
const INTENT_ATTACK = 'ATTACK';
const INTENT_DEFEND = 'DEFEND';
const INTENT_REPOSITION = 'REPOSITION';

// --- AI Intent Definitions ---
// gameState will be a simplified object passed to utility functions,
// containing necessary info like ball position, player positions, goal positions etc.
const aiIntents = {
    [INTENT_ATTACK]: {
        name: INTENT_ATTACK,
        calculateUtility: function(gameState, player) {
            let score = 0;
            if (!gameState.ball || !player || !gameState.opponentGoalPosition || !gameState.humanPlayer) return 0;

            const aiPos = player.playerBody.position;
            const ballPos = gameState.ball.position;
            const opponentGoalPos = gameState.opponentGoalPosition;
            const humanPlayerPos = gameState.humanPlayer.playerBody.position;

            // 1. Proximity of ball to opponent's goal
            const ballToOpponentGoalDist = Matter.Vector.magnitude(Matter.Vector.sub(ballPos, opponentGoalPos));
            score += (CANVAS_WIDTH - ballToOpponentGoalDist) / CANVAS_WIDTH * 70; // Max 70 points

            // 2. Proximity of AI to ball
            const aiToBallDist = Matter.Vector.magnitude(Matter.Vector.sub(aiPos, ballPos));
            score += (AI_ACTION_RANGE * 2 - aiToBallDist) / (AI_ACTION_RANGE * 2) * 50; // Max 50 points if AI is very close

            // 3. Is shot path to goal clear of human player?
            const vecAiToGoal = Matter.Vector.sub(opponentGoalPos, aiPos);
            const vecAiToHuman = Matter.Vector.sub(humanPlayerPos, aiPos);
            // Check if human is between AI and Goal, and relatively close to the direct path
            if (Matter.Vector.dot(vecAiToGoal, vecAiToHuman) > 0 && // Human is in the general direction of the goal
                Matter.Vector.magnitudeSquared(vecAiToHuman) < Matter.Vector.magnitudeSquared(vecAiToGoal)) { // Human is closer than the goal
                const distHumanToShotPath = perpDistToLine(aiPos, opponentGoalPos, humanPlayerPos);
                if (distHumanToShotPath < PLAYER_RECT_SIZE * 1.5) { // Human is blocking the path
                    score -= 40; // Penalty for blocked path
                }
            }

            // 4. Angle for a good shot (AI is behind ball relative to opponent goal)
            const vecBallToGoal = Matter.Vector.sub(opponentGoalPos, ballPos);
            const vecBallToAi = Matter.Vector.sub(aiPos, ballPos);
            const angleBetweenBallGoalAndBallAi = Matter.Vector.angle(vecBallToGoal, vecBallToAi);
            // Ideal angle is Math.PI (AI is directly behind ball). Score higher as angle approaches PI.
            // We use (Math.PI - abs(angle)) to score higher when AI is behind the ball.
            // Normalize this to a positive score contribution.
            const angleScoreFactor = (Math.PI - Math.abs(angleBetweenBallGoalAndBallAi)) / Math.PI; // 0 to 1
            score += angleScoreFactor * 30; // Max 30 points for good angle

            // 5. Bonus if AI is facing the opponent's goal
            const aiAngle = player.playerBody.angle; // Assuming 0 is facing right
            const directionToOpponentGoal = Math.sign(opponentGoalPos.x - aiPos.x);
            // Simplified: if AI is facing generally towards opponent goal
            if ((directionToOpponentGoal > 0 && Math.abs(aiAngle) < Math.PI / 2) ||
                (directionToOpponentGoal < 0 && Math.abs(aiAngle) > Math.PI / 2)) {
                score += 15;
            }

            // 6. Bonus if ball is moving towards opponent's goal
            if (Matter.Vector.dot(gameState.ball.velocity, vecBallToGoal) > 0) {
                score += Matter.Vector.magnitude(gameState.ball.velocity) * 3; // More score for faster ball
            }


            return Math.max(0, score); // Ensure score is not negative
        }
    },
    [INTENT_DEFEND]: {
        name: INTENT_DEFEND,
        calculateUtility: function(gameState, player) {
            let score = 0;
            if (!gameState.ball || !player || !gameState.ownGoalPosition || !gameState.humanPlayer) return 0;

            const aiPos = player.playerBody.position;
            const ballPos = gameState.ball.position;
            const ownGoalPos = gameState.ownGoalPosition;
            const humanPlayerPos = gameState.humanPlayer.playerBody.position;

            // 1. Proximity of ball to own goal
            const ballToOwnGoalDist = Matter.Vector.magnitude(Matter.Vector.sub(ballPos, ownGoalPos));
            score += (CANVAS_WIDTH - ballToOwnGoalDist) / CANVAS_WIDTH * 70; // Max 70 points

            // 2. AI is between ball and own goal
            // Check if AI's x-coordinate is between ball's x and own goal's x
            const isAiBetweenBallAndGoalX = (ballPos.x < aiPos.x && aiPos.x < ownGoalPos.x) || (ownGoalPos.x < aiPos.x && aiPos.x < ballPos.x);
            // Check if AI is also relatively aligned vertically or can intercept
            const verticalAlignmentFactor = Math.max(0, 1 - (Math.abs(aiPos.y - ballPos.y) / (CANVAS_HEIGHT / 2)));
            if (isAiBetweenBallAndGoalX) {
                score += 50 * verticalAlignmentFactor; // Max 50 points for good positioning
            }

            // 3. Proximity of AI to human player (if human has ball or is near ball)
            const humanToBallDist = Matter.Vector.magnitude(Matter.Vector.sub(humanPlayerPos, ballPos));
            if (humanToBallDist < AI_ACTION_RANGE * 1.5) { // If human is relevant to the ball
                const aiToHumanDist = Matter.Vector.magnitude(Matter.Vector.sub(aiPos, humanPlayerPos));
                score += (AI_ACTION_RANGE * 2 - aiToHumanDist) / (AI_ACTION_RANGE * 2) * 40; // Max 40 points
            }

            // 4. Ball is moving towards own goal with significant speed
            const vecBallToOwnGoal = Matter.Vector.sub(ownGoalPos, ballPos);
            const ballSpeedTowardsGoal = Matter.Vector.dot(gameState.ball.velocity, Matter.Vector.normalise(vecBallToOwnGoal));
            if (ballSpeedTowardsGoal > 2) { // Threshold for "significant speed"
                score += ballSpeedTowardsGoal * 10; // Max ~50 points if ball is very fast (e.g. speed 5)
            }

            // 5. Penalty if AI is behind the ball (relative to own goal)
            const vecOwnGoalToAi = Matter.Vector.sub(aiPos, ownGoalPos);
            const vecOwnGoalToBall = Matter.Vector.sub(ballPos, ownGoalPos);
            if (Matter.Vector.dot(vecOwnGoalToAi, vecOwnGoalToBall) > 0 && // Both are on the same side of goal
                Matter.Vector.magnitudeSquared(vecOwnGoalToAi) > Matter.Vector.magnitudeSquared(vecOwnGoalToBall)) { // AI is further from goal than ball
                score -= 30;
            }

            return Math.max(0, score);
        }
    },
    [INTENT_REPOSITION]: {
        name: INTENT_REPOSITION,
        calculateUtility: function(gameState, player) {
            let score = 20; // Base score to encourage repositioning if other intents are low
            if (!player || !gameState.ball) return score;

            const aiPos = player.playerBody.position;
            const ballPos = gameState.ball.position;

            // 1. Move to a strategic central position if ball is neutral or far
            const distAiToCenter = Math.abs(aiPos.x - CANVAS_WIDTH / 2);
            score += (CANVAS_WIDTH / 2 - distAiToCenter) / (CANVAS_WIDTH / 2) * 25; // Max 25 for being central

            // 2. Maintain a moderate distance from the ball - not too close if not attacking/defending, not too far
            const aiToBallDist = Matter.Vector.magnitude(Matter.Vector.sub(aiPos, ballPos));
            const optimalDistance = CANVAS_WIDTH / 3.5;
            const distanceDifference = Math.abs(aiToBallDist - optimalDistance);
            // Score higher if closer to optimal distance. Max score when at optimal distance.
            score += (optimalDistance - distanceDifference) / optimalDistance * 20; // Max 20 points

            // 3. Avoid being too close to walls unless necessary (e.g. ball is there)
            const wallAvoidanceMargin = PLAYER_RECT_SIZE * 1.5;
            if (aiPos.x < wallAvoidanceMargin || aiPos.x > CANVAS_WIDTH - wallAvoidanceMargin) {
                score -= 15;
            }
            if (aiPos.y < wallAvoidanceMargin) { // Near ceiling
                score -= 10;
            }

            // 4. If ball is far and AI is not in a good defensive or offensive setup, increase reposition score
            const ballToOpponentGoalDist = Matter.Vector.magnitude(Matter.Vector.sub(ballPos, gameState.opponentGoalPosition));
            const ballToOwnGoalDist = Matter.Vector.magnitude(Matter.Vector.sub(ballPos, gameState.ownGoalPosition));

            if (aiToBallDist > CANVAS_WIDTH / 2.5 &&  // Ball is relatively far
                ballToOpponentGoalDist > CANVAS_WIDTH / 3 && // Ball not immediately threatening opponent
                ballToOwnGoalDist > CANVAS_WIDTH / 3) { // Ball not immediately threatening self
                score += 20; // Bonus for proactive repositioning when ball is in neutral territory
            }

            // 5. Slight preference for being on own side of half if not clearly attacking
            if (player.playerTeam === 1 && aiPos.x > CANVAS_WIDTH / 2 && gameState.currentIntent !== INTENT_ATTACK) { // Team 1 on right half
                 score += 5;
            } else if (player.playerTeam === 2 && aiPos.x < CANVAS_WIDTH / 2 && gameState.currentIntent !== INTENT_ATTACK) { // Team 2 on left half
                 score += 5;
            }

            return Math.max(0, score);
        }
    }
};

// --- Sound Functions ---
const soundEnabled = true;
let audioContext;

function initAudioContext() { /* ... (no changes) ... */
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.warn('Web Audio API not supported:', e);
    }
}
function createTone(frequency, duration, type = 'sine', volume = 0.1) { /* ... (no changes) ... */
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
function playSound(soundFileName) { /* ... (no changes, ensure post_hit.wav case is added later) ... */
    if (!soundEnabled || !audioContext) return;
    try {
        switch(soundFileName) {
            case 'jump.wav':
                createTone(440, 0.15, 'square', 0.08);
                setTimeout(() => createTone(660, 0.1, 'sine', 0.06), 50);
                break;
            case 'kick.wav':
                createTone(200, 0.1, 'square', 0.12);
                setTimeout(() => createTone(150, 0.05, 'triangle', 0.08), 30);
                break;
            case 'goal.wav':
                createTone(523, 0.2, 'sine', 0.1);
                setTimeout(() => createTone(659, 0.2, 'sine', 0.1), 100);
                setTimeout(() => createTone(784, 0.3, 'sine', 0.12), 200);
                break;
            case 'ball_hit_wall.wav': // For walls and ceiling
                createTone(300, 0.08, 'square', 0.06);
                break;
            case 'post_hit.wav': // New sound for hitting posts
                createTone(350, 0.15, 'triangle', 0.09);
                setTimeout(() => createTone(280, 0.1, 'square', 0.07), 40);
                break;
            default:
                console.warn(`Unknown sound: ${soundFileName}`);
        }
    } catch (e) {
        console.warn(`Sound generation failed for ${soundFileName}:`, e);
    }
}

// Initialize clouds
function initClouds() { /* ... (no changes from previous version using fluffyPatterns) ... */
    clouds = [];
    const numClouds = 6;
    for (let i = 0; i < numClouds; i++) {
        clouds.push({
            x: Math.random() * (PIXEL_CANVAS_WIDTH + 60) - 30,
            y: Math.random() * (PIXEL_CANVAS_HEIGHT * 0.5) + 5,
            size: Math.random() * 15 + 10, // Adjusted size for fluffy clouds
            speed: Math.random() * 0.4 + 0.05,
            opacity: Math.random() * 0.4 + 0.3, // Slightly less transparent
            type: Math.floor(Math.random() * 3)
        });
    }
    sunPosition.x = PIXEL_CANVAS_WIDTH * 0.1;
    sunPosition.y = PIXEL_CANVAS_HEIGHT * 0.3;
}
// initSpectators is not called, but function can remain
function initSpectators() { /* ... (no changes, but not called) ... */ }
function initStadiumLights() { /* ... (no changes) ... */
    stadiumLights = [
        { x: PIXEL_CANVAS_WIDTH * 0.2, y: PIXEL_CANVAS_HEIGHT * 0.1, intensity: 0.8 },
        { x: PIXEL_CANVAS_WIDTH * 0.5, y: PIXEL_CANVAS_HEIGHT * 0.05, intensity: 1.0 },
        { x: PIXEL_CANVAS_WIDTH * 0.8, y: PIXEL_CANVAS_HEIGHT * 0.1, intensity: 0.8 }
    ];
}

// --- Initialization Function ---
function setup() {
    console.log("SETUP: Initializing game state...");
    isGameStarted = false; isGameOver = false; restartDebounce = false;
    team1Score = 0; team2Score = 0;
    gameTimeRemaining = ROUND_DURATION_SECONDS;
    actualGoalOpeningHeight = GOAL_HEIGHT - CROSSBAR_THICKNESS;
    particles = []; gameTime = 0; gameStartTime = Date.now();
    gameState = 'playing';
    Object.keys(keysPressed).forEach(key => { keysPressed[key] = false; });

    if (!audioContext) initAudioContext();
    initClouds();
    // initSpectators(); // Spectators removed
    initStadiumLights();

    if (roundTimerId) { clearInterval(roundTimerId); roundTimerId = null; }

    currentThemeIndex = (currentThemeIndex + 1) % themes.length; // Cycle themes or set to specific one
    // For white background testing:
    // currentThemeIndex = 0; // Assuming "White Out" is the first theme
    activeTheme = themes[currentThemeIndex];

    currentColorPaletteIndex = (currentColorPaletteIndex + 1) % colorPalettes.length;
    const currentPalette = colorPalettes[currentColorPaletteIndex];
    activeTeam1Color = currentPalette.team1;
    activeTeam2Color = currentPalette.team2;

    if (engine) {
        World.clear(world, false); Engine.clear(engine); Events.off(engine);
        if (runner) Runner.stop(runner);
    }

    engine = Engine.create({ enableSleeping: false });
    world = engine.world;
    engine.world.gravity.y = 1.1;
    world.slop = 0.08;
    engine.positionIterations = 8;
    engine.velocityIterations = 6;
    console.log("SETUP: New engine/world created with custom collision settings.");

    render = Render.create({
        canvas: canvas, engine: engine,
        options: {
            width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
            wireframes: false, // Set to true for debugging physical bodies
            background: activeTheme.background,
            enabled: false
        }
    });
    canvas.width = CANVAS_WIDTH; canvas.height = CANVAS_HEIGHT;
    const mainCtx = canvas.getContext('2d');
    mainCtx.imageSmoothingEnabled = false;
    if (!pixelCanvas) {
        pixelCanvas = document.createElement('canvas');
        pixelCanvas.width = PIXEL_CANVAS_WIDTH; pixelCanvas.height = PIXEL_CANVAS_HEIGHT;
        pixelCtx = pixelCanvas.getContext('2d');
    }
    pixelCtx.imageSmoothingEnabled = false;

    createField(); // This will now create new posts and sensors
    createBall();
    players = [];
    const playerSpawnY = CANVAS_HEIGHT - GROUND_THICKNESS - PLAYER_RECT_SIZE / 2 - 5;
    players.push(createPlayer(CANVAS_WIDTH / 4, playerSpawnY, activeTeam1Color, true, false));
    players.push(createPlayer(CANVAS_WIDTH * 3 / 4, playerSpawnY, activeTeam2Color, false, true));
    
    setupInputListeners();
    runner = Runner.create();
    Events.on(engine, 'beforeUpdate', updateGame);
    Events.on(engine, 'collisionStart', handleCollisions);

    isGameStarted = true; isGameOver = false;
    Runner.run(runner, engine);
    console.log("SETUP: Matter.js Runner started.");
    startGameTimer();
    if (typeof gameRenderLoopId !== 'undefined') cancelAnimationFrame(gameRenderLoopId);
    gameRenderLoopId = requestAnimationFrame(gameRenderLoop);
    updateScoreDisplay(); updateTimerDisplay();
    showGameMessage("Game Started! Controls: A/D Move, W Jump");
    console.log("SETUP: Game started!");
}

// --- Timer Functions --- (no changes)
function startGameTimer() { /* ... */ }
function updateRoundTimer() { /* ... */ }
function updateTimerDisplay() { /* ... */ }
function getFieldDerivedConstants() {
    return { actualGoalOpeningHeight: GOAL_HEIGHT - CROSSBAR_THICKNESS };
}

// --- createField (NEW VERSION with physical posts and new sensors) ---
function createField() {
    const chamferOptions = { chamfer: { radius: 5 } };
    const postChamfer = { chamfer: { radius: 2 } };

    const ground = Bodies.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT - GROUND_THICKNESS / 2, CANVAS_WIDTH, GROUND_THICKNESS, {
        isStatic: true, label: 'ground', render: { fillStyle: activeTheme.ground }, ...chamferOptions,
        collisionFilter: { category: worldCategory }
    });
    const leftWall = Bodies.rectangle(WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, {
        isStatic: true, label: 'wall-left', render: { fillStyle: activeTheme.walls }, ...chamferOptions,
        collisionFilter: { category: worldCategory }
    });
    const rightWall = Bodies.rectangle(CANVAS_WIDTH - WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, {
        isStatic: true, label: 'wall-right', render: { fillStyle: activeTheme.walls }, ...chamferOptions,
        collisionFilter: { category: worldCategory }
    });
    const ceiling = Bodies.rectangle(CANVAS_WIDTH / 2, WALL_THICKNESS / 2, CANVAS_WIDTH, WALL_THICKNESS, {
        isStatic: true, label: 'ceiling', render: { fillStyle: activeTheme.walls }, ...chamferOptions,
        collisionFilter: { category: worldCategory }
    });

    const goalPostRenderStyle = { fillStyle: '#E0E0E0', strokeStyle: '#777777', lineWidth: 1 };
    const physicalPostThickness = 8;

    // --- Left Goal Posts ---
    const goalMouthStartX_L = WALL_THICKNESS;
    const goalTopY = CANVAS_HEIGHT - GROUND_THICKNESS - GOAL_HEIGHT;
    const goalOpeningActualHeight = GOAL_HEIGHT - CROSSBAR_THICKNESS;

    const postLV_L = Bodies.rectangle(
        goalMouthStartX_L + physicalPostThickness / 2,
        goalTopY + goalOpeningActualHeight / 2,
        physicalPostThickness, goalOpeningActualHeight,
        { isStatic: true, label: 'post-vl-L', render: goalPostRenderStyle, ...postChamfer,
          collisionFilter: { category: goalPostCategory, mask: ballCategory } }
    );
    const postRV_L = Bodies.rectangle(
        goalMouthStartX_L + GOAL_MOUTH_VISUAL_WIDTH - physicalPostThickness / 2,
        goalTopY + goalOpeningActualHeight / 2, physicalPostThickness, goalOpeningActualHeight,
        { isStatic: true, label: 'post-vr-L', render: goalPostRenderStyle, ...postChamfer,
          collisionFilter: { category: goalPostCategory, mask: ballCategory } }
    );
    const postH_L = Bodies.rectangle(
        goalMouthStartX_L + GOAL_MOUTH_VISUAL_WIDTH / 2,
        goalTopY + CROSSBAR_THICKNESS / 2, GOAL_MOUTH_VISUAL_WIDTH, CROSSBAR_THICKNESS,
        { isStatic: true, label: 'post-h-L', render: goalPostRenderStyle, ...postChamfer,
          collisionFilter: { category: goalPostCategory, mask: ballCategory } }
    );

    // --- Right Goal Posts ---
    const goalMouthStartX_R = CANVAS_WIDTH - WALL_THICKNESS - GOAL_MOUTH_VISUAL_WIDTH;
    const postLV_R = Bodies.rectangle(
        goalMouthStartX_R + physicalPostThickness / 2,
        goalTopY + goalOpeningActualHeight / 2, physicalPostThickness, goalOpeningActualHeight,
        { isStatic: true, label: 'post-vl-R', render: goalPostRenderStyle, ...postChamfer,
          collisionFilter: { category: goalPostCategory, mask: ballCategory } }
    );
    const postRV_R = Bodies.rectangle(
        goalMouthStartX_R + GOAL_MOUTH_VISUAL_WIDTH - physicalPostThickness / 2,
        goalTopY + goalOpeningActualHeight / 2, physicalPostThickness, goalOpeningActualHeight,
        { isStatic: true, label: 'post-vr-R', render: goalPostRenderStyle, ...postChamfer,
          collisionFilter: { category: goalPostCategory, mask: ballCategory } }
    );
    const postH_R = Bodies.rectangle(
        goalMouthStartX_R + GOAL_MOUTH_VISUAL_WIDTH / 2,
        goalTopY + CROSSBAR_THICKNESS / 2, GOAL_MOUTH_VISUAL_WIDTH, CROSSBAR_THICKNESS,
        { isStatic: true, label: 'post-h-R', render: goalPostRenderStyle, ...postChamfer,
          collisionFilter: { category: goalPostCategory, mask: ballCategory } }
    );

    // Goal Sensors ( Adjusted to be behind the posts )
    const sensorActualHeight = goalOpeningActualHeight;
    const sensorCenterY = goalTopY + sensorActualHeight / 2;
    const sensorWidth = GOAL_MOUTH_VISUAL_WIDTH - 2 * physicalPostThickness;
    const sensorRenderStyle = { visible: true, fillStyle: 'rgba(0, 255, 0, 0.15)' }; // Slightly more transparent

    const mainLeftGoalSensor = Bodies.rectangle(
        goalMouthStartX_L + physicalPostThickness + sensorWidth / 2,
        sensorCenterY, sensorWidth, sensorActualHeight,
        { isStatic: true, isSensor: true, label: 'goal-left-sensor', render: sensorRenderStyle }
    );
    const mainRightGoalSensor = Bodies.rectangle(
        goalMouthStartX_R + physicalPostThickness + sensorWidth / 2,
        sensorCenterY, sensorWidth, sensorActualHeight,
        { isStatic: true, isSensor: true, label: 'goal-right-sensor', render: sensorRenderStyle }
    );

    World.add(world, [
        ground, leftWall, rightWall, ceiling,
        postLV_L, postRV_L, postH_L,
        postLV_R, postRV_R, postH_R,
        mainLeftGoalSensor, mainRightGoalSensor
    ]);
}

// --- createBall (NEW VERSION with collisionFilter) ---
function createBall() {
    ball = Bodies.circle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3, BALL_RADIUS, {
        label: 'ball',
        density: 0.001, friction: 0.01, frictionAir: 0.008, restitution: 0.7,
        render: { strokeStyle: BALL_PANEL_COLOR_SECONDARY, lineWidth: 1 },
        collisionFilter: {
            category: ballCategory,
            mask: worldCategory | playerCategory | goalPostCategory | ballCategory
        }
    });
    World.add(world, ball);
}

// --- createPlayer (NEW VERSION with collisionFilter) ---
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
        collisionFilter: {
            category: playerCategory,
            mask: worldCategory | ballCategory | playerCategory | goalPostCategory /* Players DO collide with posts now, for realism, but post_hit logic handles it. If players should pass through, remove goalPostCategory from player's mask AND posts' mask */
        }
    };
    const playerBody = Bodies.rectangle(x, y, PLAYER_RECT_SIZE, PLAYER_RECT_SIZE, options);
    World.add(world, playerBody);
    return {
        playerBody: playerBody, playerTeam: isTeam1 ? 1 : 2, color: teamColor, actionCooldown: 0,
        jumpCooldown: 0, isAI: isAI, isGrounded: false, lastJumpTime: 0, isAttemptingVariableJump: false,
        variableJumpForceAppliedDuration: 0, totalJumpImpulseThisJump: 0, coyoteTimeFramesRemaining: 0,
        jumpInputBuffered: false, wasGrounded: false, targetAngle: 0, isRotating: false, currentFace: 0,
        rollDirection: 0,
        // AI-specific properties for utility-based system
        currentIntent: null, // Stores the AI's current high-level goal (e.g., INTENT_ATTACK)
        intentUtilityScores: {}, // Stores calculated scores for each intent like { ATTACK: 75, DEFEND: 30, REPOSITION: 40 }
        aiDecisionTimer: 0, // Timer to control how often AI re-evaluates intents
        aiDecisionInterval: 30 // Re-evaluate intents every 30 game ticks (approx 0.5 seconds)
    };
}

// --- setupInputListeners, handleKeyDown, handleKeyUp (no changes) ---
function setupInputListeners() { /* ... */ }
function handleKeyDown(event) { /* ... */ }
function handleKeyUp(event) { /* ... */ }
function updatePlayerAnimations() { /* ... */ }

// --- updateGame, updateClouds, updateSun, updateSpectators (no changes) ---
function updateGame() { /* ... */ }
function updateClouds() { /* ... */ }
function updateSun() { /* ... */ }
function getCurrentSunColor() { /* ... */ }
function updateSpectators() { /* ... */ }

// --- updatePlayerStates (no changes from previous version with enhanced roll/stability) ---
function updatePlayerStates() { /* ... */ }
// --- handleHumanPlayerControls (no changes from previous version with air control) ---
function handleHumanPlayerControls() { /* ... */ }
// --- updateAIPlayers, executeAIPlayerLogic (MODIFIED for Utility AI) ---
function updateAIPlayers() {
    players.filter(p => p.isAI).forEach(player => {
        player.aiDecisionTimer = (player.aiDecisionTimer || 0) + 1;
        if (player.aiDecisionTimer >= player.aiDecisionInterval) {
            player.aiDecisionTimer = 0;
            // It's time to re-evaluate intents and decide the current one
            const humanPlayer = players.find(p => !p.isAI);
            const opponentGoalPosition = player.playerTeam === 1 ? // AI is Team 1, attacks Right Goal
                { x: CANVAS_WIDTH - WALL_THICKNESS - GOAL_MOUTH_VISUAL_WIDTH / 2, y: CANVAS_HEIGHT - GROUND_THICKNESS - (GOAL_HEIGHT - CROSSBAR_THICKNESS) / 2 } :
                { x: WALL_THICKNESS + GOAL_MOUTH_VISUAL_WIDTH / 2, y: CANVAS_HEIGHT - GROUND_THICKNESS - (GOAL_HEIGHT - CROSSBAR_THICKNESS) / 2 };
            const ownGoalPosition = player.playerTeam === 1 ? // AI is Team 1, defends Left Goal
                { x: WALL_THICKNESS + GOAL_MOUTH_VISUAL_WIDTH / 2, y: CANVAS_HEIGHT - GROUND_THICKNESS - (GOAL_HEIGHT - CROSSBAR_THICKNESS) / 2 } :
                { x: CANVAS_WIDTH - WALL_THICKNESS - GOAL_MOUTH_VISUAL_WIDTH / 2, y: CANVAS_HEIGHT - GROUND_THICKNESS - (GOAL_HEIGHT - CROSSBAR_THICKNESS) / 2 };

            const gameState = {
                ball: ball, // The global ball object
                humanPlayer: humanPlayer,
                aiPlayer: player,
                opponentGoalPosition: opponentGoalPosition,
                ownGoalPosition: ownGoalPosition,
                allPlayers: players,
                gameTimeRemaining: gameTimeRemaining,
                currentIntent: player.currentIntent // Pass current intent for context in utility functions if needed
            };

            let bestIntent = null;
            let maxScore = -Infinity;

            for (const intentKey in aiIntents) {
                const intent = aiIntents[intentKey];
                let utilityScore = intent.calculateUtility(gameState, player);

                // Phase 2: Add small random factor
                const randomFactor = (Math.random() - 0.5) * (utilityScore * 0.1); // +/- 5% of score
                utilityScore += randomFactor;

                player.intentUtilityScores[intent.name] = utilityScore;

                if (utilityScore > maxScore) {
                    maxScore = utilityScore;
                    bestIntent = intent.name;
                }
            }
            player.currentIntent = bestIntent;
            /* // Debug log - can be removed after testing
            if (player.playerTeam === 2) { // Assuming AI is player 2 for logging
                console.log(`AI Team ${player.playerTeam} Intent: ${player.currentIntent} | Scores: A:${player.intentUtilityScores[INTENT_ATTACK]?.toFixed(0)}, D:${player.intentUtilityScores[INTENT_DEFEND]?.toFixed(0)}, R:${player.intentUtilityScores[INTENT_REPOSITION]?.toFixed(0)} | BallY: ${ball?.position.y.toFixed(0)} AiY: ${player.playerBody.position.y.toFixed(0)}`);
            }
            */
        }

        // Execute logic based on current intent (even if not re-evaluated this frame)
        if (player.currentIntent) {
            executeAIPlayerLogic(player);
        }
    });
}

function executeAIPlayerLogic(player) {
    if (!ball || player.actionCooldown > 0) {
        if (player.actionCooldown > 0) player.actionCooldown--;
        return;
    }

    const aiPos = player.playerBody.position;
    const ballPos = ball.position;
    const humanPlayer = players.find(p => !p.isAI);
    const opponentGoalX = player.playerTeam === 1 ? CANVAS_WIDTH - WALL_THICKNESS : WALL_THICKNESS;
    const ownGoalX = player.playerTeam === 1 ? WALL_THICKNESS : CANVAS_WIDTH - WALL_THICKNESS;
    const { actualGoalOpeningHeight } = getFieldDerivedConstants();
    const goalCenterY = CANVAS_HEIGHT - GROUND_THICKNESS - actualGoalOpeningHeight / 2;

    let targetX = aiPos.x;
    let targetY = aiPos.y; // AI will try to maintain some Y position unless specific action dictates otherwise
    let shouldJump = false;
    let shouldKick = false;

    // --- Logic based on Current Intent ---
    switch (player.currentIntent) {
        case INTENT_ATTACK:
            targetX = ballPos.x;
            // Try to position slightly behind the ball relative to opponent goal
            if (opponentGoalX > ballPos.x) { // Attacking right goal
                targetX = ballPos.x - PLAYER_RECT_SIZE * 0.6;
            } else { // Attacking left goal
                targetX = ballPos.x + PLAYER_RECT_SIZE * 0.6;
            }
            targetY = ballPos.y - PLAYER_RECT_SIZE * 0.3; // Try to be slightly above the ball's center

            // Simple jump logic for attack: if ball is higher and AI is grounded
            if (ballPos.y < aiPos.y - PLAYER_RECT_SIZE * 0.5 && player.isGrounded && player.jumpCooldown === 0) {
                shouldJump = true;
            }
            // Kick if in range
            const distToBall = Matter.Vector.magnitude(Matter.Vector.sub(aiPos, ballPos));
            if (distToBall < AI_KICK_BALL_RANGE) {
                shouldKick = true;
            }
            break;

        case INTENT_DEFEND:
            // Try to position between ball and own goal
            targetX = (ballPos.x + ownGoalX) / 2;
            targetY = ballPos.y - PLAYER_RECT_SIZE * 0.2; // Stay a bit above ball to intercept

            // If human player has the ball and is moving towards goal, try to intercept human
            if (humanPlayer) {
                const humanPlayerPos = humanPlayer.playerBody.position;
                const distHumanToBall = Matter.Vector.magnitude(Matter.Vector.sub(humanPlayerPos, ballPos));
                if (distHumanToBall < PLAYER_RECT_SIZE * 2) { // If human is close to ball
                    // Intercept human path to goal
                     targetX = (humanPlayerPos.x + ownGoalX) / 2;
                     targetY = humanPlayerPos.y;
                }
            }
            // Defensive jump if ball is high and near goal
            if (ballPos.y < aiPos.y - PLAYER_RECT_SIZE * 0.3 &&
                Math.abs(ballPos.x - ownGoalX) < CANVAS_WIDTH / 3 && // Ball is in defensive third
                player.isGrounded && player.jumpCooldown === 0) {
                shouldJump = true;
            }
             // Defensive kick/clearance if near ball and facing away from own goal
            const distToBallDef = Matter.Vector.magnitude(Matter.Vector.sub(aiPos, ballPos));
            if (distToBallDef < AI_KICK_BALL_RANGE * 1.2) { // Slightly larger range for defensive clearance
                 const向OpponentGoal = Math.sign(opponentGoalX - aiPos.x);
                 const currentFacing = Math.sign(player.playerBody.velocity.x) || (player.currentFace === 0 ? 1 : -1) * (player.playerTeam === 1 ? 1 : -1); // Simplified facing
                 if (向OpponentGoal === currentFacing || player.isGrounded) { // Kick if facing opponent or on ground
                    shouldKick = true;
                 }
            }
            break;

        case INTENT_REPOSITION:
            // Move towards a general central field position, or slightly biased to own half.
            targetX = CANVAS_WIDTH / 2;
            if (player.playerTeam === 1) { // Team 1 (left side)
                targetX = CANVAS_WIDTH * 0.4;
            } else { // Team 2 (right side)
                targetX = CANVAS_WIDTH * 0.6;
            }
            // Maintain a certain height, e.g., ground level or slightly above
            targetY = CANVAS_HEIGHT - GROUND_THICKNESS - PLAYER_RECT_SIZE / 2 - 10;

            // If ball is slowly rolling towards AI, might consider a gentle touch or just position
            const ballSpeed = Matter.Vector.magnitude(ball.velocity);
            const distToBallRepo = Matter.Vector.magnitude(Matter.Vector.sub(aiPos, ballPos));
            if(distToBallRepo < AI_KICK_BALL_RANGE * 1.5 && ballSpeed < 3 && ballSpeed > 0.5) {
                // Potentially a very light kick or just let it come
                // For now, no kick action in reposition, focus on movement
            }
            break;
        default: // No intent, or unknown intent
            targetX = aiPos.x; // Stay put
            break;
    }

    // --- Execute Actions ---
    // Movement
    const moveDirection = Math.sign(targetX - aiPos.x);
    if (moveDirection !== 0) {
        const force = moveDirection * AI_MOVE_FORCE * (player.isGrounded ? 1 : PLAYER_AIR_CONTROL_FACTOR * 0.7);
        Body.applyForce(player.playerBody, player.playerBody.position, { x: force, y: 0 });
        player.currentFace = moveDirection > 0 ? 0 : 1; // 0 for right, 1 for left
    }

    // Jumping
    if (shouldJump && player.isGrounded && player.jumpCooldown === 0) {
        const jumpForce = PLAYER_MAX_JUMP_IMPULSE * 0.85; // AI jumps slightly less than max human
        Body.applyForce(player.playerBody, player.playerBody.position, { x: 0, y: -jumpForce });
        player.isGrounded = false;
        player.jumpCooldown = PLAYER_JUMP_COOLDOWN_FRAMES;
        player.lastJumpTime = Date.now();
        playSound('jump.wav');
    }
    if (player.jumpCooldown > 0) player.jumpCooldown--;


    // Kicking (using existing advanced kick logic for now, but triggered by intent)
    if (shouldKick && player.actionCooldown === 0) {
        const kickOrigin = player.playerBody.position;
        let kickForceMagnitude = AI_KICK_ATTEMPT_STRENGTH;
        let kickTargetPos = { x: opponentGoalX, y: goalCenterY - actualGoalOpeningHeight * 0.1 + (Math.random() * actualGoalOpeningHeight * 0.3) };

        // Simplified kick direction based on intent for now
        // More advanced kicking (dribbling, smart jump shots) will be in Phase 2
        if (player.currentIntent === INTENT_DEFEND) {
            // Defensive clear: aim towards center field or opponent side, high up
            kickTargetPos.x = CANVAS_WIDTH / 2 + (opponentGoalX - CANVAS_WIDTH/2) * 0.5; // Mid of opponent half
            kickTargetPos.y = CANVAS_HEIGHT / 4; // High clearance
            kickForceMagnitude *= 0.9;
        }

        let kickVector = Matter.Vector.sub(kickTargetPos, kickOrigin);
        kickVector = Matter.Vector.normalise(kickVector);

        // Loft adjustment for AI kicks, less extreme than human jump shots initially
        if (!player.isGrounded) { // Air shot
            kickVector.y = Math.min(kickVector.y, -0.6 - Math.random() * 0.2);
            kickForceMagnitude *= 1.1;
        } else { // Ground shot
            kickVector.y = Math.min(kickVector.y, -0.4 - Math.random() * 0.2);
        }
        kickVector = Matter.Vector.normalise(kickVector);

        Body.applyForce(ball, kickOrigin, { x: kickVector.x * kickForceMagnitude, y: kickVector.y * kickForceMagnitude });
        playSound('kick.wav');
        player.actionCooldown = PLAYER_ACTION_COOLDOWN_FRAMES;
    }
    if (player.actionCooldown > 0) player.actionCooldown--;
}


// --- perpDistToLine (ensure this helper function exists) ---
function perpDistToLine(p1, p2, p3) {
    const dx = p2.x - p1.x; const dy = p2.y - p1.y;
    if (dx === 0 && dy === 0) return Matter.Vector.magnitude(Matter.Vector.sub(p3,p1));
    const t = ((p3.x - p1.x) * dx + (p3.y - p1.y) * dy) / (dx * dx + dy * dy);
    let cp;
    if (t < 0) cp = p1;
    else if (t > 1) cp = p2;
    else cp = { x: p1.x + t * dx, y: p1.y + t * dy };
    return Matter.Vector.magnitude(Matter.Vector.sub(p3, cp));
}

// --- handleGoalScored, checkWinCondition, resetPositions (no changes) ---
let goalScoredRecently = false;
function handleGoalScored(scoringTeam) { /* ... */ }
function checkWinCondition() { /* ... */ }
function resetPositions() { /* ... */ }


// --- handleCollisions (NEW VERSION for new posts and sensors) ---
function handleCollisions(event) {
    if (!isGameStarted || isGameOver) return;
    if (isGameOver && goalScoredRecently) return;

    const pairs = event.pairs;
    const { actualGoalOpeningHeight } = getFieldDerivedConstants();
    const opponentGoalX_P1 = CANVAS_WIDTH - WALL_THICKNESS; // Player 1 attacks right goal
    const opponentGoalX_P2 = WALL_THICKNESS; // Player 2 (AI) attacks left goal
    const goalCenterY = CANVAS_HEIGHT - GROUND_THICKNESS - actualGoalOpeningHeight / 2;


    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;
        let ballBody = null;
        let otherBody = null;
        let playerCollidedObject = null; // The player object from our `players` array
        let playerPhysicsBody = null;   // The actual Matter.js body of the player

        if (bodyA.label === 'ball') {
            ballBody = bodyA; otherBody = bodyB;
        } else if (bodyB.label === 'ball') {
            ballBody = bodyB; otherBody = bodyA;
        }

        if (ballBody && otherBody) {
            // Check if ball collided with a player
            for (const p of players) {
                if (otherBody === p.playerBody) {
                    playerCollidedObject = p;
                    playerPhysicsBody = otherBody;
                    break;
                }
            }

            if (playerCollidedObject) { // Ball hit a player
                let kickForce = KICK_FORCE_MAGNITUDE;
                let kickAngleFactorY = -0.7;
                let isTimedShot = (Date.now() - playerCollidedObject.lastJumpTime) < 200 && playerCollidedObject.lastJumpTime !== 0;
                if (isTimedShot) {
                    kickForce *= TIMED_JUMP_SHOT_BONUS_FACTOR;
                    kickAngleFactorY *= JUMP_SHOT_LOFT_FACTOR;
                }

                const kickOrigin = playerPhysicsBody.position;
                const ownGoalX = playerCollidedObject.playerTeam === 1 ? WALL_THICKNESS : CANVAS_WIDTH - WALL_THICKNESS;
                const opponentGoalX = playerCollidedObject.playerTeam === 1 ? opponentGoalX_P1 : opponentGoalX_P2;
                let kickTargetPos = { x: opponentGoalX, y: goalCenterY };

                if (playerCollidedObject.isAI) {
                    // --- ADVANCED AI SHOOTING LOGIC ---
                    const aiPlayerPos = playerPhysicsBody.position;
                    const targetGoalPos = { x: opponentGoalX, y: goalCenterY };
                    const ownGoalPos = { x: ownGoalX, y: goalCenterY };
                    let humanPlayerObstacle = null;
                    const humanPlayer = players.find(p => !p.isAI);

                    if (humanPlayer) {
                        const humanPlayerPos = humanPlayer.playerBody.position;
                        const vecAiToGoal = Matter.Vector.sub(targetGoalPos, aiPlayerPos);
                        const vecAiToHuman = Matter.Vector.sub(humanPlayerPos, aiPlayerPos);
                        if (Matter.Vector.dot(vecAiToGoal, vecAiToHuman) > 0 &&
                            Matter.Vector.magnitudeSquared(vecAiToHuman) < Matter.Vector.magnitudeSquared(vecAiToGoal)) {
                            const distToPath = perpDistToLine(aiPlayerPos, targetGoalPos, humanPlayerPos);
                            if (distToPath < PLAYER_RECT_SIZE * 1.2 && Math.abs(humanPlayerPos.y - aiPlayerPos.y) < PLAYER_RECT_SIZE * 1.5) {
                                humanPlayerObstacle = humanPlayer;
                            }
                        }
                    }

                    const ballToOwnGoalVector = Matter.Vector.sub(ownGoalPos, ballBody.position);
                    const playerToBallVector = Matter.Vector.sub(ballBody.position, aiPlayerPos);
                    const kickTowardsOwnGoalAngleThreshold = Math.PI / 2.5;
                    const angleToOwnGoal = Matter.Vector.angle(playerToBallVector, ballToOwnGoalVector);
                    let isOwnGoalRisk = false;
                    if (aiPlayerPos.x > ballBody.position.x && ownGoalPos.x > aiPlayerPos.x && Math.abs(angleToOwnGoal) > Math.PI - kickTowardsOwnGoalAngleThreshold) {
                        isOwnGoalRisk = true;
                    } else if (aiPlayerPos.x < ballBody.position.x && ownGoalPos.x < aiPlayerPos.x && Math.abs(angleToOwnGoal) < kickTowardsOwnGoalAngleThreshold) {
                        isOwnGoalRisk = true;
                    }

                    let kickVector;
                    let shotType = ""; // For logging

                    if (isOwnGoalRisk && Matter.Vector.magnitude(ballToOwnGoalVector) < CANVAS_WIDTH / 2.5) { // Increased range for own goal safety
                        shotType = "OWN GOAL CLEARANCE";
                        kickTargetPos = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 4 };
                        if (aiPlayerPos.x < CANVAS_WIDTH / 2) kickTargetPos.x = CANVAS_WIDTH * 0.75;
                        else kickTargetPos.x = CANVAS_WIDTH * 0.25;
                        kickVector = Matter.Vector.normalise(Matter.Vector.sub(kickTargetPos, aiPlayerPos));
                        kickVector.y = Math.min(kickVector.y, -0.9); // Very high clearance
                        kickForce *= 0.85;
                    } else if (humanPlayerObstacle) {
                        const distanceToObstacle = Matter.Vector.magnitude(Matter.Vector.sub(humanPlayerObstacle.playerBody.position, aiPlayerPos));
                        const obstacleIsVeryClose = distanceToObstacle < PLAYER_RECT_SIZE * 1.8; // Adjusted threshold
                        const canChipOver = humanPlayerObstacle.playerBody.position.y > aiPlayerPos.y - PLAYER_RECT_SIZE * 0.3;

                        if (obstacleIsVeryClose && canChipOver && Math.random() < 0.5) {
                            shotType = "CHIP SHOT";
                            kickForce *= 0.75;
                            kickTargetPos = { x: targetGoalPos.x, y: targetGoalPos.y - actualGoalOpeningHeight * 0.35 };
                            kickVector = Matter.Vector.normalise(Matter.Vector.sub(kickTargetPos, aiPlayerPos));
                            kickVector.y = -0.85 - (Math.random() * 0.15);
                            kickVector.x *= (0.4 + Math.random() * 0.2);
                        } else {
                            shotType = "CURVED SHOT";
                            kickForce *= 0.9;
                            const curveDirection = Math.sign(targetGoalPos.x - humanPlayerObstacle.playerBody.position.x) || (Math.random() < 0.5 ? -1 : 1);
                            const curveMagnitude = actualGoalOpeningHeight * (0.35 + Math.random() * 0.25);
                            kickTargetPos = {
                                x: targetGoalPos.x,
                                y: targetGoalPos.y - actualGoalOpeningHeight * 0.1 + curveDirection * curveMagnitude
                            };
                            kickVector = Matter.Vector.normalise(Matter.Vector.sub(kickTargetPos, aiPlayerPos));
                            kickVector.y = -0.6 - Math.random() * 0.3;
                            Body.applyForce(ballBody, kickOrigin, { x: kickVector.x * kickForce, y: kickVector.y * kickForce });

                            const spinForce = KICK_FORCE_MAGNITUDE * (0.4 + Math.random() * 0.25);
                            const spinApplicationPoint = {
                                x: ballBody.position.x + curveDirection * BALL_RADIUS * 0.7, // Apply further to edge
                                y: ballBody.position.y + BALL_RADIUS * (Math.random() * 0.4 - 0.2) // Add some y variation
                            };
                            const spinDirectionVector = {x:0, y: -curveDirection * spinForce}; // Simpler spin vector
                            Body.applyForce(ballBody, spinApplicationPoint, spinDirectionVector);
                            playSound('kick.wav');
                            console.log(`AI Kick: ${shotType} executed.`);
                            return;
                        }
                    } else {
                        shotType = "POWER SHOT";
                        kickForce *= 1.2;
                        const distanceToGoal = Matter.Vector.magnitude(Matter.Vector.sub(targetGoalPos, aiPlayerPos));
                        let targetYOffset = (Math.random() - 0.5) * actualGoalOpeningHeight * 0.5;
                        kickTargetPos = { x: targetGoalPos.x, y: targetGoalPos.y + targetYOffset };
                        kickVector = Matter.Vector.normalise(Matter.Vector.sub(kickTargetPos, aiPlayerPos));
                        if (distanceToGoal < CANVAS_WIDTH / 3.5) {
                            kickVector.y = Math.min(kickVector.y, -0.3 - Math.random() * 0.15);
                        } else {
                            kickVector.y = Math.min(kickVector.y, -0.5 - Math.random() * 0.25);
                        }
                    }
                    console.log(`AI Kick: ${shotType} (Target: ${kickTargetPos.x.toFixed(0)},${kickTargetPos.y.toFixed(0)})`);
                    kickVector = Matter.Vector.normalise(kickVector);
                    Body.applyForce(ballBody, kickOrigin, { x: kickVector.x * kickForce, y: kickVector.y * kickForce });
                    playSound('kick.wav');
                    return;
                    // --- END OF ADVANCED AI SHOOTING LOGIC ---
                } else { // Human player
                    if (isTimedShot) {
                        kickAngleFactorY = -0.8 * JUMP_SHOT_LOFT_FACTOR;
                        kickForce *= 1.1;
                    } else {
                        kickAngleFactorY = -0.5 - Math.random() * 0.3;
                    }
                    kickTargetPos.y = goalCenterY - (actualGoalOpeningHeight * 0.25) + (Math.random() * actualGoalOpeningHeight * 0.5);
                    let kickVector = Matter.Vector.sub(kickTargetPos, kickOrigin);
                    kickVector = Matter.Vector.normalise(kickVector);
                    kickVector.y = Math.min(kickAngleFactorY, kickVector.y * Math.sign(kickAngleFactorY));
                    kickVector = Matter.Vector.normalise(kickVector);
                    playSound('kick.wav');
                    Body.applyForce(ballBody, kickOrigin, { x: kickVector.x * kickForce, y: kickVector.y * kickForce });
                }
            } else { // Ball hit something other than a player
                // Goal scored by hitting the sensor
                if (otherBody.label === 'goal-left-sensor') {
                    handleGoalScored(2); // Team 2 scores
                } else if (otherBody.label === 'goal-right-sensor') {
                    handleGoalScored(1); // Team 1 scores
                }
                // Ball hit a physical post
                else if (otherBody.label.startsWith('post-')) {
                    playSound('post_hit.wav');
                    // --- START: Trigger Post Shake Effect ---
                    if (!otherBody.isShaking) {
                        otherBody.isShaking = true;
                        otherBody.shakeStartTime = engine.timing.timestamp;
                        otherBody.shakeDuration = 250; // ms
                        otherBody.shakeIntensity = 1.0 / PIXEL_SCALE; // Intensity in pixelCanvas units
                        console.log(`Shaking post: ${otherBody.label} at ${otherBody.shakeStartTime}`);
                    }
                    // --- END: Trigger Post Shake Effect ---
                }
                // Ball hit wall or ceiling
                else if (otherBody.label.includes('wall') || otherBody.label.includes('ceiling')) {
                    if (Matter.Vector.magnitude(ballBody.velocity) > 1.5) {
                        playSound('ball_hit_wall.wav');
                        spawnParticles(pair.collision.supports[0].x, pair.collision.supports[0].y, 4, '#DDDDDD', pair.collision.normal.x * 0.5, pair.collision.normal.y * 0.5, 1.5, 15, 1);
                    }
                }
            }
        }
        // Player grounded check (no changes)
        players.forEach(player => { /* ... */ });
    }
}

// --- Rendering Functions (drawPlayer, drawPixelIsoRectangle, shadeColor, drawCloud, drawSpectator, drawStadiumLight, drawInGameScoreboard, drawPixelText, drawPixelIsoCircle) ---
// drawCloud was updated previously. Other drawing functions are assumed to be fine unless specified.
function drawPlayer(pCtx, body, playerColor) { /* ... (no changes) ... */ }
function drawPixelIsoRectangle(pCtx, body, colorOverride = null) { /* ... (no changes, includes new grass) ... */ }
function shadeColor(color, percent) { /* ... (no changes) ... */ }
function drawCloud(cloud) { /* ... (new fluffy clouds) ... */ }
function drawSpectator(spectator) { /* ... (no changes, but not rendered) ... */ }
function drawStadiumLight(light) { /* ... (no changes) ... */ }
function drawInGameScoreboard() { /* ... (new top-left scoreboard) ... */ }
function drawPixelText(x, y, text, pixelSize) { /* ... (no changes) ... */ }
function drawPixelIsoCircle(pCtx, body, colorOverride = null) { /* ... (no changes) ... */ }


// --- customRenderAll (Goal rendering part needs to be updated if physical posts are used) ---
function customRenderAll() {
    // Sky, lights, clouds, sun (no changes)
    /* ... */
    const currentSunColor = getCurrentSunColor();
    const gradient = pixelCtx.createLinearGradient(0, 0, 0, PIXEL_CANVAS_HEIGHT);
    let skyTop, skyMid, skyBottom;
    if (currentSunColor === SUN_COLORS.dawn || currentSunColor === SUN_COLORS.evening) {
        skyTop = '#FF6B6B'; skyMid = '#FFD93D'; skyBottom = '#87CEEB';
    } else if (currentSunColor === SUN_COLORS.night) {
        skyTop = '#191970'; skyMid = '#000033'; skyBottom = '#191970';
    } else {
        skyTop = shadeColor(activeTheme.skyColor, 0.2);
        skyMid = activeTheme.skyColor;
        skyBottom = shadeColor(activeTheme.skyColor, -0.3);
    }
    gradient.addColorStop(0, skyTop); gradient.addColorStop(0.6, skyMid); gradient.addColorStop(1, skyBottom);
    pixelCtx.fillStyle = gradient;
    pixelCtx.fillRect(0, 0, PIXEL_CANVAS_WIDTH, PIXEL_CANVAS_HEIGHT);
    stadiumLights.forEach(light => drawStadiumLight(light));
    // spectators.forEach(spectator => drawSpectator(spectator)); // Spectators removed
    clouds.forEach(cloud => drawCloud(cloud));
    // Sun rendering code... (no changes)
    /* ... */

    // Render all static bodies (ground, walls, AND posts with potential shake)
    const allStaticBodies = Composite.allBodies(world).filter(b => b.isStatic && !b.isSensor);
    allStaticBodies.forEach(body => {
        if (body.render.visible === false) return; // Skip explicitly invisible bodies

        let renderX = body.position.x;
        let renderY = body.position.y;

        if (body.label.startsWith('post-') && body.isShaking) {
            const elapsedTime = engine.timing.timestamp - body.shakeStartTime;
            if (elapsedTime < body.shakeDuration) {
                const progress = elapsedTime / body.shakeDuration;
                const diminishingIntensity = body.shakeIntensity * (1 - Math.pow(progress, 2)); // Intensity decreases more rapidly

                // Apply shake offset
                renderX += (Math.random() - 0.5) * 2 * diminishingIntensity;
                renderY += (Math.random() - 0.5) * 2 * diminishingIntensity * 0.5; // Less vertical shake
            } else {
                body.isShaking = false; // End shake
            }
        }

        // Determine dimensions for rendering (this part might need to be more robust)
        // For posts, use their specific dimensions. For others, use bounds from drawPixelIsoRectangle if needed.
        let pWidth, pHeight;
        if (body.label.startsWith('post-')) {
            pWidth = (body.label.includes('-h-') ? GOAL_MOUTH_VISUAL_WIDTH : physicalPostThickness) / PIXEL_SCALE;
            pHeight = (body.label.includes('-h-') ? CROSSBAR_THICKNESS : (GOAL_HEIGHT - CROSSBAR_THICKNESS)) / PIXEL_SCALE;
        } else if (body.label === 'ground') {
            pWidth = CANVAS_WIDTH / PIXEL_SCALE; pHeight = GROUND_THICKNESS / PIXEL_SCALE;
        } else if (body.label.includes('wall')) {
            pWidth = WALL_THICKNESS / PIXEL_SCALE; pHeight = CANVAS_HEIGHT / PIXEL_SCALE;
        } else if (body.label === 'ceiling') {
            pWidth = CANVAS_WIDTH / PIXEL_SCALE; pHeight = WALL_THICKNESS / PIXEL_SCALE;
        } else { // Fallback for other static bodies if any
            const boundsWidth = (body.bounds.max.x - body.bounds.min.x) / PIXEL_SCALE;
            const boundsHeight = (body.bounds.max.y - body.bounds.min.y) / PIXEL_SCALE;
            pWidth = Math.max(1, Math.round(boundsWidth));
            pHeight = Math.max(1, Math.round(boundsHeight));
        }

        const pX = renderX / PIXEL_SCALE;
        const pY = renderY / PIXEL_SCALE;

        pixelCtx.save();
        pixelCtx.translate(pX, pY);
        pixelCtx.rotate(body.angle); // Ensure rotation is applied if posts can rotate (though they are static)
        pixelCtx.fillStyle = body.render.fillStyle || (body.label.startsWith('post-') ? goalPostRenderStyle.fillStyle : '#333');

        // Simplified rectangle fill for all static objects for consistency here
        // The complex iso-rectangle drawing can be re-integrated if needed
        pixelCtx.fillRect(-pWidth / 2, -pHeight / 2, pWidth, pHeight);

        if (body.render.strokeStyle && body.label.startsWith('post-')) { // Optional: add stroke to posts
            pixelCtx.strokeStyle = body.render.strokeStyle;
            pixelCtx.lineWidth = body.render.lineWidth / PIXEL_SCALE || 1;
            pixelCtx.strokeRect(-pWidth / 2, -pHeight / 2, pWidth, pHeight);
        }
        pixelCtx.restore();

    });
    
    // Render dynamic bodies (players, ball)
    if(ball && ball.render.visible !== false) drawPixelIsoCircle(pixelCtx, ball, BALL_PANEL_COLOR_PRIMARY);
    players.forEach(p => {
        if (p.playerBody.render.visible !== false) drawPlayer(pixelCtx, p.playerBody, p.color);
    });

    particles.forEach(particle => { /* ... (no changes) ... */ });

    // --- Goal Net Rendering (Simplified, to be drawn behind players/ball but in front of far background) ---
    // This part needs to be carefully placed in the Z-order.
    // It should visually connect to the physical posts.
    const netColor = activeTheme.net || 'rgba(200, 200, 200, 0.6)';
    const postThickness = Math.max(1, Math.round(physicalPostThickness / PIXEL_SCALE / 2)); // Visual thickness based on physical
    const goalPixelH = Math.round(goalOpeningActualHeight / PIXEL_SCALE);
    const goalPixelMW = Math.round(GOAL_MOUTH_VISUAL_WIDTH / PIXEL_SCALE);
    const goalPixDepth = Math.round((GOAL_MOUTH_VISUAL_WIDTH * 0.5) / PIXEL_SCALE); // Visual depth
    const gndY = Math.round((CANVAS_HEIGHT - GROUND_THICKNESS) / PIXEL_SCALE);
    const goalTY = gndY - goalPixelH;

    pixelCtx.strokeStyle = netColor;
    pixelCtx.lineWidth = Math.max(1, Math.round(1 / PIXEL_SCALE));

    [-1, 1].forEach(side => { // -1 for left goal, 1 for right goal
        const startX = (side === -1) ?
            Math.round(WALL_THICKNESS / PIXEL_SCALE) + postThickness :
            Math.round((CANVAS_WIDTH - WALL_THICKNESS - GOAL_MOUTH_VISUAL_WIDTH) / PIXEL_SCALE) + postThickness;
        const endX = startX + goalPixelMW - 2 * postThickness;

        const backYTop = goalTY + goalPixDepth * 0.3;
        const backYBottom = gndY - goalPixDepth * 0.1;
        const backXStart = startX + goalPixDepth * 0.7;
        const backXEnd = endX - goalPixDepth * 0.7;

        // Top and bottom back net lines
        pixelCtx.beginPath(); pixelCtx.moveTo(backXStart, backYTop); pixelCtx.lineTo(backXEnd, backYTop); pixelCtx.stroke();
        pixelCtx.beginPath(); pixelCtx.moveTo(backXStart, backYBottom); pixelCtx.lineTo(backXEnd, backYBottom); pixelCtx.stroke();
        // Side back net lines
        pixelCtx.beginPath(); pixelCtx.moveTo(backXStart, backYTop); pixelCtx.lineTo(backXStart, backYBottom); pixelCtx.stroke();
        pixelCtx.beginPath(); pixelCtx.moveTo(backXEnd, backYTop); pixelCtx.lineTo(backXEnd, backYBottom); pixelCtx.stroke();

        for(let i = 1; i < 5; i++) { // Horizontal net lines
            const t = i/5;
            pixelCtx.beginPath();
            pixelCtx.moveTo(startX, goalTY + t * goalPixelH);
            pixelCtx.lineTo(backXStart + t * (backXEnd - backXStart) * 0.1 , backYTop + t * (backYBottom - backYTop)); // Angled
            pixelCtx.lineTo(backXEnd - t * (backXEnd - backXStart) * 0.1, backYTop + t * (backYBottom - backYTop));   // Angled
            pixelCtx.lineTo(endX, goalTY + t * goalPixelH);
            pixelCtx.stroke();
        }
        for(let i = 1; i < 6; i++) { // Vertical net lines
            const t = i/6;
            pixelCtx.beginPath();
            pixelCtx.moveTo(startX + t * (endX-startX), goalTY);
            pixelCtx.lineTo(backXStart + t * (backXEnd-backXStart), backYTop);
            pixelCtx.lineTo(backXStart + t * (backXEnd-backXStart), backYBottom);
            // pixelCtx.lineTo(startX + t * (endX-startX), gndY); // If net goes to ground straight
            pixelCtx.stroke();
        }
    });
    // --- End of Goal Net Rendering ---

    drawInGameScoreboard();
}
// --- gameRenderLoop (with rounded corners, no changes from before) ---
function gameRenderLoop() { /* ... */ }
// --- Particle System (spawnParticles, updateParticles - no changes) ---
function spawnParticles(x,y,count,color,baseVelocityX,baseVelocityY,spread,life,size) { /* ... */ }
function updateParticles() { /* ... */ }

document.addEventListener('DOMContentLoaded', setup);
