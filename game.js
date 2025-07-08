// --- Matter.js Aliases ---
const Engine = Matter.Engine;
const Render = Matter.Render;
const Runner = Matter.Runner;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body; // Ensure Body is correctly aliased
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
// const SCORE_TO_WIN = 3; // Score to win is no longer primary win condition
const ROUND_DURATION_SECONDS = 90; // Changed to 90 seconds
const BALL_RADIUS = 15;

const PIXEL_SCALE = 4;
const PIXEL_CANVAS_WIDTH = CANVAS_WIDTH / PIXEL_SCALE;
const PIXEL_CANVAS_HEIGHT = CANVAS_HEIGHT / PIXEL_SCALE;

// --- Game Variables ---
let pixelCanvas;
let pixelCtx;

let engine;
let world;
let render;
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
let actualGoalOpeningHeight = GOAL_HEIGHT - CROSSBAR_THICKNESS; // For use in kick logic

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
// Ball specific colors for panel design
const BALL_PANEL_COLOR_PRIMARY = '#FFFFFF'; // White panels
const BALL_PANEL_COLOR_SECONDARY = '#333333'; // Black panels


// --- Player Constants ---
const PLAYER_PART_FRICTION = 0.6;
const PLAYER_PART_RESTITUTION = 0.25;
const PLAYER_DENSITY = 0.0025;
const HEAD_RADIUS = 15;
const BODY_WIDTH = 25;
const BODY_HEIGHT = 40;
const LEG_WIDTH = 15;
const LEG_HEIGHT = 35;

// --- Control Constants ---
const PLAYER_ACTION_COOLDOWN_FRAMES = 25;
const PLAYER_JUMP_COOLDOWN_FRAMES = 20;
const PLAYER_JUMP_FORCE_LEGS = 0.075;
const PLAYER_JUMP_FORCE_BODY = 0.030;
const PLAYER_MOVE_FORCE = 0.004;
const KICK_RANGE = 55;
const KICK_FORCE_MAGNITUDE = 0.040;
const TIMED_JUMP_SHOT_BONUS_FACTOR = 1.75;
const CROUCH_SHOT_REDUCTION_FACTOR = 0.1;
const JUMP_SHOT_LOFT_FACTOR = 1.5;

const AI_ACTION_RANGE = 90;
const AI_MOVE_FORCE = 0.0025;
const AI_KICK_ATTEMPT_STRENGTH = 0.065;
const AI_KICK_BALL_RANGE = KICK_RANGE + 5;
const AI_CROUCH_CHANCE = 0.1; // Chance AI will decide to crouch if ball is low and fast
const AI_TIMED_JUMP_ANTICIPATION_FRAMES = 10; // How many frames ahead AI might anticipate a jump shot

const LANDING_DAMPING_FACTOR = 0.85;
const UPRIGHT_TORQUE_STRENGTH_FACTOR = 0.03;

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
    engine.world.gravity.y = 1;
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
    players.push(createPlayer(CANVAS_WIDTH / 4, CANVAS_HEIGHT - GROUND_THICKNESS - BODY_HEIGHT, activeTeam1Color, true, false));
    players.push(createPlayer(CANVAS_WIDTH * 3 / 4, CANVAS_HEIGHT - GROUND_THICKNESS - BODY_HEIGHT, activeTeam2Color, false, true));
    
    setupInputListeners();

    runner = Runner.create();
    console.log("SETUP: New runner created.");

    Events.on(engine, 'beforeUpdate', updateGame);
    Events.on(engine, 'collisionStart', handleCollisions);

    if (typeof gameRenderLoopId !== 'undefined') {
        cancelAnimationFrame(gameRenderLoopId);
        console.log("SETUP: Cancelled previous gameRenderLoopId:", gameRenderLoopId);
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
    console.log("TIMER: Started. ID:", roundTimerId);
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
        console.log("TIMER: Time's up!");
        checkWinCondition();
    }
}

function updateTimerDisplay() {
    timerDisplay.textContent = `Time: ${gameTimeRemaining}`;
}

