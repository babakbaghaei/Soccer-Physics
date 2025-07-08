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
const SCORE_TO_WIN = 3;
const ROUND_DURATION_SECONDS = 60;
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


// --- Field Constants ---
const GROUND_THICKNESS = 40;
const WALL_THICKNESS = 20;
const GOAL_HEIGHT = 120;
const GOAL_SENSOR_DEPTH = 30;
const GOAL_MOUTH_VISUAL_WIDTH = 60;
const CROSSBAR_THICKNESS = 10;

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
    { name: "Grass Day", background: '#ACE1AF', ground: '#B8860B', walls: '#808080', ball: '#FFDE00', net: 'rgba(220, 220, 220, 0.6)' },
    { name: "Night Sky", background: '#000033', ground: '#4A3B00', walls: '#555555', ball: '#FFFFE0', net: 'rgba(180, 180, 200, 0.5)' },
    { name: "Desert", background: '#FFDAB9', ground: '#D2B48C', walls: '#A0522D', ball: '#2F4F4F', net: 'rgba(100, 100, 100, 0.5)' }
];
let currentThemeIndex = -1;
let activeTheme = themes[0];


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
const PLAYER_JUMP_FORCE_LEGS = 0.075;
const PLAYER_JUMP_FORCE_BODY = 0.030;
const PLAYER_FLAIL_HORIZONTAL_FORCE = 0.012;
const KICK_RANGE = 55;
const KICK_FORCE_MAGNITUDE = 0.040;

const AI_ACTION_RANGE = 90;
const AI_MOVE_FORCE = 0.0025;
const AI_KICK_ATTEMPT_STRENGTH = 0.065;
const AI_KICK_BALL_RANGE = KICK_RANGE + 5;

const LANDING_DAMPING_FACTOR = 0.85;
const UPRIGHT_TORQUE_STRENGTH = 0.0001;

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
    console.log("SETUP: Initializing game state..."); // DEBUG
    isGameStarted = false;
    isGameOver = false;
    restartDebounce = false; // Crucial reset for restart logic
    team1Score = 0;
    team2Score = 0;
    gameTimeRemaining = ROUND_DURATION_SECONDS;

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
        console.log("SETUP: Clearing previous engine and world."); // DEBUG
        World.clear(world);
        Engine.clear(engine);
        // It's good practice to remove specific listeners if they might be duplicated
        // However, Matter.js Events.off might need specific handler references which can be tricky.
        // For now, creating a new engine instance is cleaner.
        if (runner) {
            Runner.stop(runner);
            console.log("SETUP: Stopped previous runner."); // DEBUG
        }
    }

    engine = Engine.create();
    world = engine.world;
    engine.world.gravity.y = 1;
    console.log("SETUP: New engine and world created."); // DEBUG

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
    players.push(createPlayer(CANVAS_WIDTH / 4, CANVAS_HEIGHT - GROUND_THICKNESS - BODY_HEIGHT, activeTeam1Color, true, 'KeyW', false));
    players.push(createPlayer(CANVAS_WIDTH * 3 / 4, CANVAS_HEIGHT - GROUND_THICKNESS - BODY_HEIGHT, activeTeam2Color, false, null, true));
    
    setupInputListeners();

    runner = Runner.create(); // Always create a fresh runner
    console.log("SETUP: New runner created."); // DEBUG
    // Runner is NOT started here. It's started in gameRenderLoop on first input.

    Events.on(engine, 'beforeUpdate', updateGame);
    Events.on(engine, 'collisionStart', handleCollisions);

    if (typeof gameRenderLoopId !== 'undefined') {
        cancelAnimationFrame(gameRenderLoopId);
        console.log("SETUP: Cancelled previous gameRenderLoopId:", gameRenderLoopId); // DEBUG
    }
    gameRenderLoopId = requestAnimationFrame(gameRenderLoop);
    console.log("SETUP: Started new gameRenderLoopId:", gameRenderLoopId); // DEBUG


    updateScoreDisplay();
    updateTimerDisplay(); // Update timer display with initial time
    showGameMessage("Press 'W' to Start");
    console.log("SETUP: Complete."); // DEBUG
}

