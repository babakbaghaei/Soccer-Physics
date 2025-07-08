// --- Matter.js Aliases ---
const Engine = Matter.Engine;
const Render = Matter.Render;
const Runner = Matter.Runner;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Events = Matter.Events;
const Composite = Matter.Composite;
const Constraint = Matter.Constraint;

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
const PLAYER_PART_FRICTION = 0.7;
const PLAYER_PART_RESTITUTION = 0.1;
const PLAYER_DENSITY = 0.003;
const HEAD_RADIUS = 15;
const BODY_WIDTH = 25;
const BODY_HEIGHT = 40;
const LEG_WIDTH = 12;
const LEG_HEIGHT = 38;

// --- Control Constants ---
const PLAYER_JUMP_COOLDOWN_FRAMES = 35;
const PLAYER_MOVE_FORCE = 0.005; // Slightly increased
// const PLAYER_JUMP_FORCE = 0.13; // Unified jump force for main body - Replaced by variable jump
const PLAYER_VARIABLE_JUMP_INITIAL_FORCE = 0.06; // Initial force on key press
const PLAYER_VARIABLE_JUMP_SUSTAINED_FORCE = 0.007; // Force per frame while holding W
const PLAYER_VARIABLE_JUMP_MAX_HOLD_FRAMES = 10;  // Max frames to apply sustained force
const PLAYER_MAX_JUMP_IMPULSE = 0.13; // Cap total jump impulse to something similar to old fixed jump
const COYOTE_TIME_FRAMES = 7; // Frames for coyote time

const KICK_RANGE = 60;
const KICK_FORCE_MAGNITUDE = 0.060; // Slightly stronger base kick
const TIMED_JUMP_SHOT_BONUS_FACTOR = 1.6;
const CROUCH_SHOT_REDUCTION_FACTOR = 0.1;
const JUMP_SHOT_LOFT_FACTOR = 1.6;
const PLAYER_AIR_CONTROL_FACTOR = 0.25; // Reduced further

const AI_ACTION_RANGE = 100;
const AI_MOVE_FORCE = 0.0028;
const AI_KICK_ATTEMPT_STRENGTH = 0.07;
const AI_KICK_BALL_RANGE = KICK_RANGE + 10;
const AI_CROUCH_CHANCE = 0.05;
const AI_TIMED_JUMP_ANTICIPATION_FRAMES = 10;
const AI_BICYCLE_KICK_CHANCE = 0.03;
const PLAYER_ACTION_COOLDOWN_FRAMES = 20; // For AI actions like crouch, bicycle kick recovery


const LANDING_DAMPING_FACTOR = 0.9;
// UPRIGHT_TORQUE_STRENGTH_FACTOR is no longer used due to compound body stability

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
    engine.world.gravity.y = 1.1; // Slightly adjusted gravity
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
    players.push(createPlayer(CANVAS_WIDTH / 4, CANVAS_HEIGHT - GROUND_THICKNESS - LEG_HEIGHT - BODY_HEIGHT/2 , activeTeam1Color, true, false));
    players.push(createPlayer(CANVAS_WIDTH * 3 / 4, CANVAS_HEIGHT - GROUND_THICKNESS - LEG_HEIGHT- BODY_HEIGHT/2, activeTeam2Color, false, true));
    
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
    showGameMessage("Controls: A/D Move, W Jump, S Crouch. Press W to Start!");
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
    const commonOptions = {
        density: PLAYER_DENSITY,
        friction: PLAYER_PART_FRICTION,
        restitution: PLAYER_PART_RESTITUTION,
        render: { fillStyle: teamColor },
        collisionFilter: { group: Body.nextGroup(true) } // Ensure player parts don't collide with each other initially
    };

    // Define parts relative to (0,0) for compound body creation later
    const head = Bodies.circle(0, -(BODY_HEIGHT / 2 + HEAD_RADIUS - 5), HEAD_RADIUS, { ...commonOptions, label: `${playerLabelPrefix}-head`});
    const torso = Bodies.rectangle(0, 0, BODY_WIDTH, BODY_HEIGHT, { ...commonOptions, label: `${playerLabelPrefix}-torso` });

    // Create both leg bodies. Their roles (support/kicking) will be dynamic.
    const leftLegBody = Bodies.rectangle(-BODY_WIDTH / 3, BODY_HEIGHT / 2 + LEG_HEIGHT / 2 -5 , LEG_WIDTH, LEG_HEIGHT, { ...commonOptions, label: `${playerLabelPrefix}-leg-left`, angle: -0.05 });
    const rightLegBody = Bodies.rectangle(BODY_WIDTH / 3, BODY_HEIGHT / 2 + LEG_HEIGHT / 2 -5, LEG_WIDTH, LEG_HEIGHT, { ...commonOptions, label: `${playerLabelPrefix}-leg-right`, angle: 0.05 });

    let supportLeg, kickingLeg;
    let kickingLegSide;

    // Initial leg role assignment (e.g., P1 right kick, P2 left kick)
    if (isTeam1) { // Human player
        supportLeg = leftLegBody;
        kickingLeg = rightLegBody;
        kickingLegSide = 'right';
    } else { // AI player
        supportLeg = rightLegBody; // AI starts with right as support
        kickingLeg = leftLegBody;
        kickingLegSide = 'left';
    }

    // Position the support leg to be part of the main rigid structure, centered under the torso
    // The positions of parts for Body.create are relative to the center of mass of the *final* compound body.
    // It's often easier to position them at (0,0) and then translate the final compound body.
    // For now, we'll adjust supportLeg's position slightly to be centered for the compound body creation.
    Body.setPosition(supportLeg, { x: torso.position.x, y: torso.position.y + BODY_HEIGHT / 2 + LEG_HEIGHT / 2 - 5});
    Body.setAngle(supportLeg, 0); // Support leg straight

    const mainBodyParts = [torso, head, supportLeg];
    const mainBody = Body.create({
        parts: mainBodyParts,
        label: `${playerLabelPrefix}-main`,
        friction: PLAYER_PART_FRICTION,
        restitution: PLAYER_PART_RESTITUTION,
        density: PLAYER_DENSITY
    });
    // Set the mainBody's position to the spawn point
    Body.setPosition(mainBody, { x: x, y: y });
    Body.setAngle(mainBody, 0); // Ensure main body starts upright

    // Position the kicking leg relative to the main body's final position
    const hipOffsetX = (kickingLegSide === 'right' ? BODY_WIDTH / 2.8 : -BODY_WIDTH / 2.8);
    Body.setPosition(kickingLeg, {
        x: mainBody.position.x + hipOffsetX,
        y: mainBody.position.y + BODY_HEIGHT / 2
    });

    const hipConstraint = Constraint.create({
        bodyA: mainBody, // Constraint to the main compound body
        pointA: { x: hipOffsetX, y: BODY_HEIGHT / 2 * 0.8 }, // Hip point on torso part of mainBody
        bodyB: kickingLeg,
        pointB: { x: 0, y: -LEG_HEIGHT / 2 * 0.9 },
        length: LEG_HEIGHT * 0.2,
        stiffness: 0.5,
        damping: 0.1, // Increased damping for better stability
        render: { visible: false }
    });

    World.add(world, [mainBody, kickingLeg, hipConstraint]);

    return {
        mainBody: mainBody,
        head: head, // Reference to original head part
        torso: torso, // Reference to original torso part
        leftLeg_Instance: leftLegBody,
        rightLeg_Instance: rightLegBody,
        kickingLeg: kickingLeg,
        supportLeg: supportLeg,
        hipConstraint: hipConstraint,
        allParts: [head, torso, leftLegBody, rightLegBody], // For rendering logic to find original parts
        playerTeam: isTeam1 ? 1: 2, // Simplified team reference
        color: teamColor,
        actionCooldown: 0, jumpCooldown: 0,
        isAI: isAI,
        isGrounded: false, isCrouching: false, jumpCount: 0,
        animationState: 'idle', animationFrame: 0, animationDuration: 0,
        kickingLegSide: kickingLegSide,
        lastJumpTime: 0,
        // For variable jump
        isAttemptingVariableJump: false,
        variableJumpForceAppliedDuration: 0,
        // For coyote time & jump buffering
        coyoteTimeFramesRemaining: 0,
        jumpInputBuffered: false,
        totalJumpImpulseThisJump: 0,
        wasGrounded: false // For coyote time detection
    };
}