function getFieldDerivedConstants() { // Made this a function to ensure it's callable after constants are defined
    return { actualGoalOpeningHeight: GOAL_HEIGHT - CROSSBAR_THICKNESS };
}

function createField() {
    const ground = Bodies.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT - GROUND_THICKNESS / 2, CANVAS_WIDTH, GROUND_THICKNESS, { isStatic: true, label: 'ground', render: { fillStyle: activeTheme.ground } });
    const leftWall = Bodies.rectangle(WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, label: 'wall-left', render: { fillStyle: activeTheme.walls } });
    const rightWall = Bodies.rectangle(CANVAS_WIDTH - WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, label: 'wall-right', render: { fillStyle: activeTheme.walls } });
    const ceiling = Bodies.rectangle(CANVAS_WIDTH / 2, WALL_THICKNESS / 2, CANVAS_WIDTH, WALL_THICKNESS, { isStatic: true, label: 'ceiling', render: { fillStyle: activeTheme.walls } });

    const { actualGoalOpeningHeight: localActualGoalOpeningHeight } = getFieldDerivedConstants(); // Use local var
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
    const group = Body.nextGroup(true);
    const head = Bodies.circle(x, y - BODY_HEIGHT / 2 - HEAD_RADIUS + 5, HEAD_RADIUS, {
        label: (isTeam1 ? 'player-t1' : 'player-t2') + '-head', collisionFilter: { group: group },
        density: PLAYER_DENSITY * 0.8, friction: PLAYER_PART_FRICTION, restitution: PLAYER_PART_RESTITUTION, render: { fillStyle: teamColor }
    });
    const playerBody = Bodies.rectangle(x, y, BODY_WIDTH, BODY_HEIGHT, {
        label: (isTeam1 ? 'player-t1' : 'player-t2') + '-body', collisionFilter: { group: group },
        density: PLAYER_DENSITY, friction: PLAYER_PART_FRICTION, restitution: PLAYER_PART_RESTITUTION, render: { fillStyle: teamColor }
    });
    const legYPos = y + BODY_HEIGHT / 2 + LEG_HEIGHT / 2 - 10;
    const legXOffset = BODY_WIDTH / 3;
    const leftLeg = Bodies.rectangle(x - legXOffset, legYPos, LEG_WIDTH, LEG_HEIGHT, {
        label: (isTeam1 ? 'player-t1' : 'player-t2') + '-leg-left', collisionFilter: { group: group },
        density: PLAYER_DENSITY * 1.1, friction: PLAYER_PART_FRICTION + 0.2, restitution: PLAYER_PART_RESTITUTION * 0.9, angle: -0.1, render: { fillStyle: teamColor }
    });
    const rightLeg = Bodies.rectangle(x + legXOffset, legYPos, LEG_WIDTH, LEG_HEIGHT, {
        label: (isTeam1 ? 'player-t1' : 'player-t2') + '-leg-right', collisionFilter: { group: group },
        density: PLAYER_DENSITY * 1.1, friction: PLAYER_PART_FRICTION + 0.2, restitution: PLAYER_PART_RESTITUTION * 0.9, angle: 0.1, render: { fillStyle: teamColor }
    });
    const constraintRenderOptions = { visible: false };
    const neckConstraint = Matter.Constraint.create({
        bodyA: head, bodyB: playerBody,
        pointA: { x: 0, y: HEAD_RADIUS * 0.5 }, pointB: { x: 0, y: -BODY_HEIGHT / 2 },
        length: 3, stiffness: 1, damping: 0.75, render: constraintRenderOptions
    });
    const leftHipConstraint = Matter.Constraint.create({
        bodyA: playerBody, bodyB: leftLeg,
        pointA: { x: -BODY_WIDTH / 2 * 0.7, y: BODY_HEIGHT / 2 * 0.9 }, pointB: { x: 0, y: -LEG_HEIGHT / 2 * 0.9 },
        length: 8, stiffness: 0.98, damping: 0.5, render: constraintRenderOptions
    });
    const rightHipConstraint = Matter.Constraint.create({
        bodyA: playerBody, bodyB: rightLeg,
        pointA: { x: BODY_WIDTH / 2 * 0.7, y: BODY_HEIGHT / 2 * 0.9 }, pointB: { x: 0, y: -LEG_HEIGHT / 2 * 0.9 },
        length: 8, stiffness: 0.98, damping: 0.5, render: constraintRenderOptions
    });
    const parts = [head, playerBody, leftLeg, rightLeg];
    const constraints = [neckConstraint, leftHipConstraint, rightHipConstraint];
    World.add(world, [...parts, ...constraints]);
    return {
        head: head, body: playerBody, leftLeg: leftLeg, rightLeg: rightLeg,
        parts: parts, constraints: constraints, color: teamColor, team: isTeam1 ? 1 : 2,
        actionCooldown: 0,
        jumpCooldown: 0,
        isAI: isAI,
        isGrounded: false,
        isCrouching: false,
        jumpCount: 0,
        animationState: 'idle',
        animationFrame: 0,
        animationDuration: 0,
        kickingLeg: null,
        lastJumpTime: 0
    };
}