// --- Timer Functions ---
function startGameTimer() {
    if (roundTimerId) clearInterval(roundTimerId);
    gameTimeRemaining = ROUND_DURATION_SECONDS;
    updateTimerDisplay();
    roundTimerId = setInterval(updateRoundTimer, 1000);
    console.log("TIMER: Started. ID:", roundTimerId); // DEBUG
}

function updateRoundTimer() {
    if (!isGameStarted || isGameOver) {
        if (roundTimerId) clearInterval(roundTimerId);
        roundTimerId = null;
        // console.log("TIMER: Stopped (game not active or over)."); // DEBUG
        return;
    }
    gameTimeRemaining--;
    updateTimerDisplay();
    if (gameTimeRemaining < 0) { // Use < 0 to ensure 0 is displayed
        gameTimeRemaining = 0; // Clamp to 0
        updateTimerDisplay(); // Show 0
        if (roundTimerId) clearInterval(roundTimerId);
        roundTimerId = null;
        console.log("TIMER: Time's up!"); //DEBUG
        checkWinCondition();
    }
}

function updateTimerDisplay() {
    timerDisplay.textContent = `Time: ${gameTimeRemaining}`;
}


function createField() {
    const ground = Bodies.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT - GROUND_THICKNESS / 2, CANVAS_WIDTH, GROUND_THICKNESS, { isStatic: true, label: 'ground', render: { fillStyle: activeTheme.ground } });
    const leftWall = Bodies.rectangle(WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, label: 'wall-left', render: { fillStyle: activeTheme.walls } });
    const rightWall = Bodies.rectangle(CANVAS_WIDTH - WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, label: 'wall-right', render: { fillStyle: activeTheme.walls } });
    const ceiling = Bodies.rectangle(CANVAS_WIDTH / 2, WALL_THICKNESS / 2, CANVAS_WIDTH, WALL_THICKNESS, { isStatic: true, label: 'ceiling', render: { fillStyle: activeTheme.walls } });
    const goalY = CANVAS_HEIGHT - GROUND_THICKNESS - GOAL_HEIGHT / 2;
    const goalSensorRenderInvisible = { visible: false };
    const leftGoalSensor = Bodies.rectangle(WALL_THICKNESS + GOAL_SENSOR_DEPTH / 2, goalY, GOAL_SENSOR_DEPTH, GOAL_HEIGHT, { isStatic: true, isSensor: true, label: 'goal-left', render: goalSensorRenderInvisible });
    const rightGoalSensor = Bodies.rectangle(CANVAS_WIDTH - WALL_THICKNESS - GOAL_SENSOR_DEPTH / 2, goalY, GOAL_SENSOR_DEPTH, GOAL_HEIGHT, { isStatic: true, isSensor: true, label: 'goal-right', render: goalSensorRenderInvisible });
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
        render: { fillStyle: activeTheme.ball, strokeStyle: '#333', lineWidth: 2 }
    });
    World.add(world, ball);
}

function createPlayer(x, y, teamColor, isTeam1, inputKey, isAI) {
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
        length: 5, stiffness: 0.95, damping: 0.5, render: constraintRenderOptions
    });
    const leftHipConstraint = Matter.Constraint.create({
        bodyA: playerBody, bodyB: leftLeg,
        pointA: { x: -BODY_WIDTH / 2 * 0.7, y: BODY_HEIGHT / 2 * 0.9 }, pointB: { x: 0, y: -LEG_HEIGHT / 2 * 0.9 },
        length: 10, stiffness: 0.9, damping: 0.35, render: constraintRenderOptions
    });
    const rightHipConstraint = Matter.Constraint.create({
        bodyA: playerBody, bodyB: rightLeg,
        pointA: { x: BODY_WIDTH / 2 * 0.7, y: BODY_HEIGHT / 2 * 0.9 }, pointB: { x: 0, y: -LEG_HEIGHT / 2 * 0.9 },
        length: 10, stiffness: 0.9, damping: 0.35, render: constraintRenderOptions
    });
    const parts = [head, playerBody, leftLeg, rightLeg];
    const constraints = [neckConstraint, leftHipConstraint, rightHipConstraint];
    World.add(world, [...parts, ...constraints]);
    return {
        head: head, body: playerBody, leftLeg: leftLeg, rightLeg: rightLeg,
        parts: parts, constraints: constraints, color: teamColor, team: isTeam1 ? 1 : 2,
        inputKey: inputKey, actionCooldown: 0, isAI: isAI,
        isGrounded: false, jumpCount: 0
    };
}

