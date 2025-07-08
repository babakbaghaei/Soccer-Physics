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

const PIXEL_SCALE = 4;
const PIXEL_CANVAS_WIDTH = CANVAS_WIDTH / PIXEL_SCALE;
const PIXEL_CANVAS_HEIGHT = CANVAS_HEIGHT / PIXEL_SCALE;

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
    { name: "Grass Day", background: '#ACE1AF', ground: '#B8860B', walls: '#808080', ballThemeColor: '#FFFFFF', net: 'rgba(220, 220, 220, 0.6)' },
    { name: "Night Sky", background: '#000033', ground: '#4A3B00', walls: '#555555', ballThemeColor: '#E0E0E0', net: 'rgba(180, 180, 200, 0.5)' },
    { name: "Desert", background: '#FFDAB9', ground: '#D2B48C', walls: '#A0522D', ballThemeColor: '#FAFAFA', net: 'rgba(100, 100, 100, 0.5)' }
];
let currentThemeIndex = -1;
let activeTheme = themes[0];
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

// --- Sound Function ---
function playSound(soundFileName) {
    try {
        const audio = new Audio('sounds/' + soundFileName);
        audio.play().catch(e => console.warn("Sound play failed for "+soundFileName+":", e));
    } catch (e) {
        console.warn(`Could not create Audio for: ${soundFileName}`, e);
    }
}

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
    engine.world.gravity.y = 1.1;
    console.log("SETUP: New engine and world created.");

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
    Events.on(engine, 'collisionStart', handleCollisions);

    if (typeof gameRenderLoopId !== 'undefined') {
        cancelAnimationFrame(gameRenderLoopId);
    }
    gameRenderLoopId = requestAnimationFrame(gameRenderLoop);
    console.log("SETUP: Started new gameRenderLoopId:", gameRenderLoopId);

    updateScoreDisplay();
    updateTimerDisplay();
    showGameMessage("Controls: A/D Move, W Jump. Press W to Start!");
    console.log("SETUP: Complete.");
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
    const ground = Bodies.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT - GROUND_THICKNESS / 2, CANVAS_WIDTH, GROUND_THICKNESS, { isStatic: true, label: 'ground', render: { fillStyle: activeTheme.ground } });
    const leftWall = Bodies.rectangle(WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, label: 'wall-left', render: { fillStyle: activeTheme.walls } });
    const rightWall = Bodies.rectangle(CANVAS_WIDTH - WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, label: 'wall-right', render: { fillStyle: activeTheme.walls } });
    const ceiling = Bodies.rectangle(CANVAS_WIDTH / 2, WALL_THICKNESS / 2, CANVAS_WIDTH, WALL_THICKNESS, { isStatic: true, label: 'ceiling', render: { fillStyle: activeTheme.walls } });

    const { actualGoalOpeningHeight: localActualGoalOpeningHeight } = getFieldDerivedConstants();
    const goalSensorY = CANVAS_HEIGHT - GROUND_THICKNESS - localActualGoalOpeningHeight / 2;

    const goalSensorRenderInvisible = { visible: false };
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
    document.addEventListener('keydown', (event) => {
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(event.code)) {
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
    });
    document.addEventListener('keyup', (event) => {
        keysPressed[event.code] = false;
        const humanPlayer = players.find(p => !p.isAI);
        if (humanPlayer) {
            if (event.code === 'KeyW') {
                humanPlayer.isAttemptingVariableJump = false;
            }
        }
    });
}

function updatePlayerAnimations() {
    // Visual feedback for square rotation/state can be added here later if needed.
}