function setupInputListeners() {
    document.addEventListener('keydown', (event) => {
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(event.code)) {
            event.preventDefault();
        }
        keysPressed[event.code] = true;

        // Handle jump buffering on keydown
        const humanPlayer = players.find(p => !p.isAI);
        if (humanPlayer && event.code === 'KeyW' && !humanPlayer.isGrounded && humanPlayer.jumpCooldown === 0 && !humanPlayer.isCrouching) {
            if (humanPlayer.coyoteTimeFramesRemaining <= 0) { // Only buffer if not in coyote time (coyote jump handled in update)
                 humanPlayer.jumpInputBuffered = true;
                 setTimeout(() => { humanPlayer.jumpInputBuffered = false; }, 200); // Buffer for 200ms
            }
        }
    });
    document.addEventListener('keyup', (event) => {
        keysPressed[event.code] = false;
        const humanPlayer = players.find(p => !p.isAI);
        if (humanPlayer) {
            if (event.code === 'KeyS') {
                humanPlayer.isCrouching = false;
                if (humanPlayer.animationState === 'crouching') {
                    humanPlayer.animationState = 'idle';
                }
            }
            if (event.code === 'KeyW') {
                humanPlayer.isAttemptingVariableJump = false; // Stop applying sustained jump force
            }
        }
    });
}

function updatePlayerAnimations() {
    players.forEach(player => {
        if (player.animationDuration > 0) {
            player.animationFrame++;
            if (player.animationFrame >= player.animationDuration) {
                if (player.animationState === 'kicking_execute' || player.animationState === 'bicycle_kick_attempt') {
                    // Kicking leg reference is already direct, no side string here.
                }
                if (player.animationState !== 'crouching' || !player.isCrouching) {
                    player.animationState = 'idle';
                }
                player.animationFrame = 0;
                player.animationDuration = 0;
            }
        }
        if (player.isGrounded && player.animationState === 'jumping' && player.animationDuration === 0) {
            player.animationState = 'idle';
        }
         if (player.isCrouching && player.animationState !== 'crouching' && player.animationState !== 'kicking_execute'  && player.animationState !== 'bicycle_kick_attempt') {
            setPlayerAnimation(player, 'crouching', 2);
        }
    });
}

function updateGame() {
    if (!isGameStarted || isGameOver) return;

    updatePlayerStates(); // Handle coyote time, wasGrounded, etc.
    handleHumanPlayerControls();
    updateAIPlayers();
    updatePlayerAnimations();
    updateParticles();
    // updatePlayerLegRoles(); // TODO: Implement this crucial function

    // players.forEach(player => { // Specific uprighting logic removed for compound body
    // });
}