function setupInputListeners() {
    document.addEventListener('keydown', (event) => {
        if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'Space'].includes(event.code)) event.preventDefault();
        keysPressed[event.code] = true;
    });
    document.addEventListener('keyup', (event) => { keysPressed[event.code] = false; });
}

// This function is called by the Matter.js engine's 'beforeUpdate' event (IF RUNNER IS ACTIVE)
function updateGame() {
    if (!isGameStarted || isGameOver) return; // Main guard for game logic

    handleHumanPlayerControls();
    updateAIPlayers();

    players.forEach(player => {
        if (player.isGrounded) {
            const bodySpeed = Matter.Vector.magnitude(player.body.velocity);
            const bodyAngularSpeed = Math.abs(player.body.angularVelocity);
            if (bodySpeed < 0.6 && bodyAngularSpeed < 0.2) {
                player.parts.forEach(part => {
                    Body.setAngularVelocity(part, part.angularVelocity * LANDING_DAMPING_FACTOR);
                });
                if (Math.abs(player.body.angle) > 0.15) {
                    Body.applyTorque(player.body, -player.body.angle * UPRIGHT_TORQUE_STRENGTH);
                }
            }
        }
    });
}

function handleHumanPlayerControls() {
    // Assumes isGameStarted is true and isGameOver is false (checked in updateGame)
    players.forEach(player => {
        if (player.isAI) return;

        if (player.actionCooldown > 0) player.actionCooldown--;

        if (keysPressed[player.inputKey] && player.actionCooldown === 0) {
            player.isGrounded = false;
            player.actionCooldown = PLAYER_ACTION_COOLDOWN_FRAMES;
            playSound('jump.wav');

            Body.applyForce(player.leftLeg, player.leftLeg.position, { x: (Math.random()-0.5)*0.005, y: -PLAYER_JUMP_FORCE_LEGS * 0.5 });
            Body.applyForce(player.rightLeg, player.rightLeg.position, { x: (Math.random()-0.5)*0.005, y: -PLAYER_JUMP_FORCE_LEGS * 0.5 });
            Body.applyForce(player.body, player.body.position, { x: 0, y: -PLAYER_JUMP_FORCE_BODY });

            let horizontalForceToApply = 0;
            const baseHorizontalFlailStrength = PLAYER_FLAIL_HORIZONTAL_FORCE * 0.7;
            if (ball) {
                const ballDirectionX = ball.position.x - player.body.position.x;
                const distanceToBallSimpleX = Math.abs(ballDirectionX);
                const targetInfluenceRange = 250;
                if (distanceToBallSimpleX < targetInfluenceRange) {
                    horizontalForceToApply = Math.sign(ballDirectionX) * PLAYER_FLAIL_HORIZONTAL_FORCE * 1.5;
                } else {
                    horizontalForceToApply = ((player.team === 1) ? 1 : -1) * baseHorizontalFlailStrength;
                }
            } else {
                horizontalForceToApply = ((player.team === 1) ? 1 : -1) * baseHorizontalFlailStrength;
            }
            const randomXComponent = (Math.random() - 0.5) * 0.005;
            Body.applyForce(player.body, player.body.position, { x: horizontalForceToApply + randomXComponent, y: 0 });
            Body.applyForce(player.body, { x: player.body.position.x + (Math.random() - 0.5) * 5, y: player.body.position.y }, { x: 0, y: -0.003 });

            if (ball) {
                const opponentGoalX = (player.team === 1) ? CANVAS_WIDTH - WALL_THICKNESS : WALL_THICKNESS;
                const goalCenterY = CANVAS_HEIGHT - GROUND_THICKNESS - GOAL_HEIGHT / 2;
                const distLeftLegToBall = Matter.Vector.magnitude(Matter.Vector.sub(ball.position, player.leftLeg.position));
                const distRightLegToBall = Matter.Vector.magnitude(Matter.Vector.sub(ball.position, player.rightLeg.position));
                let kickingFootPosition;
                if (distLeftLegToBall < distRightLegToBall) { kickingFootPosition = player.leftLeg.position; } else { kickingFootPosition = player.rightLeg.position; }
                const distFootToBallActual = Matter.Vector.magnitude(Matter.Vector.sub(ball.position, kickingFootPosition));
                if (distFootToBallActual < KICK_RANGE) {
                    playSound('kick.wav');
                    const kickTargetPos = { x: opponentGoalX, y: goalCenterY };
                    let kickVector = Matter.Vector.sub(kickTargetPos, kickingFootPosition);
                    kickVector = Matter.Vector.normalise(kickVector);
                    kickVector.y = -0.7; kickVector.x *= 0.3;
                    kickVector = Matter.Vector.normalise(kickVector);
                    Body.applyForce(ball, ball.position, { x: kickVector.x * KICK_FORCE_MAGNITUDE, y: kickVector.y * KICK_FORCE_MAGNITUDE });
                }
            }
        }
    });
}