function updateGame() {
    if (!isGameStarted || isGameOver) return;

    updatePlayerStates();
    handleHumanPlayerControls();
    updateAIPlayers();
    updatePlayerAnimations();
    updateParticles();
}

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
                Body.translate(player.playerBody, { x: player.rollDirection * PLAYER_ROLL_TRANSLATE_SPEED, y: 0 });
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

    if (player.jumpCooldown > 0) player.jumpCooldown--;

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
    const aiGoalX = CANVAS_WIDTH - WALL_THICKNESS;
    const opponentGoalX = WALL_THICKNESS;
    const { actualGoalOpeningHeight } = getFieldDerivedConstants();

    const isBallInAIHalf = ballPos.x > CANVAS_WIDTH / 2;
    let intent = 'pursue_ball';

    if (isBallInAIHalf && distanceToBall > AI_ACTION_RANGE * 1.2 && ballPos.x > CANVAS_WIDTH * 0.65) {
        intent = 'defend_goal_line';
    } else if (isBallInAIHalf && distanceToBall > AI_ACTION_RANGE) {
        intent = 'defensive_positioning';
    } else if (!isBallInAIHalf && playerPos.x > CANVAS_WIDTH * 0.6) {
        intent = 'advance_to_attack';
    }

    switch (intent) {
        case 'defend_goal_line':
            const defensiveTargetXGoalLine = aiGoalX - GOAL_MOUTH_VISUAL_WIDTH * 0.75;
            const directionToTargetXGoalLine = defensiveTargetXGoalLine - playerPos.x;
            if (Math.abs(directionToTargetXGoalLine) > PLAYER_RECT_SIZE / 2) {
                AImoveDirection = Math.sign(directionToTargetXGoalLine);
            }
            break;
        case 'defensive_positioning':
            const idealDefensiveX = ballPos.x + Math.sign(aiGoalX - ballPos.x) * (PLAYER_RECT_SIZE + BALL_RADIUS + 20);
            const finalDefensiveTargetX = Math.max(CANVAS_WIDTH / 2 + WALL_THICKNESS, Math.min(aiGoalX - WALL_THICKNESS - PLAYER_RECT_SIZE, idealDefensiveX));
            const dirToDefTarget = finalDefensiveTargetX - playerPos.x;
            if (Math.abs(dirToDefTarget) > PLAYER_RECT_SIZE / 2) {
                AImoveDirection = Math.sign(dirToDefTarget);
            }
            break;
        case 'advance_to_attack':
            const offensiveMidfieldTargetX = CANVAS_WIDTH / 2 + (Math.random() - 0.5) * (CANVAS_WIDTH * 0.1);
            const dirToAdvanceTarget = offensiveMidfieldTargetX - playerPos.x;
            if (Math.abs(dirToAdvanceTarget) > PLAYER_RECT_SIZE) {
                AImoveDirection = Math.sign(dirToAdvanceTarget);
            }
            break;
        case 'pursue_ball':
        default:
            const dirToBallX = ballPos.x - playerPos.x;
            if (Math.abs(dirToBallX) > BALL_RADIUS + PLAYER_RECT_SIZE / 2 * 0.5 ) {
                AImoveDirection = Math.sign(dirToBallX);
            }
            break;
    }

    if (AImoveDirection !== 0 && !player.isRotating && player.isGrounded) {
        player.isRotating = true;
        player.rollDirection = AImoveDirection;
        const currentAngle = player.playerBody.angle;
        const snappedCurrentAngle = Math.round(currentAngle / (Math.PI / 2)) * (Math.PI / 2);
        player.targetAngle = snappedCurrentAngle + player.rollDirection * (Math.PI / 2);
        Body.setAngularVelocity(player.playerBody, player.rollDirection * PLAYER_ROLL_ANGULAR_VELOCITY_TARGET);
    }


    if (player.jumpCooldown === 0 && distanceToBall < AI_ACTION_RANGE * 1.2 && !player.isRotating) {
        const ballIsHigh = ballPos.y < playerPos.y - PLAYER_RECT_SIZE / 2 * 0.7;

        if ( (ballIsHigh || distanceToBall < AI_KICK_BALL_RANGE * 0.7 || intent === 'defend_goal_line') && player.isGrounded ) {
            player.isGrounded = false;
            player.jumpCooldown = PLAYER_JUMP_COOLDOWN_FRAMES * (1.1 + Math.random()*0.4);
            player.lastJumpTime = Date.now();
            playSound('jump.wav');

            let horizontalActionForceDirection = (playerPos.x < ballPos.x) ? 0.001 : -0.001;
            if (intent === 'defend_goal_line' || intent === 'defensive_positioning') {
                horizontalActionForceDirection = (playerPos.x < opponentGoalX + 100) ? 0.0002 : -0.0002;
            }
            const jumpStrengthFactor = (intent === 'defend_goal_line') ? 1.25 : 0.95;
            const verticalJumpForce = -PLAYER_MAX_JUMP_IMPULSE * jumpStrengthFactor * (0.75 + Math.random() * 0.4) ;
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
        const restartKey = 'W';

        showGameMessage(`${reason} Final Score: ${team1Score}-${team2Score}. Press '${restartKey}' to Play Again.`);
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

                const opponentGoalX = (playerCollidedObject.playerTeam === 1) ? CANVAS_WIDTH - WALL_THICKNESS : WALL_THICKNESS;
                const goalCenterY = CANVAS_HEIGHT - GROUND_THICKNESS - actualGoalOpeningHeight / 2;

                let kickTargetPos = { x: opponentGoalX, y: goalCenterY };
                if(isTimedShot){
                     kickTargetPos.y = goalCenterY - (actualGoalOpeningHeight * 0.05) + (Math.random() * actualGoalOpeningHeight * 0.1);
                } else {
                     kickTargetPos.y = goalCenterY - (actualGoalOpeningHeight * 0.25) + (Math.random() * actualGoalOpeningHeight * 0.5);
                }

                const kickOrigin = playerPhysicsBodyCollided.position;
                let kickVector = Matter.Vector.sub(kickTargetPos, kickOrigin);
                kickVector = Matter.Vector.normalise(kickVector);

                const baseKickXSign = Math.sign(kickVector.x);
                kickVector.y = Math.min(kickAngleFactorY, kickVector.y * Math.sign(kickAngleFactorY));
                kickVector.x = baseKickXSign * (isTimedShot ? (0.8 + Math.random()*0.2) : (0.4 + Math.random()*0.4) );
                kickVector = Matter.Vector.normalise(kickVector);

                playSound('kick.wav');
                Body.applyForce(ballBody, ballBody.position, { x: kickVector.x * kickForce, y: kickVector.y * kickForce });

            } else if (otherBody) {
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
    if (!isGameStarted && !isGameOver) {
        if (keysPressed['KeyW']) {
            console.log("RENDER_LOOP: Key 'W' pressed, starting game.");
            isGameStarted = true;
            showGameMessage('');
            if (runner) {
                Runner.run(runner, engine);
                console.log("RENDER_LOOP: Matter.js Runner started.");
            } else {
                console.error("RENDER_LOOP: Runner not initialized when trying to start game!");
            }
            startGameTimer();
            keysPressed['KeyW'] = false;
        }
        const mainCtx = canvas.getContext('2d');
        mainCtx.fillStyle = activeTheme.background;
        mainCtx.fillRect(0,0,CANVAS_WIDTH, CANVAS_HEIGHT);
    } else if (isGameOver) {
        const restartKey = 'W';
        if (keysPressed[restartKey]) {
            if (!restartDebounce) {
                console.log("RENDER_LOOP: Key pressed, restarting game.");
                restartDebounce = true;
                keysPressed[restartKey] = false;
                if (gameRenderLoopId) cancelAnimationFrame(gameRenderLoopId);
                if (roundTimerId) clearInterval(roundTimerId); roundTimerId = null;
                setup();
                return;
            }
        }
        customRenderAll();
    } else {
        customRenderAll();
    }
    gameRenderLoopId = requestAnimationFrame(gameRenderLoop);
}


// --- Isometric Rendering Constants ---
const ISOMETRIC_ANGLE = Math.PI / 6;
const ISOMETRIC_DEPTH_FACTOR = 0.5;

function drawPixelIsoRectangle(pCtx, body, colorOverride = null) {
    const x = body.position.x / PIXEL_SCALE;
    const y = body.position.y / PIXEL_SCALE;
    let pWidth, pHeight;
    const label = body.label || '';

    if (label.includes('player-t')) {
        pWidth = PLAYER_RECT_SIZE / PIXEL_SCALE;
        pHeight = PLAYER_RECT_SIZE / PIXEL_SCALE;
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
        const darkerGround = shadeColor(color, -0.1);
        const stripeHeight = Math.max(1, Math.round(4 / PIXEL_SCALE));
        for (let i = -pHeight / 2; i < pHeight / 2; i += stripeHeight * 2) {
            pCtx.fillStyle = color;
            pCtx.fillRect(-pWidth / 2, i, pWidth, stripeHeight);
            pCtx.fillStyle = darkerGround;
            pCtx.fillRect(-pWidth / 2, i + stripeHeight, pWidth, stripeHeight);
        }
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
    pixelCtx.fillStyle = activeTheme.background;
    pixelCtx.fillRect(0, 0, PIXEL_CANVAS_WIDTH, PIXEL_CANVAS_HEIGHT);

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
                 drawPixelIsoRectangle(pixelCtx, playerObject.playerBody, playerObject.color);
            }
        }
         else if (body.isStatic) {
             drawPixelIsoRectangle(pixelCtx, body, body.render.fillStyle);
        }
    });

    const goalPostColor = '#FFFFFF';
    const netColor = activeTheme.net;
    const postPixelThickness = Math.max(1, Math.round(8 / PIXEL_SCALE));
    const goalPixelHeight = Math.round(GOAL_HEIGHT / PIXEL_SCALE);
    const goalMouthPixelWidth = Math.round(GOAL_MOUTH_VISUAL_WIDTH / PIXEL_SCALE);
    const goalBaseY = Math.round((CANVAS_HEIGHT - GROUND_THICKNESS) / PIXEL_SCALE);
    const goalTopActualY = goalBaseY - goalPixelHeight;

    const isoDepth = postPixelThickness * ISOMETRIC_DEPTH_FACTOR * 1.5;

    pixelCtx.lineWidth = Math.max(1, Math.round(1 / PIXEL_SCALE));

    // Left Goal
    const leftGoalMouthX = Math.round(WALL_THICKNESS / PIXEL_SCALE);

    pixelCtx.fillStyle = shadeColor(goalPostColor, -0.15);
    pixelCtx.fillRect(leftGoalMouthX + isoDepth, goalTopActualY - isoDepth * 0.5, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(leftGoalMouthX + goalMouthPixelWidth - postPixelThickness + isoDepth, goalTopActualY - isoDepth * 0.5, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(leftGoalMouthX + isoDepth, goalTopActualY - isoDepth * 0.5, goalMouthPixelWidth, postPixelThickness);


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
        const xBackLine = netBackLeftX + (netBackRightX - rgNetBackLeftX) * tBack;
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


    const rightGoalMouthX = PIXEL_CANVAS_WIDTH - Math.round(WALL_THICKNESS / PIXEL_SCALE) - goalMouthPixelWidth;
    pixelCtx.fillStyle = shadeColor(goalPostColor, -0.15);
    pixelCtx.fillRect(rightGoalMouthX + isoDepth, goalTopActualY - isoDepth*0.5, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(rightGoalMouthX + goalMouthPixelWidth - postPixelThickness + isoDepth, goalTopActualY - isoDepth*0.5, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(rightGoalMouthX + isoDepth, goalTopActualY - isoDepth*0.5, goalMouthPixelWidth, postPixelThickness);


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


    const mainCtx = canvas.getContext('2d');
    mainCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    mainCtx.imageSmoothingEnabled = false;
    mainCtx.drawImage(pixelCanvas, 0, 0, PIXEL_CANVAS_WIDTH, PIXEL_CANVAS_HEIGHT, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
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