function setupInputListeners() {
    document.addEventListener('keydown', (event) => {
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(event.code)) {
            event.preventDefault();
        }
        keysPressed[event.code] = true;
    });
    document.addEventListener('keyup', (event) => {
        keysPressed[event.code] = false;
        const humanPlayer = players.find(p => !p.isAI);
        if (humanPlayer && event.code === 'KeyS') {
            humanPlayer.isCrouching = false;
            if (humanPlayer.animationState === 'crouching') {
                humanPlayer.animationState = 'idle';
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
                     player.kickingLeg = null;
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

    handleHumanPlayerControls();
    updateAIPlayers();
    updatePlayerAnimations();
    updateParticles();

    players.forEach(player => {
        if (player.isGrounded && player.animationState === 'idle' && !player.isCrouching) {
            const bodySpeed = Matter.Vector.magnitude(player.body.velocity);
            const bodyAngularSpeed = Math.abs(player.body.angularVelocity);
            if (bodySpeed < 0.6 && bodyAngularSpeed < 0.2) {
                player.parts.forEach(part => {
                    Body.setAngularVelocity(part, part.angularVelocity * LANDING_DAMPING_FACTOR);
                });
                if (Math.abs(player.body.angle) > 0.15) {
                    const body = player.body;
                    const angle = body.angle;
                    const forceMagnitude = UPRIGHT_TORQUE_STRENGTH_FACTOR * 0.25;
                    const offsetX = BODY_WIDTH / 2;
                    const offsetY = BODY_HEIGHT / 2;
                    if (angle > 0.15) {
                        Matter.Body.applyForce(body,
                            { x: body.position.x + offsetX * Math.cos(angle) - offsetY * Math.sin(angle), y: body.position.y + offsetX * Math.sin(angle) + offsetY * Math.cos(angle) },
                            { x: 0, y: -forceMagnitude }
                        );
                        Matter.Body.applyForce(body,
                            { x: body.position.x - offsetX * Math.cos(angle) + offsetY * Math.sin(angle), y: body.position.y - offsetX * Math.sin(angle) - offsetY * Math.cos(angle) },
                            { x: 0, y: forceMagnitude }
                        );
                    } else if (angle < -0.15) {
                         Matter.Body.applyForce(body,
                            { x: body.position.x - offsetX * Math.cos(angle) - offsetY * Math.sin(angle), y: body.position.y - offsetX * Math.sin(angle) + offsetY * Math.cos(angle) },
                            { x: 0, y: -forceMagnitude }
                        );
                        Matter.Body.applyForce(body,
                            { x: body.position.x + offsetX * Math.cos(angle) + offsetY * Math.sin(angle), y: body.position.y + offsetX * Math.sin(angle) - offsetY * Math.cos(angle) },
                            { x: 0, y: forceMagnitude }
                        );
                    }
                }
            }
        }
    });
}


function setPlayerAnimation(player, state, duration, kickingLeg = null) {
    player.animationState = state;
    player.animationFrame = 0;
    player.animationDuration = duration;
    if (kickingLeg) player.kickingLeg = kickingLeg;
}

function handleHumanPlayerControls() {
    const player = players[0];
    if (!player || player.isAI) return;

    if (player.jumpCooldown > 0) player.jumpCooldown--;

    if (keysPressed['KeyS']) {
        player.isCrouching = true;
        if (player.isGrounded && player.animationState !== 'kicking_execute' && player.animationState !== 'bicycle_kick_attempt') {
            setPlayerAnimation(player, 'crouching', 2);
        }
    } // isCrouching is set to false on keyup in setupInputListeners

    if (player.animationState !== 'kicking_execute' && player.animationState !== 'bicycle_kick_attempt') {
        if (keysPressed['KeyA']) {
            if (!player.isCrouching || !player.isGrounded) {
                 Body.applyForce(player.body, player.body.position, { x: -PLAYER_MOVE_FORCE, y: 0 });
                 player.parts.forEach(p => { if (p !== player.head) Body.applyForce(p, p.position, { x: -PLAYER_MOVE_FORCE *0.2, y: 0 });});
            }
        }
        if (keysPressed['KeyD']) {
             if (!player.isCrouching || !player.isGrounded) {
                Body.applyForce(player.body, player.body.position, { x: PLAYER_MOVE_FORCE, y: 0 });
                player.parts.forEach(p => { if (p !== player.head) Body.applyForce(p, p.position, { x: PLAYER_MOVE_FORCE *0.2, y: 0 });});
            }
        }
    }

    if (keysPressed['KeyW'] && player.isGrounded && player.jumpCooldown === 0 && !player.isCrouching) {
        player.isGrounded = false;
        player.jumpCooldown = PLAYER_JUMP_COOLDOWN_FRAMES;
        player.lastJumpTime = Date.now();
        setPlayerAnimation(player, 'jumping', 15);
        playSound('jump.wav');

        Body.applyForce(player.leftLeg, player.leftLeg.position, { x: (Math.random() - 0.5) * 0.002, y: -PLAYER_JUMP_FORCE_LEGS });
        Body.applyForce(player.rightLeg, player.rightLeg.position, { x: (Math.random() - 0.5) * 0.002, y: -PLAYER_JUMP_FORCE_LEGS });
        Body.applyForce(player.body, player.body.position, { x: 0, y: -PLAYER_JUMP_FORCE_BODY });
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
    const playerPos = player.body.position;
    const distanceToBall = Matter.Vector.magnitude(Matter.Vector.sub(ballPos, playerPos));
    let moveForceX = 0;
    const aiGoalX = CANVAS_WIDTH - WALL_THICKNESS;
    const opponentGoalX = WALL_THICKNESS;
    const humanPlayer = players.find(p => !p.isAI);
    const humanPlayerBody = humanPlayer ? humanPlayer.body : null;
    const { actualGoalOpeningHeight } = getFieldDerivedConstants();


    // --- Determine AI's general intent ---
    const isBallInAIHalf = ballPos.x > CANVAS_WIDTH / 2;
    let intent = 'pursue_ball';

    const BICYCLE_KICK_CHANCE = 0.05;
    const ballAboveHead = ballPos.y < playerPos.y - HEAD_RADIUS;
    const ballInBicycleRangeX = Math.abs(ballPos.x - playerPos.x) < BODY_WIDTH * 2.5;
    const ballOptimalHeightForBicycle = ballPos.y > playerPos.y - BODY_HEIGHT * 1.6 && ballPos.y < playerPos.y - HEAD_RADIUS * 0.3;

    if (ballAboveHead && ballInBicycleRangeX && ballOptimalHeightForBicycle &&
        !player.isGrounded &&
        (player.animationState === 'jumping' || player.animationState === 'idle') &&
        Math.random() < BICYCLE_KICK_CHANCE &&
        player.actionCooldown === 0 && player.jumpCooldown === 0 ) {
        intent = 'bicycle_kick';
    } else if (isBallInAIHalf && distanceToBall > AI_ACTION_RANGE * 1.2 && ballPos.x > CANVAS_WIDTH * 0.65) {
        intent = 'defend_goal_line';
    } else if (isBallInAIHalf && distanceToBall > AI_ACTION_RANGE) {
        intent = 'defensive_positioning';
    } else if (!isBallInAIHalf && playerPos.x > CANVAS_WIDTH * 0.6) {
        intent = 'advance_to_attack';
    }

    // --- Execute Movement and Actions based on Intent ---
    if (intent === 'bicycle_kick') {
        setPlayerAnimation(player, 'bicycle_kick_attempt', 25, player.leftLeg);
        player.actionCooldown = PLAYER_ACTION_COOLDOWN_FRAMES * 2;
        player.jumpCooldown = PLAYER_ACTION_COOLDOWN_FRAMES * 2;

        Body.applyForce(player.body, playerPos, { x: 0, y: -PLAYER_JUMP_FORCE_BODY * 0.7 });

        const rotForceMag = 0.0020;
        const bodyAngle = player.body.angle;
        const headOffset = Matter.Vector.rotate({x: 0, y: -BODY_HEIGHT/2 * 0.8}, bodyAngle);
        const legOffset = Matter.Vector.rotate({x:0, y: BODY_HEIGHT/2 * 0.8}, bodyAngle);

        Matter.Body.applyForce(player.body, {x: playerPos.x + headOffset.x, y: playerPos.y + headOffset.y }, { x: rotForceMag * (player.team === 2 ? -1: 1), y: rotForceMag *0.2 });
        Matter.Body.applyForce(player.body, {x: playerPos.x + legOffset.x, y: playerPos.y + legOffset.y }, { x: rotForceMag * (player.team === 2 ? 1: -1) *0.5, y: -rotForceMag*0.2 });

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
                const idealDefensiveX = ballPos.x + Math.sign(aiGoalX - ballPos.x) * (BODY_WIDTH + BALL_RADIUS + 15);
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
                if (Math.abs(dirToBallX) > BALL_RADIUS + BODY_WIDTH * 0.75) {
                    moveForceX = Math.sign(dirToBallX) * AI_MOVE_FORCE;
                }
                break;
        }

        if (moveForceX !== 0) {
            Body.applyForce(player.body, playerPos, { x: moveForceX, y: (Math.random() - 0.6) * AI_MOVE_FORCE * 0.2 });
        }

        // AI Action: Jump or Crouch
        if (player.actionCooldown === 0 && player.jumpCooldown === 0 && distanceToBall < AI_ACTION_RANGE * 1.1) {
            const willJump = Math.random() < 0.7; // 70% chance to jump if in range & cooldowns met
            const willCrouch = !willJump && Math.random() < AI_CROUCH_CHANCE && player.isGrounded;

            if (willCrouch) {
                player.isCrouching = true;
                setPlayerAnimation(player, 'crouching', 10); // AI crouch for a short duration
                player.actionCooldown = PLAYER_ACTION_COOLDOWN_FRAMES * 0.5; // Shorter cooldown for crouch
            } else if (willJump) {
                player.isGrounded = false;
                player.isCrouching = false;
                player.jumpCooldown = PLAYER_JUMP_COOLDOWN_FRAMES * (1.0 + Math.random() * 0.3);
                player.lastJumpTime = Date.now();
                setPlayerAnimation(player, 'jumping', 15);
                playSound('jump.wav');

                let horizontalActionForceDirection = (playerPos.x < ballPos.x) ? 0.003 : -0.003;
                if (intent === 'defend_goal_line' || intent === 'defensive_positioning') {
                    horizontalActionForceDirection = (playerPos.x < opponentGoalX + 150) ? 0.0005 : -0.0005;
                }
                const jumpStrengthFactor = (intent === 'defend_goal_line') ? 1.2 : 0.9;
                const randomYComponent = -AI_KICK_ATTEMPT_STRENGTH * (0.5 + Math.random() * 0.4) * jumpStrengthFactor;
                Body.applyForce(player.body, playerPos, { x: horizontalActionForceDirection + (Math.random() - 0.5) * 0.005, y: randomYComponent });
                Body.applyForce(player.leftLeg, player.leftLeg.position, { x: (Math.random() - 0.5) * 0.005, y: -AI_KICK_ATTEMPT_STRENGTH * 0.1 });
                Body.applyForce(player.rightLeg, player.rightLeg.position, { x: (Math.random() - 0.5) * 0.005, y: -AI_KICK_ATTEMPT_STRENGTH * 0.1 });
            }
        }
    }
}
// Helper for block check (used by AI shot decision, though kick itself is in handleCollisions)
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
    const goalX = (scoringTeam === 1) ? (CANVAS_WIDTH - WALL_THICKNESS - GOAL_MOUTH_VISUAL_WIDTH / 2) : (WALL_THICKNESS + GOAL_MOUTH_VISUAL_WIDTH / 2);
    const goalYPos = CANVAS_HEIGHT - GROUND_THICKNESS - actualGoalOpeningHeight / 2;
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
    const playerBodyCenterY = CANVAS_HEIGHT - GROUND_THICKNESS - LEG_HEIGHT - (BODY_HEIGHT / 2) - 15;
    const player2StartX = CANVAS_WIDTH * 3 / 4;
    const startPositions = [ { x: player1StartX, y: playerBodyCenterY }, { x: player2StartX, y: playerBodyCenterY } ];
    players.forEach((player, index) => {
        if (index < startPositions.length) {
            const startX = startPositions[index].x;
            const startY = startPositions[index].y;
            Body.setPosition(player.body, { x: startX, y: startY });
            Body.setPosition(player.head, { x: startX, y: startY - (BODY_HEIGHT / 2) - HEAD_RADIUS + 5 });
            const legResetY = startY + (BODY_HEIGHT / 2) + (LEG_HEIGHT / 2) - 10;
            const legXOffset = BODY_WIDTH / 3;
            Body.setPosition(player.leftLeg, { x: startX - legXOffset, y: legResetY });
            Body.setPosition(player.rightLeg, { x: startX + legXOffset, y: legResetY });
            player.parts.forEach(part => {
                Body.setVelocity(part, { x: 0, y: 0 });
                Body.setAngularVelocity(part, 0);
                if (part === player.leftLeg) Body.setAngle(part, -0.1);
                else if (part === player.rightLeg) Body.setAngle(part, 0.1);
                else Body.setAngle(part, 0);
            });
            player.actionCooldown = 0;
            player.jumpCooldown = 0;
            player.isGrounded = true;
            player.isCrouching = false;
            player.animationState = 'idle';
        }
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

        // Identify ball and other body
        if (bodyA.label === 'ball') {
            ballBody = bodyA;
            otherBody = bodyB;
        } else if (bodyB.label === 'ball') {
            ballBody = bodyB;
            otherBody = bodyA;
        }

        if (ballBody) {
            // Check if otherBody is part of a player
            for (const p of players) {
                if (p.parts.includes(otherBody)) {
                    playerCollided = p;
                    playerPartCollided = otherBody;
                    break;
                }
            }

            if (playerCollided) { // Ball collided with a player part
                // AI's bicycle kick has its own very specific kick logic within executeAIPlayerLogic
                if (playerCollided.isAI && playerCollided.animationState === 'bicycle_kick_attempt') {
                    // Let AI logic handle this specific case fully for now.
                    // It might apply its own kick force during its animation update.
                } else { // Standard kick logic for human or non-bicycle AI
                    let kickForce = KICK_FORCE_MAGNITUDE;
                    let kickAngleFactorY = -0.7; // Base lob for normal standing/running kick
                    let isTimedShot = false;
                    const TIMED_JUMP_WINDOW_MS = 250;

                    if (playerCollided.isCrouching) {
                        kickForce *= CROUCH_SHOT_REDUCTION_FACTOR;
                        kickAngleFactorY = -0.05;
                        playSound('kick.wav');

                        const nudgeDirectionX = (ballBody.position.x > playerCollided.body.position.x ? 1 : -1);
                        Body.applyForce(ballBody, ballBody.position, {
                            x: nudgeDirectionX * kickForce,
                            y: kickAngleFactorY * kickForce
                        });

                    } else { // Not crouching
                        if (playerCollided.animationState === 'jumping' && (Date.now() - playerCollided.lastJumpTime) < TIMED_JUMP_WINDOW_MS) {
                            kickForce *= TIMED_JUMP_SHOT_BONUS_FACTOR;
                            isTimedShot = true;
                        }

                        if (playerCollided.animationState === 'jumping') {
                            kickAngleFactorY *= JUMP_SHOT_LOFT_FACTOR;
                        }

                        const opponentGoalX = (playerCollided.team === 1) ? CANVAS_WIDTH - WALL_THICKNESS : WALL_THICKNESS;
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
                             setPlayerAnimation(playerCollided, 'kicking_execute', 10, (Math.random() < 0.5 ? 'left' : 'right'));
                        }
                        playSound('kick.wav');
                        Body.applyForce(ballBody, ballBody.position, { x: kickVector.x * kickForce, y: kickVector.y * kickForce });
                    }
                }
            } else if (otherBody) { // Ball collided with something else (not a player part)
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

        // Player Grounded Check
        if (isGameStarted) {
            players.forEach(player => {
                player.parts.forEach(part => {
                    if (part.label.includes('-leg')) {
                        if ((bodyA === part && bodyB.label === 'ground') || (bodyB === part && bodyA.label === 'ground')) {
                            if (!player.isGrounded && player.animationState === 'jumping') {
                                player.animationState = 'idle';
                                player.animationFrame = 0;
                                player.animationDuration = 0;
                            }
                            player.isGrounded = true;
                            player.jumpCount = 0;
                        }
                    }
                });
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
        // Player 1 (human) uses 'W' to start, which is also their jump key.
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
            keysPressed['KeyW'] = false; // Consume the W press for starting game
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
const ISOMETRIC_ANGLE = Math.PI / 6; // Angle for isometric projection (30 degrees)
const ISOMETRIC_DEPTH_FACTOR = 0.5; // How much depth is shown

function drawPixelIsoRectangle(pCtx, body, colorOverride = null) {
    const x = body.position.x / PIXEL_SCALE;
    const y = body.position.y / PIXEL_SCALE;
    let pWidth, pHeight;
    const label = body.label || '';

    let playerObject = null;
    if (body.label.includes('player-t1') || body.label.includes('player-t2')) {
        for (const p of players) { if (p.parts.includes(body)) { playerObject = p; break; } }
    }

    let currentHeight = BODY_HEIGHT; // Default height
    // Visual crouching: shrink body height. Physics body is not changed.
    if (playerObject && playerObject.isCrouching && body.label.includes('body')) {
        currentHeight = BODY_HEIGHT * 0.6;
    }

    let currentLegHeight = LEG_HEIGHT;
    // Visual crouching for legs: could make them appear more bent or shorter
    if (playerObject && playerObject.isCrouching && body.label.includes('leg')) {
        currentLegHeight = LEG_HEIGHT * 0.7;
    }


    if (label.includes('body')) { pWidth = BODY_WIDTH / PIXEL_SCALE; pHeight = currentHeight / PIXEL_SCALE; }
    else if (label.includes('leg')) { pWidth = LEG_WIDTH / PIXEL_SCALE; pHeight = currentLegHeight / PIXEL_SCALE; }
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

    const color = colorOverride || (body.render && body.render.fillStyle) || '#333';
    pCtx.fillStyle = color;

    pCtx.save();
    pCtx.translate(x, y);
    pCtx.rotate(body.angle);

    // --- Oblique/Isometric Drawing ---
    const depthX = pWidth * ISOMETRIC_DEPTH_FACTOR * Math.cos(ISOMETRIC_ANGLE);
    const depthY = pHeight * ISOMETRIC_DEPTH_FACTOR * Math.sin(ISOMETRIC_ANGLE) * 0.5;

    // Main face
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


    // Simple depth representation
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
            // Top face
            pCtx.beginPath();
            pCtx.moveTo(-pWidth / 2, -pHeight / 2);
            pCtx.lineTo(-pWidth / 2 + depthX, -pHeight / 2 - depthY);
            pCtx.lineTo(pWidth / 2 + depthX, -pHeight / 2 - depthY);
            pCtx.lineTo(pWidth / 2, -pHeight / 2);
            pCtx.closePath();
            pCtx.fill();

            // Right side face
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

// Helper function to darken a hex color
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
    const radius = (body.circleRadius || HEAD_RADIUS) / PIXEL_SCALE;
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
    const bodiesToRender = Composite.allBodies(world).filter(body => !body.isSensor);


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
        } else if (body.label.includes('player-t1') || body.label.includes('player-t2')) {
            let playerObject = null;
            let playerColor = '#CCC';
            for (const p of players) {
                if (p.parts.includes(body)) {
                    playerObject = p;
                    playerColor = p.color;
                    break;
                }
            }

            if (playerObject) {
                let renderAngle = body.angle;
                let yRenderOffset = 0;

                if (playerObject.isCrouching && body.label.includes('body')) {
                    // Visual effect of crouching for the body handled in drawPixelIsoRectangle by height change
                }
                 if (playerObject.isCrouching && body.label.includes('leg')) {
                    // Legs might tuck in or angle differently
                    if(body.label.includes('left')) renderAngle += 0.3; else renderAngle -=0.3;
                     yRenderOffset = (LEG_HEIGHT * 0.15) / PIXEL_SCALE; // Pull legs up slightly
                }


                if (playerObject.animationState === 'kicking_execute' && playerObject.kickingLeg) {
                    if ( (playerObject.kickingLeg === 'left' && body === playerObject.leftLeg) ||
                         (playerObject.kickingLeg === 'right' && body === playerObject.rightLeg) ) {
                        const kickExtensionAngle = 0.8 * (playerObject.animationFrame / playerObject.animationDuration);
                        renderAngle += (playerObject.body.position.x < CANVAS_WIDTH / 2 ? kickExtensionAngle : -kickExtensionAngle);
                    } else if (body === playerObject.body) {
                        renderAngle += (playerObject.body.position.x < CANVAS_WIDTH / 2 ? -0.1 : 0.1) * (playerObject.animationFrame / playerObject.animationDuration);
                    }
                } else if (playerObject.animationState === 'jumping') {
                    const flailAmount = Math.sin(playerObject.animationFrame * 0.5) * 0.3;
                    if (body === playerObject.leftLeg) renderAngle -= flailAmount;
                    if (body === playerObject.rightLeg) renderAngle += flailAmount;
                } else if (playerObject.animationState === 'bicycle_kick_attempt') {
                    if (body === playerObject.body) renderAngle -= Math.PI * 0.4 * (playerObject.animationFrame / playerObject.animationDuration); // Lean back
                    if (playerObject.kickingLeg && body === playerObject[playerObject.kickingLeg]) { // Kicking leg swings high
                        renderAngle -= 1.5 * (playerObject.animationFrame / playerObject.animationDuration);
                    }
                }


                const tempRenderBody = {
                    ...body,
                    angle: renderAngle,
                    position: {x: body.position.x, y: body.position.y + yRenderOffset},
                    label: body.label,
                    render: body.render
                };
                 if (body.label.includes('head')) {
                    if(playerObject.isCrouching){ // Head also moves down with body
                        tempRenderBody.position.y += (BODY_HEIGHT * (1-0.6)) / PIXEL_SCALE / 2 ;
                    }
                    drawPixelIsoCircle(pixelCtx, tempRenderBody, playerColor);
                } else {
                    drawPixelIsoRectangle(pixelCtx, tempRenderBody, playerColor);
                }
            } else {
                 if (body.label.includes('head')) { drawPixelIsoCircle(pixelCtx, body, playerColor); }
                 else { drawPixelIsoRectangle(pixelCtx, body, playerColor); }
            }

        } else if (body.isStatic) {
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
            x: x / PIXEL_SCALE, // Scale down to pixel canvas coordinates
            y: y / PIXEL_SCALE,
            vx: (Math.random() - 0.5) * spread + baseVelocityX,
            vy: (Math.random() - 0.5) * spread + baseVelocityY - Math.random() * (spread/2), // Bias upwards slightly
            life: life + Math.random() * (life * 0.5), // Randomize life a bit
            color: color,
            size: Math.max(1, Math.round(size / PIXEL_SCALE)), // Particle size in pixel canvas units
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

[end of game.js]