function updateAIPlayers() {
    // Assumes isGameStarted is true and isGameOver is false (checked in updateGame)
    players.forEach((player) => {
        if (player.isAI) {
            if (player.actionCooldown > 0) player.actionCooldown--;
            executeAIPlayerLogic(player);
        }
    });
}

function executeAIPlayerLogic(player) {
    if (!ball ) return;
    const ballPos = ball.position;
    const playerPos = player.body.position;
    const directionToBallX = ballPos.x - playerPos.x;
    let moveForceX = 0;
    if (Math.abs(directionToBallX) > BALL_RADIUS + BODY_WIDTH/2 ) {
        moveForceX = Math.sign(directionToBallX) * AI_MOVE_FORCE;
        Body.applyForce(player.body, playerPos, { x: moveForceX, y: (Math.random() - 0.5) * AI_MOVE_FORCE * 0.2 });
    }
    const distanceToBall = Matter.Vector.magnitude(Matter.Vector.sub(ballPos, playerPos));
    if (distanceToBall < AI_ACTION_RANGE && player.actionCooldown === 0) {
        player.isGrounded = false;
        player.actionCooldown = PLAYER_ACTION_COOLDOWN_FRAMES * (1.5 + Math.random() * 0.8);
        playSound('jump.wav');
        let horizontalActionForceDirection = -1;
        const randomXComponent = (Math.random() - 0.5) * 0.02;
        const randomYComponent = -AI_KICK_ATTEMPT_STRENGTH * (0.8 + Math.random() * 0.4);
        Body.applyForce(player.body, playerPos, { x: horizontalActionForceDirection * PLAYER_FLAIL_HORIZONTAL_FORCE * 0.6 + randomXComponent, y: randomYComponent });
        Body.applyForce(player.leftLeg, player.leftLeg.position, { x: (Math.random() - 0.5) * 0.015, y: -AI_KICK_ATTEMPT_STRENGTH * 0.15 });
        Body.applyForce(player.rightLeg, player.rightLeg.position, { x: (Math.random() - 0.5) * 0.015, y: -AI_KICK_ATTEMPT_STRENGTH * 0.15 });
        if (Math.random() < 0.35) { Body.applyForce(player.body, { x: player.body.position.x + (Math.random() - 0.5) * 7, y: player.body.position.y }, { x: 0, y: -0.0025 }); }
        if (distanceToBall < AI_KICK_BALL_RANGE) {
            playSound('kick.wav');
            const humanGoalX = WALL_THICKNESS;
            const goalCenterY = CANVAS_HEIGHT - GROUND_THICKNESS - GOAL_HEIGHT / 2;
            const kickTargetPos = { x: humanGoalX, y: goalCenterY };
            let kickVector = Matter.Vector.sub(kickTargetPos, playerPos);
            kickVector = Matter.Vector.normalise(kickVector);
            kickVector.y = -0.6; kickVector.x *= (playerPos.x > CANVAS_WIDTH / 2 ? -0.4 : 0.4);
            kickVector = Matter.Vector.normalise(kickVector);
            Body.applyForce(ball, ball.position, { x: kickVector.x * AI_KICK_ATTEMPT_STRENGTH, y: kickVector.y * AI_KICK_ATTEMPT_STRENGTH });
        }
    }
}