function updatePlayerStates() {
    players.forEach(player => {
        if (!player.isAI) {
            if (player.wasGrounded && !player.isGrounded && !player.isAttemptingVariableJump && player.mainBody.velocity.y > -0.5) {
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
    });
}

function setPlayerAnimation(player, state, duration, _kickingLegBodyIgnored = null) { // kickingLegBody no longer set here
    player.animationState = state;
    player.animationFrame = 0;
    player.animationDuration = duration;
}

function handleHumanPlayerControls() {
    const player = players[0];
    if (!player || player.isAI) return;

    if (player.jumpCooldown > 0) player.jumpCooldown--;

    // Crouching
    if (keysPressed['KeyS']) {
        player.isCrouching = true;
        if (player.isGrounded && player.animationState !== 'kicking_execute' && player.animationState !== 'bicycle_kick_attempt') {
            setPlayerAnimation(player, 'crouching', 2);
        }
    }
    // Note: KeyS up (isCrouching = false) is handled in setupInputListenerskeyup

    // Movement
    const airControl = player.isGrounded ? 1 : PLAYER_AIR_CONTROL_FACTOR;
    if (player.animationState !== 'kicking_execute' && player.animationState !== 'bicycle_kick_attempt') {
        if (keysPressed['KeyA']) {
            if (!player.isCrouching || !player.isGrounded) {
                 Body.applyForce(player.mainBody, player.mainBody.position, { x: -PLAYER_MOVE_FORCE * airControl, y: 0 });
            }
        }
        if (keysPressed['KeyD']) {
             if (!player.isCrouching || !player.isGrounded) {
                Body.applyForce(player.mainBody, player.mainBody.position, { x: PLAYER_MOVE_FORCE * airControl, y: 0 });
            }
        }
    }

    // Jumping Logic
    const canStartNewJumpAttempt = (player.isGrounded || player.coyoteTimeFramesRemaining > 0);
    const commonJumpConditionsMet = player.jumpCooldown === 0 && !player.isCrouching;

    if (keysPressed['KeyW'] && commonJumpConditionsMet) {
        if (!player.isAttemptingVariableJump && canStartNewJumpAttempt) { // Start of a new jump
            player.isGrounded = false;
            player.coyoteTimeFramesRemaining = 0;
            player.jumpInputBuffered = false; // Consumed buffer if it was used by canStartNewJumpAttempt indirectly
            player.isAttemptingVariableJump = true;
            player.variableJumpForceAppliedDuration = 0;
            player.totalJumpImpulseThisJump = PLAYER_VARIABLE_JUMP_INITIAL_FORCE;

            Body.applyForce(player.mainBody, player.mainBody.position, { x: 0, y: -PLAYER_VARIABLE_JUMP_INITIAL_FORCE });

            player.jumpCooldown = PLAYER_JUMP_COOLDOWN_FRAMES;
            player.lastJumpTime = Date.now();
            setPlayerAnimation(player, 'jumping', 15);
            playSound('jump.wav');

        } else if (player.isAttemptingVariableJump) { // Holding jump key during an ongoing jump
            if (player.variableJumpForceAppliedDuration < PLAYER_VARIABLE_JUMP_MAX_HOLD_FRAMES &&
                player.totalJumpImpulseThisJump < PLAYER_MAX_JUMP_IMPULSE) {

                let forceToApply = PLAYER_VARIABLE_JUMP_SUSTAINED_FORCE;
                if (player.totalJumpImpulseThisJump + forceToApply > PLAYER_MAX_JUMP_IMPULSE) {
                    forceToApply = PLAYER_MAX_JUMP_IMPULSE - player.totalJumpImpulseThisJump;
                }

                if (forceToApply > 0) {
                    Body.applyForce(player.mainBody, player.mainBody.position, { x: 0, y: -forceToApply });
                    player.totalJumpImpulseThisJump += forceToApply;
                }
                player.variableJumpForceAppliedDuration++;
            } else {
                player.isAttemptingVariableJump = false; // Max hold time or max impulse reached
            }
        }
    }
    // KeyW released or not pressed: isAttemptingVariableJump is handled by keyup or if max conditions met.

    // Handle buffered jump if key W is NOT currently pressed (or conditions for new jump weren't met by W press)
    // but was buffered and now player is grounded.
    if (player.jumpInputBuffered && player.isGrounded && commonJumpConditionsMet && !player.isAttemptingVariableJump) {
        // This jump can also become a variable jump if W is pressed again quickly.
        player.isGrounded = false;
        player.coyoteTimeFramesRemaining = 0; // Should be 0 if grounded
        player.jumpInputBuffered = false; // Consume buffer
        player.isAttemptingVariableJump = true;
        player.variableJumpForceAppliedDuration = 0;
        player.totalJumpImpulseThisJump = PLAYER_VARIABLE_JUMP_INITIAL_FORCE;

        Body.applyForce(player.mainBody, player.mainBody.position, { x: 0, y: -PLAYER_VARIABLE_JUMP_INITIAL_FORCE });

        player.jumpCooldown = PLAYER_JUMP_COOLDOWN_FRAMES;
        player.lastJumpTime = Date.now();
        setPlayerAnimation(player, 'jumping', 15);
        playSound('jump.wav');
    }

    // Clear buffer if player is in air and not pressing W (or jump started already)
    if (player.jumpInputBuffered && (!player.isGrounded || player.isAttemptingVariableJump || !commonJumpConditionsMet) ) {
         player.jumpInputBuffered = false;
    }
}


function updateAIPlayers() {
    players.forEach((player) => {
        if (player.isAI) {
            if (player.actionCooldown > 0) player.actionCooldown--;
            if (player.jumpCooldown > 0) player.jumpCooldown--;

            if (player.animationState.includes('kicking') && player.animationDuration > 0) {
                 return;
            }
            if (player.animationState === 'bicycle_kick_attempt' && player.animationDuration > 0) {
                return;
            }
            executeAIPlayerLogic(player);
        }
    });
}

function executeAIPlayerLogic(player) {
    if (!ball) return;

    const ballPos = ball.position;
    const playerPos = player.mainBody.position;
    const distanceToBall = Matter.Vector.magnitude(Matter.Vector.sub(ballPos, playerPos));
    let moveForceX = 0;
    const aiGoalX = CANVAS_WIDTH - WALL_THICKNESS;
    const opponentGoalX = WALL_THICKNESS;
    const humanPlayer = players.find(p => !p.isAI);
    const humanPlayerBody = humanPlayer ? humanPlayer.mainBody : null;
    const { actualGoalOpeningHeight } = getFieldDerivedConstants();


    const isBallInAIHalf = ballPos.x > CANVAS_WIDTH / 2;
    let intent = 'pursue_ball';

    const ballAboveHead = ballPos.y < playerPos.y - HEAD_RADIUS - BODY_HEIGHT / 2;
    const ballInBicycleRangeX = Math.abs(ballPos.x - playerPos.x) < BODY_WIDTH * 2.5;
    const ballOptimalHeightForBicycle = ballPos.y > playerPos.y - BODY_HEIGHT && ballPos.y < playerPos.y - HEAD_RADIUS;

    if (ballAboveHead && ballInBicycleRangeX && ballOptimalHeightForBicycle &&
        !player.isGrounded &&
        (player.animationState === 'jumping' || player.animationState === 'idle') &&
        Math.random() < AI_BICYCLE_KICK_CHANCE &&
        player.actionCooldown === 0 && player.jumpCooldown === 0 ) {
        intent = 'bicycle_kick';
    } else if (isBallInAIHalf && distanceToBall > AI_ACTION_RANGE * 1.2 && ballPos.x > CANVAS_WIDTH * 0.65) {
        intent = 'defend_goal_line';
    } else if (isBallInAIHalf && distanceToBall > AI_ACTION_RANGE) {
        intent = 'defensive_positioning';
    } else if (!isBallInAIHalf && playerPos.x > CANVAS_WIDTH * 0.6) {
        intent = 'advance_to_attack';
    }

    if (intent === 'bicycle_kick') {
        setPlayerAnimation(player, 'bicycle_kick_attempt', 25);
        player.actionCooldown = PLAYER_ACTION_COOLDOWN_FRAMES * 2;
        player.jumpCooldown = PLAYER_JUMP_COOLDOWN_FRAMES * 2;

        Body.applyForce(player.mainBody, playerPos, { x: 0, y: -PLAYER_MAX_JUMP_IMPULSE * 0.8 });

        const rotForceMag = 0.0025; // Slightly increased
        const bodyAngle = player.mainBody.angle;

        const forceApplyPointRelY = -BODY_HEIGHT/2 * 0.7; // Apply force higher on body
        const forceApplyPoint = Matter.Vector.add(player.mainBody.position, Matter.Vector.rotate({x:0, y:forceApplyPointRelY}, bodyAngle));

        Matter.Body.applyForce(player.mainBody, forceApplyPoint, {
            x: rotForceMag * (player.team === 2 ? -1: 1) * Math.sin(bodyAngle), // Force perpendicular to body's tilt
            y: rotForceMag * (player.team === 2 ? 1: -1) * Math.cos(bodyAngle) * 0.5 // Less Y component
        });


    } else {
        switch (intent) {
            case 'defend_goal_line':
                const defensiveTargetXGoalLine = aiGoalX - GOAL_MOUTH_VISUAL_WIDTH * 0.75;
                const directionToTargetXGoalLine = defensiveTargetXGoalLine - playerPos.x;
                if (Math.abs(directionToTargetXGoalLine) > BODY_WIDTH / 2) {
                    moveForceX = Math.sign(directionToTargetXGoalLine) * AI_MOVE_FORCE * 1.1;
                }
                break;
            case 'defensive_positioning':
                const idealDefensiveX = ballPos.x + Math.sign(aiGoalX - ballPos.x) * (BODY_WIDTH + BALL_RADIUS + 20); // Increased follow distance
                const finalDefensiveTargetX = Math.max(CANVAS_WIDTH / 2 + WALL_THICKNESS, Math.min(aiGoalX - WALL_THICKNESS - BODY_WIDTH, idealDefensiveX));
                const dirToDefTarget = finalDefensiveTargetX - playerPos.x;
                if (Math.abs(dirToDefTarget) > BODY_WIDTH / 2) {
                    moveForceX = Math.sign(dirToDefTarget) * AI_MOVE_FORCE * 0.9;
                }
                break;
            case 'advance_to_attack':
                const offensiveMidfieldTargetX = CANVAS_WIDTH / 2 + (Math.random() - 0.5) * (CANVAS_WIDTH * 0.1);
                const dirToAdvanceTarget = offensiveMidfieldTargetX - playerPos.x;
                if (Math.abs(dirToAdvanceTarget) > BODY_WIDTH) {
                    moveForceX = Math.sign(dirToAdvanceTarget) * AI_MOVE_FORCE;
                }
                break;
            case 'pursue_ball':
            default:
                const dirToBallX = ballPos.x - playerPos.x;
                const idealOffset = (player.kickingLegSide === 'right' ? -BODY_WIDTH * 0.2 : BODY_WIDTH * 0.2); // Try to position kicking leg towards ball
                if (Math.abs(dirToBallX - idealOffset) > BALL_RADIUS + LEG_WIDTH * 0.5 ) {
                    moveForceX = Math.sign(dirToBallX - idealOffset) * AI_MOVE_FORCE;
                }
                break;
        }

        if (moveForceX !== 0) {
            const currentMoveForce = player.isGrounded ? AI_MOVE_FORCE : AI_MOVE_FORCE * PLAYER_AIR_CONTROL_FACTOR;
            Body.applyForce(player.mainBody, playerPos, { x: moveForceX * (currentMoveForce/AI_MOVE_FORCE) , y: (Math.random() - 0.6) * currentMoveForce * 0.1 });
        }

        // AI Action: Jump or Crouch
        if (player.jumpCooldown === 0 && distanceToBall < AI_ACTION_RANGE * 1.2) {
            const ballIsHigh = ballPos.y < playerPos.y - HEAD_RADIUS * 0.3;
            const ballIsVeryLowAndFast = ballPos.y > playerPos.y + BODY_HEIGHT * 0.25 && Math.abs(ball.velocity.x) > 2.5;

            if (player.isGrounded && Math.random() < AI_CROUCH_CHANCE && distanceToBall < AI_ACTION_RANGE * 0.8 && !ballIsHigh) {
                player.isCrouching = true;
                setPlayerAnimation(player, 'crouching', 10);
                player.actionCooldown = PLAYER_ACTION_COOLDOWN_FRAMES * 0.4;
            } else if ( (ballIsHigh || distanceToBall < AI_KICK_BALL_RANGE * 0.7 || intent === 'defend_goal_line') && player.isGrounded ) {
                player.isGrounded = false;
                player.isCrouching = false;
                player.jumpCooldown = PLAYER_JUMP_COOLDOWN_FRAMES * (1.1 + Math.random()*0.4);
                player.lastJumpTime = Date.now();
                setPlayerAnimation(player, 'jumping', 15);
                playSound('jump.wav');

                let horizontalActionForceDirection = (playerPos.x < ballPos.x) ? 0.001 : -0.001;
                if (intent === 'defend_goal_line' || intent === 'defensive_positioning') {
                    horizontalActionForceDirection = (playerPos.x < opponentGoalX + 100) ? 0.0002 : -0.0002;
                }
                const jumpStrengthFactor = (intent === 'defend_goal_line') ? 1.25 : 0.95;
                const verticalJumpForce = -PLAYER_MAX_JUMP_IMPULSE * jumpStrengthFactor * (0.75 + Math.random() * 0.4) ;
                Body.applyForce(player.mainBody, playerPos, { x: horizontalActionForceDirection, y: verticalJumpForce });
            }
        }
        if (player.isCrouching && (!player.isGrounded || (!ballIsVeryLowAndFast && distanceToBall > KICK_RANGE))) {
            player.isCrouching = false;
            if(player.animationState === 'crouching') player.animationState = 'idle';
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
    const player1StartX = CANVAS_WIDTH / 4;
    const playerBodyY = CANVAS_HEIGHT - GROUND_THICKNESS - LEG_HEIGHT - BODY_HEIGHT / 2;
    const player2StartX = CANVAS_WIDTH * 3 / 4;

    players.forEach((player, index) => {
        const startX = (index === 0) ? player1StartX : player2StartX;
        const startY = playerBodyY;

        // Remove old player bodies and constraints from the world before recreating
        if(player.mainBody) World.remove(world, player.mainBody);
        if(player.kickingLeg) World.remove(world, player.kickingLeg);
        if(player.hipConstraint) World.remove(world, player.hipConstraint);

        // Re-create the player object (this will handle initial leg setup)
        const newPlayerProps = createPlayer(startX, startY, player.color, player.playerTeam === 1, player.isAI);
        Object.assign(player, newPlayerProps); // Overwrite existing player properties

        // Explicitly set positions and velocities to zero for all parts again after recreation.
        // This ensures the parts within the compound body (mainBody) are also reset.
        Body.setPosition(player.mainBody, {x: startX, y: startY});
        Body.setVelocity(player.mainBody, {x:0, y:0});
        Body.setAngle(player.mainBody, 0);
        Body.setAngularVelocity(player.mainBody, 0);

        // Determine kicking leg side for correct offset
        const kickingLegXOffset = player.kickingLegSide === 'right' ? BODY_WIDTH / 3 : -BODY_WIDTH / 3;
        Body.setPosition(player.kickingLeg, {
            x: startX + kickingLegXOffset,
            y: startY + BODY_HEIGHT / 2 + LEG_HEIGHT / 2 - 5
        });
        Body.setVelocity(player.kickingLeg, {x:0,y:0});
        Body.setAngle(player.kickingLeg, player.kickingLegSide === 'right' ? 0.05 : -0.05);
        Body.setAngularVelocity(player.kickingLeg, 0);

        player.actionCooldown = 0;
        player.jumpCooldown = 0;
        player.isGrounded = true;
        player.isCrouching = false;
        player.animationState = 'idle';
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
        let playerCollided = null;
        let playerPartCollided = null;

        if (bodyA.label === 'ball') {
            ballBody = bodyA;
            otherBody = bodyB;
        } else if (bodyB.label === 'ball') {
            ballBody = bodyB;
            otherBody = bodyA;
        }

        if (ballBody) {
            for (const p of players) {
                // Check collision with the kicking leg OR the main compound body
                if (otherBody === p.kickingLeg || otherBody === p.mainBody || p.mainBody.parts.includes(otherBody)) {
                    playerCollided = p;
                    playerPartCollided = otherBody; // This could be mainBody or kickingLeg, or a part of mainBody
                    break;
                }
            }

            if (playerCollided) {
                if (playerCollided.isAI && playerCollided.animationState === 'bicycle_kick_attempt') {
                    // Specific logic for bicycle kick collision (might be redundant if kick applied in AI logic)
                    if (playerPartCollided === playerCollided.kickingLeg || playerPartCollided === playerCollided.torso ) {
                        const opponentGoalX = (playerCollided.playerTeam === 1) ? CANVAS_WIDTH - WALL_THICKNESS : WALL_THICKNESS;
                        const goalCenterY = CANVAS_HEIGHT - GROUND_THICKNESS - actualGoalOpeningHeight / 2;
                        const kickTargetPos = { x: opponentGoalX, y: goalCenterY };
                        let kickVector = Matter.Vector.sub(kickTargetPos, ballBody.position);
                        kickVector = Matter.Vector.normalise(kickVector);
                        kickVector.y = Math.min(kickVector.y, -0.5);
                        kickVector.x *= 1.2;
                        kickVector = Matter.Vector.normalise(kickVector);
                        const kickStrength = KICK_FORCE_MAGNITUDE * 2.5;
                        Body.applyForce(ballBody, ballBody.position, { x: kickVector.x * kickStrength, y: kickVector.y * kickStrength });
                        playSound('kick.wav');
                        setPlayerAnimation(playerCollided, 'idle', 1);
                    }
                } else {
                    let kickForce = KICK_FORCE_MAGNITUDE;
                    let kickAngleFactorY = -0.7;
                    let isTimedShot = false;
                    const TIMED_JUMP_WINDOW_MS = 200;

                    // Only the kicking leg or non-crouching body/head can initiate a proper kick
                    let canKickEffectively = (playerPartCollided === playerCollided.kickingLeg) ||
                                             (!playerCollided.isCrouching && (playerPartCollided === playerCollided.mainBody || playerCollided.mainBody.parts.includes(playerPartCollided) && !playerPartCollided.label.includes("leg")));


                    if (playerCollided.isCrouching) {
                        if(canKickEffectively) kickForce *= CROUCH_SHOT_REDUCTION_FACTOR; else kickForce = 0; // No force if not effective part
                        kickAngleFactorY = -0.05;
                        if (kickForce > 0) playSound('kick.wav');

                        const nudgeDirectionX = (ballBody.position.x > playerCollided.mainBody.position.x ? 1 : -1);
                        Body.applyForce(ballBody, ballBody.position, {
                            x: nudgeDirectionX * kickForce,
                            y: kickAngleFactorY * kickForce
                        });

                    } else {
                        if (!canKickEffectively) { // e.g. ball hits support leg
                           // Potentially a very weak, uncontrolled deflection or nothing
                            Body.applyForce(ballBody, ballBody.position, {
                                x: (Math.random() - 0.5) * 0.002,
                                y: (Math.random() - 0.5) * 0.001
                            });
                        } else {
                            if (playerCollided.animationState === 'jumping' && (Date.now() - playerCollided.lastJumpTime) < TIMED_JUMP_WINDOW_MS) {
                                kickForce *= TIMED_JUMP_SHOT_BONUS_FACTOR;
                                isTimedShot = true;
                            }

                            if (playerCollided.animationState === 'jumping') {
                                kickAngleFactorY *= JUMP_SHOT_LOFT_FACTOR;
                            }

                            const opponentGoalX = (playerCollided.playerTeam === 1) ? CANVAS_WIDTH - WALL_THICKNESS : WALL_THICKNESS;
                            const goalCenterY = CANVAS_HEIGHT - GROUND_THICKNESS - actualGoalOpeningHeight / 2;

                            let kickTargetPos = { x: opponentGoalX, y: goalCenterY };
                            if(isTimedShot){
                                 kickTargetPos.y = goalCenterY - (actualGoalOpeningHeight * 0.05) + (Math.random() * actualGoalOpeningHeight * 0.1);
                            } else {
                                 kickTargetPos.y = goalCenterY - (actualGoalOpeningHeight * 0.25) + (Math.random() * actualGoalOpeningHeight * 0.5);
                            }

                            const kickOrigin = playerPartCollided.position;
                            let kickVector = Matter.Vector.sub(kickTargetPos, kickOrigin);
                            kickVector = Matter.Vector.normalise(kickVector);

                            const baseKickXSign = Math.sign(kickVector.x);
                            kickVector.y = Math.min(kickAngleFactorY, kickVector.y * Math.sign(kickAngleFactorY));
                            kickVector.x = baseKickXSign * (isTimedShot ? (0.8 + Math.random()*0.2) : (0.4 + Math.random()*0.4) );
                            kickVector = Matter.Vector.normalise(kickVector);

                            if (!playerCollided.isAI && playerCollided.animationState !== 'kicking_execute') {
                                 setPlayerAnimation(playerCollided, 'kicking_execute', 10);
                            }
                            playSound('kick.wav');
                            Body.applyForce(ballBody, ballBody.position, { x: kickVector.x * kickForce, y: kickVector.y * kickForce });
                        }
                    }
                }
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
                const playerPartsForGroundCheck = [player.mainBody, player.kickingLeg];
                for (const playerBodyPart of playerPartsForGroundCheck) {
                    if ((bodyA === playerBodyPart && bodyB.label === 'ground') || (bodyB === playerBodyPart && bodyA.label === 'ground')) {
                        if (!player.isGrounded && player.animationState === 'jumping') {
                            player.animationState = 'idle';
                            player.animationFrame = 0;
                            player.animationDuration = 0;
                        }
                        player.isGrounded = true;
                        player.jumpCount = 0;
                        break;
                    }
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
        const restartKey = 'KeyW';
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

    let playerObject = null;
    if (body.isPlayerPart) { // Check for a custom flag we'll set on player parts
        playerObject = players.find(p => p.allParts.includes(body));
    }

    let actualHeight = BODY_HEIGHT; // Default for torso
    if (body.label.includes('torso') && playerObject && playerObject.isCrouching) {
        actualHeight = BODY_HEIGHT * 0.6;
    } else if (body.label.includes('leg') && playerObject && playerObject.isCrouching) {
        actualHeight = LEG_HEIGHT * 0.7;
    } else if (body.label.includes('leg')) {
        actualHeight = LEG_HEIGHT;
    }


    if (label.includes('torso') || label.includes('body')) { pWidth = BODY_WIDTH / PIXEL_SCALE; pHeight = actualHeight / PIXEL_SCALE; }
    else if (label.includes('leg')) { pWidth = LEG_WIDTH / PIXEL_SCALE; pHeight = actualHeight / PIXEL_SCALE; }
    else if (label === 'ground') { pWidth = CANVAS_WIDTH / PIXEL_SCALE; pHeight = GROUND_THICKNESS / PIXEL_SCALE; }
    else if (label.includes('wall-left')) { pWidth = WALL_THICKNESS / PIXEL_SCALE; pHeight = CANVAS_HEIGHT / PIXEL_SCALE; }
    else if (label.includes('wall-right')) { pWidth = WALL_THICKNESS / PIXEL_SCALE; pHeight = CANVAS_HEIGHT / PIXEL_SCALE; }
    else if (label === 'ceiling') { pWidth = CANVAS_WIDTH / PIXEL_SCALE; pHeight = WALL_THICKNESS / PIXEL_SCALE; }
    else if (label.includes('crossbar')) { pWidth = GOAL_MOUTH_VISUAL_WIDTH / PIXEL_SCALE; pHeight = CROSSBAR_THICKNESS / PIXEL_SCALE; }
    else { // Fallback for non-player, non-specific static bodies
        const boundsWidth = (body.bounds.max.x - body.bounds.min.x) / PIXEL_SCALE;
        const boundsHeight = (body.bounds.max.y - body.bounds.min.y) / PIXEL_SCALE;
        pWidth = Math.max(1, Math.round(boundsWidth));
        pHeight = Math.max(1, Math.round(boundsHeight));
    }

    // Allow animation system to override dimensions for player parts
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
    // Prioritize currentPixelRadius if passed (e.g., for animated player parts), fallback to body.circleRadius, then default.
    const radius = (typeof body.currentPixelRadius !== 'undefined' ? body.currentPixelRadius : (body.circleRadius || HEAD_RADIUS)) / PIXEL_SCALE;
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
        bodiesToRender.push(p.mainBody); // Add the compound body
        bodiesToRender.push(p.kickingLeg); // Add the separate kicking leg
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


    function renderPlayerPart(partBody, playerObject, mainBodyAngle, mainBodyPosition) {
        let renderAngle = mainBodyAngle + partBody.angle; // Part's angle is relative to compound body's angle

        // Reverted to a logic similar to the original, assuming partBody.position might be global or needs to be treated as such
        // and then made relative, rotated, and added back. This addresses the "only legs visible" issue.
        // It also implies the ReferenceError was the primary bug in the original problematic line.
        let localPartVector = Matter.Vector.sub(partBody.position, mainBodyPosition);
        let rotatedPartVector = Matter.Vector.rotate(localPartVector, mainBodyAngle);
        let partPosition = Matter.Vector.add(mainBodyPosition, rotatedPartVector);
        // If partBody.position was already local (as per my previous understanding of Body.create parts),
        // then mainBodyPosition should not be subtracted. However, the bug "only legs visible" suggests
        // that the simpler Matter.Vector.add(mainBodyPosition, Matter.Vector.rotate(partBody.position, mainBodyAngle))
        // was not positioning head and torso correctly. This version is more robust if partBody.position interpretation is tricky.
        // The most robust is: part.render.worldTransform * part.position (but that's for internal rendering)
        // Let's assume partBody.position are global-like coordinates of the parts *before* being assembled into a compound body's local frame.
        // No, Matter.js docs state: "part.position will be the parts position relative to the parent body.position"
        // This means partBody.position IS local. My previous fix:
        // let partPosition = Matter.Vector.add(mainBodyPosition, Matter.Vector.rotate(partBody.position, mainBodyAngle));
        // MUST be correct.
        // The "only legs" bug must stem from something else if that formula is right.
        // Let's stick to the documented correct way and investigate further if head/torso are still missing.
        // The error log was "Can't find variable: mainBody", not an issue with the formula itself if mainBody was defined.
        // The previous fix for ReferenceError was:
        // Original line that caused ReferenceError:
        // let partPosition = Matter.Vector.add(mainBodyPosition, Matter.Vector.rotate(Matter.Vector.sub(partBody.position, mainBody.position), mainBodyAngle));
        // My fix that resulted in "only legs":
        // let partPosition = Matter.Vector.add(mainBodyPosition, Matter.Vector.rotate(partBody.position, mainBodyAngle));
        //
        // If the "only legs" means supportLeg IS rendering, then the formula above IS working for supportLeg.
        // Why not for head and torso? Are their partBody.position values zeroed out or corrupted?

        // Reverting to the logic that assumes partBody.position are global-like coordinates
        // that first need to be made relative to mainBodyPosition, then rotated, then added back.
        // This is to test if the "only legs visible" bug is due to misinterpretation of partBody.position's frame of reference.
        let localPartVec = Matter.Vector.sub(partBody.position, mainBodyPosition);
        let rotatedLocalPartVec = Matter.Vector.rotate(localPartVec, mainBodyAngle);
        partPosition = Matter.Vector.add(mainBodyPosition, rotatedLocalPartVec);

        let yRenderOffset = 0;
        let currentPartHeight = partBody.label.includes('leg') ? LEG_HEIGHT : BODY_HEIGHT; // Default to original
        let currentPartWidth = partBody.label.includes('leg') ? LEG_WIDTH : BODY_WIDTH;
         if (partBody.label.includes('head')) {
            currentPartHeight = HEAD_RADIUS * 2; currentPartWidth = HEAD_RADIUS * 2;
        }


        if (playerObject.isCrouching) {
            if (partBody.label.includes('torso')) { // Torso is part of mainBody
                currentPartHeight = BODY_HEIGHT * 0.6;
            } else if (partBody.label.includes('leg')) { // This will be the supportLeg
                 currentPartHeight = LEG_HEIGHT * 0.7;
                 yRenderOffset = (LEG_HEIGHT * 0.1) / PIXEL_SCALE;
                 renderAngle = mainBodyAngle;
            } else if (partBody.label.includes('head')) {
                // Head height doesn't change, but it moves due to torso shrinking.
                // currentPartHeight for head remains HEAD_RADIUS * 2.
            }
        }
         // Apply yRenderOffset to the part's world position for rendering
        partPosition.y += yRenderOffset * PIXEL_SCALE;

        const tempRenderPart = {
            ...partBody,
            position: partPosition,
            angle: renderAngle,
        };

        if (partBody.label.includes('head')) {
            // For head (circle), pass currentPixelRadius. currentPartHeight for head is its diameter.
            tempRenderPart.currentPixelRadius = (currentPartHeight / 2) / PIXEL_SCALE;
            drawPixelIsoCircle(pixelCtx, tempRenderPart, playerObject.color);
        } else { // For torso and supportLeg (rectangles)
            tempRenderPart.currentPixelHeight = currentPartHeight / PIXEL_SCALE;
            tempRenderPart.currentPixelWidth = currentPartWidth / PIXEL_SCALE;
            drawPixelIsoRectangle(pixelCtx, tempRenderPart, playerObject.color);
        }
    }

    bodiesToRender.forEach(body => {
        if (body.label === 'ball') {
            drawPixelIsoCircle(pixelCtx, body, BALL_PANEL_COLOR_PRIMARY);
        } else if (body.label && (body.label.includes('player-t1-main') || body.label.includes('player-t2-main'))) {
            const playerObject = players.find(p => p.mainBody === body);
            if (playerObject) {
                // Render parts of the mainBody (head, torso, supportLeg)
                // These parts' positions are relative to mainBody.position and angle
                playerObject.mainBody.parts.slice(1).forEach(part => { // .slice(1) to skip the compound body itself
                     // For parts within a compound body, their angle is relative to the compound body's angle.
                     // Their position is also relative. We need to transform to world coords for rendering.
                    renderPlayerPart(part, playerObject, playerObject.mainBody.angle, playerObject.mainBody.position);
                });
            }
        } else if (body.label && (body.label.includes('player-t1-leg') || body.label.includes('player-t2-leg'))){
            const playerObject = players.find(p => p.kickingLeg === body);
            if (playerObject) {
                let kickingLegRenderAngle = playerObject.kickingLeg.angle;
                if (playerObject.animationState === 'kicking_execute') {
                     const kickExtensionAngle = 0.8 * (playerObject.animationFrame / playerObject.animationDuration);
                     kickingLegRenderAngle += (playerObject.mainBody.position.x < CANVAS_WIDTH / 2 ? kickExtensionAngle : -kickExtensionAngle);
                } else if (playerObject.animationState === 'bicycle_kick_attempt'){
                    kickingLegRenderAngle -= 1.5 * (playerObject.animationFrame / playerObject.animationDuration) * (playerObject.kickingLegSide === 'left' ? 1 : -1); // Kick up/back
                } else if (playerObject.isCrouching) {
                    kickingLegRenderAngle = playerObject.mainBody.angle + (playerObject.kickingLegSide === 'left' ? 0.2 : -0.2); // Tucked while crouching
                }
                 // Render the kicking leg directly as it's a separate body
                const tempKickingLeg = {
                    ...playerObject.kickingLeg,
                    angle: kickingLegRenderAngle,
                    currentPixelHeight: (playerObject.isCrouching ? LEG_HEIGHT * 0.7 : LEG_HEIGHT) / PIXEL_SCALE,
                    currentPixelWidth: LEG_WIDTH / PIXEL_SCALE
                };
                drawPixelIsoRectangle(pixelCtx, tempKickingLeg, playerObject.color);
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

// [end of game.js] // This line was the culprit from the previous read
// Removing the actual problematic line if it was the very last one.
// The content provided to overwrite_file_with_block should NOT include this.