let goalScoredRecently = false;
function handleGoalScored(scoringTeam) {
    if (isGameOver || goalScoredRecently) return;
    goalScoredRecently = true;
    playSound('goal.wav');
    if (scoringTeam === 1) team1Score++; else if (scoringTeam === 2) team2Score++;
    updateScoreDisplay();
    if (checkWinCondition()) { goalScoredRecently = false; return; }
    showGameMessage(`Goal for Team ${scoringTeam}!`);
    setTimeout(() => {
        if (gameMessageDisplay.textContent === `Goal for Team ${scoringTeam}!`) showGameMessage('');
        goalScoredRecently = false;
    }, 1800);
    resetPositions();
}

function checkWinCondition() {
    if (isGameOver) return true;
    let winner = null;
    let reason = "";
    if (team1Score >= SCORE_TO_WIN) { winner = 1; reason = `Team 1 Wins!`; }
    else if (team2Score >= SCORE_TO_WIN) { winner = 2; reason = `Team 2 Wins!`; }
    else if (gameTimeRemaining <= 0) {
        if (team1Score > team2Score) { winner = 1; reason = `Time's Up! Team 1 Wins!`; }
        else if (team2Score > team1Score) { winner = 2; reason = `Time's Up! Team 2 Wins!`; }
        else { winner = 0; reason = `Time's Up! It's a Draw!`; }
    }

    if (winner !== null) {
        isGameOver = true;
        const humanPlayer = players.find(p => !p.isAI);
        const humanPlayerKey = humanPlayer ? humanPlayer.inputKey : 'W'; // Fallback key
        showGameMessage(`${reason} Final Score: ${team1Score}-${team2Score}. Press '${humanPlayerKey}' to Play Again.`);
        if (runner) Runner.stop(runner);
        if (roundTimerId) clearInterval(roundTimerId); roundTimerId = null;
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
            player.isGrounded = true;
        }
    });
}

function handleCollisions(event) {
    if (!isGameStarted && !isGameOver) return;
    if (isGameOver && !goalScoredRecently) return;

    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;
        if (bodyA.label === 'ball' || bodyB.label === 'ball') {
            const ballBody = bodyA.label === 'ball' ? bodyA : bodyB;
            const otherBody = ballBody === bodyA ? bodyB : bodyA;
            if (isGameStarted && !isGameOver) {
                if (otherBody.label === 'goal-left') handleGoalScored(2);
                else if (otherBody.label === 'goal-right') handleGoalScored(1);
            }
            if (otherBody.label.includes('wall') || otherBody.label.includes('ceiling') || otherBody.label.includes('crossbar')) {
                if (Matter.Vector.magnitude(ballBody.velocity) > 1.0) { playSound('ball_hit_wall.wav'); }
            }
        }
        if (isGameStarted) {
            players.forEach(player => {
                player.parts.forEach(part => {
                    if (part.label.includes('-leg')) {
                        if ((bodyA === part && bodyB.label === 'ground') || (bodyB === part && bodyA.label === 'ground')) {
                            player.isGrounded = true; player.jumpCount = 0;
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
    if (!isGameStarted && !isGameOver) { // Handle pre-game start input and rendering
        const humanPlayer = players.length > 0 ? players.find(p => !p.isAI && p.inputKey) : null;
        if (humanPlayer && keysPressed[humanPlayer.inputKey]) {
            console.log("RENDER_LOOP: Key pressed, starting game."); // DEBUG
            isGameStarted = true;
            showGameMessage('');
            if (runner) {
                Runner.run(runner, engine);
                console.log("RENDER_LOOP: Matter.js Runner started."); // DEBUG
            } else {
                console.error("RENDER_LOOP: Runner not initialized when trying to start game!");
            }
            startGameTimer();
            keysPressed[humanPlayer.inputKey] = false;
        }
        // Render a static "Press to Start" screen
        const mainCtx = canvas.getContext('2d');
        mainCtx.fillStyle = activeTheme.background;
        mainCtx.fillRect(0,0,CANVAS_WIDTH, CANVAS_HEIGHT);
        // The HTML #gameMessage is already showing "Press W to Start" via setup()
    } else if (isGameOver) { // Handle post-game restart input and rendering
        const humanPlayer = players.length > 0 ? players.find(p => !p.isAI && p.inputKey) : null;
        if (humanPlayer && keysPressed[humanPlayer.inputKey]) {
            if (!restartDebounce) {
                console.log("RENDER_LOOP: Key pressed, restarting game."); // DEBUG
                restartDebounce = true;
                keysPressed[humanPlayer.inputKey] = false;
                if (gameRenderLoopId) cancelAnimationFrame(gameRenderLoopId);
                if (roundTimerId) clearInterval(roundTimerId); roundTimerId = null;
                setup();
                return; // Exit this loop instance, setup will start a new one
            }
        }
        customRenderAll(); // Render final game over screen
    } else { // Game is active (isGameStarted === true && !isGameOver)
        customRenderAll();
    }
    gameRenderLoopId = requestAnimationFrame(gameRenderLoop);
}


function drawPixelRectangle(pCtx, body, colorOverride = null) {
    const x = body.position.x / PIXEL_SCALE;
    const y = body.position.y / PIXEL_SCALE;
    let pWidth, pHeight;
    const label = body.label || '';
    if (label.includes('body')) { pWidth = BODY_WIDTH / PIXEL_SCALE; pHeight = BODY_HEIGHT / PIXEL_SCALE; }
    else if (label.includes('leg')) { pWidth = LEG_WIDTH / PIXEL_SCALE; pHeight = LEG_HEIGHT / PIXEL_SCALE; }
    else if (label === 'ground') { pWidth = CANVAS_WIDTH / PIXEL_SCALE; pHeight = GROUND_THICKNESS / PIXEL_SCALE; }
    else if (label.includes('wall')) { pWidth = WALL_THICKNESS / PIXEL_SCALE; pHeight = CANVAS_HEIGHT / PIXEL_SCALE; }
    else if (label === 'ceiling') { pWidth = CANVAS_WIDTH / PIXEL_SCALE; pHeight = WALL_THICKNESS / PIXEL_SCALE; }
    else if (label.includes('crossbar')) { pWidth = GOAL_MOUTH_VISUAL_WIDTH / PIXEL_SCALE; pHeight = CROSSBAR_THICKNESS / PIXEL_SCALE;}
    else {
        const boundsWidth = (body.bounds.max.x - body.bounds.min.x) / PIXEL_SCALE;
        const boundsHeight = (body.bounds.max.y - body.bounds.min.y) / PIXEL_SCALE;
        pWidth = Math.max(1, Math.round(boundsWidth));
        pHeight = Math.max(1, Math.round(boundsHeight));
    }
    pCtx.fillStyle = colorOverride || (body.render && body.render.fillStyle) || '#333';
    pCtx.save();
    pCtx.translate(x, y);
    pCtx.rotate(body.angle);
    pCtx.fillRect(-pWidth / 2, -pHeight / 2, pWidth, pHeight);
    pCtx.restore();
}

function drawPixelCircle(pCtx, body, colorOverride = null) {
    const x = body.position.x / PIXEL_SCALE;
    const y = body.position.y / PIXEL_SCALE;
    const radius = (body.circleRadius || HEAD_RADIUS) / PIXEL_SCALE;
    pCtx.fillStyle = colorOverride || (body.render && body.render.fillStyle) || '#333';
    pCtx.beginPath();
    pCtx.arc(x, y, Math.max(1, radius), 0, Math.PI * 2);
    pCtx.fill();
}

function customRenderAll() {
    pixelCtx.fillStyle = activeTheme.background;
    pixelCtx.fillRect(0, 0, PIXEL_CANVAS_WIDTH, PIXEL_CANVAS_HEIGHT);
    const bodiesToRender = Composite.allBodies(world).filter(body => !body.isSensor);
    bodiesToRender.forEach(body => {
        if (body.label === 'ball') { drawPixelCircle(pixelCtx, body, activeTheme.ball); }
        else if (body.label.includes('player-t1') || body.label.includes('player-t2')) {
            let playerColor = '#CCC';
            for(const p of players) { if (p.parts.includes(body)) { playerColor = p.color; break; } }
            if (body.label.includes('head')) { drawPixelCircle(pixelCtx, body, playerColor); }
            else { drawPixelRectangle(pixelCtx, body, playerColor); }
        } else if (body.isStatic) { drawPixelRectangle(pixelCtx, body, body.render.fillStyle); }
    });
    const goalPostColor = '#FFFFFF';
    const netColor = activeTheme.net;
    const postPixelThickness = Math.max(1, Math.round(8 / PIXEL_SCALE));
    const goalPixelHeight = Math.round(GOAL_HEIGHT / PIXEL_SCALE);
    const goalMouthPixelWidth = Math.round(GOAL_MOUTH_VISUAL_WIDTH / PIXEL_SCALE);
    const goalBaseY = Math.round((CANVAS_HEIGHT - GROUND_THICKNESS) / PIXEL_SCALE);
    const goalTopActualY = goalBaseY - goalPixelHeight;
    pixelCtx.lineWidth = Math.max(1, Math.round(1 / PIXEL_SCALE));
    const leftGoalMouthX = Math.round(WALL_THICKNESS / PIXEL_SCALE);
    pixelCtx.fillStyle = goalPostColor;
    pixelCtx.fillRect(leftGoalMouthX, goalTopActualY, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(leftGoalMouthX + goalMouthPixelWidth - postPixelThickness, goalTopActualY, postPixelThickness, goalPixelHeight);
    pixelCtx.strokeStyle = netColor;
    const netTopInnerY = goalTopActualY + postPixelThickness;
    const netBottomInnerY = goalBaseY - 1;
    const netSideInnerLeftX = leftGoalMouthX + postPixelThickness;
    const netSideInnerRightX = leftGoalMouthX + goalMouthPixelWidth - postPixelThickness;
    for (let i = 1; i < 4; i++) { const yLine = netTopInnerY + (netBottomInnerY - netTopInnerY) * i / 4; pixelCtx.beginPath(); pixelCtx.moveTo(netSideInnerLeftX, yLine); pixelCtx.lineTo(netSideInnerRightX, yLine); pixelCtx.stroke(); }
    for (let i = 1; i < 6; i++) { const xLine = netSideInnerLeftX + (netSideInnerRightX - netSideInnerLeftX) * i / 6; pixelCtx.beginPath(); pixelCtx.moveTo(xLine, netTopInnerY); pixelCtx.lineTo(xLine, netBottomInnerY); pixelCtx.stroke(); }
    const rightGoalMouthX = PIXEL_CANVAS_WIDTH - Math.round(WALL_THICKNESS / PIXEL_SCALE) - goalMouthPixelWidth;
    pixelCtx.fillStyle = goalPostColor;
    pixelCtx.fillRect(rightGoalMouthX, goalTopActualY, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(rightGoalMouthX + goalMouthPixelWidth - postPixelThickness, goalTopActualY, postPixelThickness, goalPixelHeight);
    pixelCtx.strokeStyle = netColor;
    const rgNetSideInnerLeftX = rightGoalMouthX + postPixelThickness;
    const rgNetSideInnerRightX = rightGoalMouthX + goalMouthPixelWidth - postPixelThickness;
    for (let i = 1; i < 4; i++) { const yLine = netTopInnerY + (netBottomInnerY - netTopInnerY) * i / 4; pixelCtx.beginPath(); pixelCtx.moveTo(rgNetSideInnerLeftX, yLine); pixelCtx.lineTo(rgNetSideInnerRightX, yLine); pixelCtx.stroke(); }
    for (let i = 1; i < 6; i++) { const xLine = rgNetSideInnerLeftX + (rgNetSideInnerRightX - rgNetSideInnerLeftX) * i / 6; pixelCtx.beginPath(); pixelCtx.moveTo(xLine, netTopInnerY); pixelCtx.lineTo(xLine, netBottomInnerY); pixelCtx.stroke(); }
    const mainCtx = canvas.getContext('2d');
    mainCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    mainCtx.imageSmoothingEnabled = false;
    mainCtx.drawImage(pixelCanvas, 0, 0, PIXEL_CANVAS_WIDTH, PIXEL_CANVAS_HEIGHT, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

document.addEventListener('DOMContentLoaded', setup);
