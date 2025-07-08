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
let particles = [];


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
const UPRIGHT_TORQUE_STRENGTH_FACTOR = 0.03; // Renamed and value adjusted for setTorque

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
        World.clear(world, false); // Keep a reference to the world for a moment
        Engine.clear(engine);
        Events.off(engine); // Remove all engine events
        if (runner) {
            Runner.stop(runner);
            console.log("SETUP: Stopped previous runner.");
        }
    }

    engine = Engine.create();
    world = engine.world; // Assign the new world from the new engine
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

    createField(); // Uses activeTheme
    createBall();  // Uses activeTheme

    players = [];
    players.push(createPlayer(CANVAS_WIDTH / 4, CANVAS_HEIGHT - GROUND_THICKNESS - BODY_HEIGHT, activeTeam1Color, true, 'KeyW', false));
    players.push(createPlayer(CANVAS_WIDTH * 3 / 4, CANVAS_HEIGHT - GROUND_THICKNESS - BODY_HEIGHT, activeTeam2Color, false, null, true));
    
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
    showGameMessage("Press 'W' to Start");
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
        isGrounded: false, jumpCount: 0,
        // Animation properties
        animationState: 'idle', // e.g., 'idle', 'jumping', 'kicking_prep', 'kicking_execute'
        animationFrame: 0,
        animationDuration: 0,
        kickingLeg: null // 'left' or 'right'
    };
}

function setupInputListeners() {
    document.addEventListener('keydown', (event) => {
        if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'Space'].includes(event.code)) event.preventDefault();
        keysPressed[event.code] = true;
    });
    document.addEventListener('keyup', (event) => { keysPressed[event.code] = false; });
}

function updatePlayerAnimations() {
    players.forEach(player => {
        if (player.animationDuration > 0) {
            player.animationFrame++;
            if (player.animationFrame >= player.animationDuration) {
                // Transition out of animation
                if (player.animationState === 'kicking_execute') {
                     player.kickingLeg = null; // Reset kicking leg after animation
                }
                player.animationState = 'idle';
                player.animationFrame = 0;
                player.animationDuration = 0;
            }
        }
        // If grounded and idle, ensure state is idle
        if (player.isGrounded && player.animationState === 'jumping') {
            player.animationState = 'idle';
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
        if (player.isGrounded && player.animationState === 'idle') { // Only apply upright torque if truly idle
            const bodySpeed = Matter.Vector.magnitude(player.body.velocity);
            const bodyAngularSpeed = Math.abs(player.body.angularVelocity);
            if (bodySpeed < 0.6 && bodyAngularSpeed < 0.2) {
                player.parts.forEach(part => {
                    Body.setAngularVelocity(part, part.angularVelocity * LANDING_DAMPING_FACTOR);
                });
                if (Math.abs(player.body.angle) > 0.15) {
                    // Matter.Body.setTorque(player.body, -player.body.angle * UPRIGHT_TORQUE_STRENGTH_FACTOR);
                    // Alternative using applyForce:
                    const body = player.body;
                    const angle = body.angle;
                    const forceMagnitude = UPRIGHT_TORQUE_STRENGTH_FACTOR * 0.25; // Tuned from 0.05

                    // Apply force to top-left/bottom-right or top-right/bottom-left to create rotation
                    // The points should be relative to the body's center and rotated by its current angle
                    const offsetX = BODY_WIDTH / 2; // Use player body dimensions
                    const offsetY = BODY_HEIGHT / 2;

                    // Point1: Top of the body, slightly to one side (e.g., left if tilted right)
                    // Point2: Bottom of the body, slightly to the other side (e.g., right if tilted right)
                    // This is a simplified approach. A more robust one would transform points to world space.

                    // If tilted to the right (positive angle), apply counter-clockwise torque
                    // Force up on right side, down on left side (or left on top, right on bottom)
                    if (angle > 0.15) { // Tilted right
                        Matter.Body.applyForce(body,
                            { x: body.position.x + offsetX * Math.cos(angle) - offsetY * Math.sin(angle), y: body.position.y + offsetX * Math.sin(angle) + offsetY * Math.cos(angle) }, // Approx top-right point
                            { x: 0, y: -forceMagnitude } // Force upwards
                        );
                        Matter.Body.applyForce(body,
                            { x: body.position.x - offsetX * Math.cos(angle) + offsetY * Math.sin(angle), y: body.position.y - offsetX * Math.sin(angle) - offsetY * Math.cos(angle) }, // Approx bottom-left point
                            { x: 0, y: forceMagnitude } // Force downwards
                        );
                    } else if (angle < -0.15) { // Tilted left
                         Matter.Body.applyForce(body,
                            { x: body.position.x - offsetX * Math.cos(angle) - offsetY * Math.sin(angle), y: body.position.y - offsetX * Math.sin(angle) + offsetY * Math.cos(angle) }, // Approx top-left point
                            { x: 0, y: -forceMagnitude } // Force upwards
                        );
                        Matter.Body.applyForce(body,
                            { x: body.position.x + offsetX * Math.cos(angle) + offsetY * Math.sin(angle), y: body.position.y + offsetX * Math.sin(angle) - offsetY * Math.cos(angle) }, // Approx bottom-right point
                            { x: 0, y: forceMagnitude } // Force downwards
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
    player.animationDuration = duration; // Duration in game ticks/frames
    if (kickingLeg) player.kickingLeg = kickingLeg;
}

function handleHumanPlayerControls() {
    players.forEach(player => {
        if (player.isAI) return;
        if (player.actionCooldown > 0) player.actionCooldown--;

        // Prioritize ongoing animations like kicking
        if (player.animationState.includes('kicking') && player.animationDuration > 0) {
            return;
        }

        if (keysPressed[player.inputKey] && player.actionCooldown === 0) {
            player.isGrounded = false;
            player.actionCooldown = PLAYER_ACTION_COOLDOWN_FRAMES;
            setPlayerAnimation(player, 'jumping', 15); // Jump animation for 15 frames
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

                let kickingFootBody = player.rightLeg; // Default to right
                let kickingLegID = 'right';
                if (distLeftLegToBall < distRightLegToBall) {
                    kickingFootBody = player.leftLeg;
                    kickingLegID = 'left';
                }
                const kickingFootPosition = kickingFootBody.position;
                const distFootToBallActual = Matter.Vector.magnitude(Matter.Vector.sub(ball.position, kickingFootPosition));

                if (distFootToBallActual < KICK_RANGE) {
                    setPlayerAnimation(player, 'kicking_execute', 10, kickingLegID); // Kick animation for 10 frames
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
    players.forEach((player) => {
        if (player.isAI) {
            if (player.actionCooldown > 0) player.actionCooldown--;
            if (player.animationState.includes('kicking') && player.animationDuration > 0) {
                 return; // Let AI finish kick animation
            }
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
        setPlayerAnimation(player, 'jumping', 15); // AI Jump animation
        playSound('jump.wav');

        let horizontalActionForceDirection = -1;
        const randomXComponent = (Math.random() - 0.5) * 0.02;
        const randomYComponent = -AI_KICK_ATTEMPT_STRENGTH * (0.8 + Math.random() * 0.4);
        Body.applyForce(player.body, playerPos, { x: horizontalActionForceDirection * PLAYER_FLAIL_HORIZONTAL_FORCE * 0.6 + randomXComponent, y: randomYComponent });
        Body.applyForce(player.leftLeg, player.leftLeg.position, { x: (Math.random() - 0.5) * 0.015, y: -AI_KICK_ATTEMPT_STRENGTH * 0.15 });
        Body.applyForce(player.rightLeg, player.rightLeg.position, { x: (Math.random() - 0.5) * 0.015, y: -AI_KICK_ATTEMPT_STRENGTH * 0.15 });
        if (Math.random() < 0.35) { Body.applyForce(player.body, { x: player.body.position.x + (Math.random() - 0.5) * 7, y: player.body.position.y }, { x: 0, y: -0.0025 }); }

        if (distanceToBall < AI_KICK_BALL_RANGE) {
            // Determine kicking leg for AI (can be random or based on ball position relative to legs)
            const kickingLegID = Math.random() < 0.5 ? 'left' : 'right';
            setPlayerAnimation(player, 'kicking_execute', 10, kickingLegID); // AI Kick animation
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

    // Particle burst for goal
    const goalX = (scoringTeam === 1) ? (CANVAS_WIDTH - WALL_THICKNESS - GOAL_MOUTH_VISUAL_WIDTH / 2) : (WALL_THICKNESS + GOAL_MOUTH_VISUAL_WIDTH / 2);
    const goalY = CANVAS_HEIGHT - GROUND_THICKNESS - GOAL_HEIGHT / 2;
    spawnParticles(ball.position.x, ball.position.y, 25, 'gold', 0, -1, 3, 40, 2);


    // Flashier Goal Message
    gameMessageDisplay.textContent = `GOAL!!! TEAM ${scoringTeam}!`;
    gameMessageDisplay.style.fontSize = '3em'; // Larger text
    gameMessageDisplay.style.color = 'gold';
    gameMessageDisplay.style.textShadow = '2px 2px #000';


    if (checkWinCondition()) {
        goalScoredRecently = false;
        // Reset message style if game ends immediately after goal
        gameMessageDisplay.style.fontSize = '';
        gameMessageDisplay.style.color = '';
        gameMessageDisplay.style.textShadow = '';
        return;
    }

    setTimeout(() => {
        // Clear specific goal message, reset style
        if (gameMessageDisplay.textContent === `GOAL!!! TEAM ${scoringTeam}!`) {
            showGameMessage(''); // Clears text content
        }
        gameMessageDisplay.style.fontSize = '';
        gameMessageDisplay.style.color = '';
        gameMessageDisplay.style.textShadow = '';
        goalScoredRecently = false;
    }, 2200); // Increased duration for the flashy message
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
        const humanPlayerKey = humanPlayer ? humanPlayer.inputKey : 'W';
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
            let collisionPoint = pair.collision.supports && pair.collision.supports.length > 0 ? pair.collision.supports[0] : ballBody.position;
            let collisionNormal = pair.collision.normal;

            if (isGameStarted && !isGameOver) {
                if (otherBody.label === 'goal-left') handleGoalScored(2);
                else if (otherBody.label === 'goal-right') handleGoalScored(1);
            }
            if (otherBody.label.includes('wall') || otherBody.label.includes('ceiling') || otherBody.label.includes('crossbar')) {
                if (Matter.Vector.magnitude(ballBody.velocity) > 1.5) { // Only spawn particles for faster impacts
                    playSound('ball_hit_wall.wav');
                    let particleColor = '#DDDDDD';
                    if (otherBody.label.includes('crossbar')) particleColor = '#EEEEEE';

                    // Spawn particles away from the normal of collision
                    const particleBaseVelX = collisionNormal.x * 0.5;
                    const particleBaseVelY = collisionNormal.y * 0.5;
                    spawnParticles(collisionPoint.x, collisionPoint.y, 4, particleColor, particleBaseVelX, particleBaseVelY, 1.5, 15, 1);
                }
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
    if (!isGameStarted && !isGameOver) {
        const humanPlayer = players.length > 0 ? players.find(p => !p.isAI && p.inputKey) : null;
        if (humanPlayer && keysPressed[humanPlayer.inputKey]) {
            console.log("RENDER_LOOP: Key pressed, starting game.");
            isGameStarted = true;
            showGameMessage('');
            if (runner) {
                Runner.run(runner, engine);
                console.log("RENDER_LOOP: Matter.js Runner started.");
            } else {
                console.error("RENDER_LOOP: Runner not initialized when trying to start game!");
            }
            startGameTimer();
            keysPressed[humanPlayer.inputKey] = false;
        }
        const mainCtx = canvas.getContext('2d');
        mainCtx.fillStyle = activeTheme.background;
        mainCtx.fillRect(0,0,CANVAS_WIDTH, CANVAS_HEIGHT);
    } else if (isGameOver) {
        const humanPlayer = players.length > 0 ? players.find(p => !p.isAI && p.inputKey) : null;
        if (humanPlayer && keysPressed[humanPlayer.inputKey]) {
            if (!restartDebounce) {
                console.log("RENDER_LOOP: Key pressed, restarting game.");
                restartDebounce = true;
                keysPressed[humanPlayer.inputKey] = false;
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

    if (label.includes('body')) { pWidth = BODY_WIDTH / PIXEL_SCALE; pHeight = BODY_HEIGHT / PIXEL_SCALE; }
    else if (label.includes('leg')) { pWidth = LEG_WIDTH / PIXEL_SCALE; pHeight = LEG_HEIGHT / PIXEL_SCALE; }
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
    const depthY = pHeight * ISOMETRIC_DEPTH_FACTOR * Math.sin(ISOMETRIC_ANGLE) * 0.5; // Y depth is usually less pronounced

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
        const stripeWidth = Math.max(1, Math.round(5 / PIXEL_SCALE)); // Pixel width of vertical stripes
        for (let i = -pWidth / 2; i < pWidth / 2; i += stripeWidth * 2) {
            pCtx.fillStyle = color;
            pCtx.fillRect(i, -pHeight / 2, stripeWidth, pHeight);
            pCtx.fillStyle = darkerWall;
            pCtx.fillRect(i + stripeWidth, -pHeight / 2, stripeWidth, pHeight);
        }
    }
     else { // For other rectangles like player parts, crossbars
        pCtx.beginPath();
        pCtx.moveTo(-pWidth / 2, -pHeight / 2);
        pCtx.lineTo(pWidth / 2, -pHeight / 2);
        pCtx.lineTo(pWidth / 2, pHeight / 2);
        pCtx.lineTo(-pWidth / 2, pHeight / 2);
        pCtx.closePath();
        pCtx.fill();
    }


    // Simple depth representation (Top and Right side for typical oblique)
    if (pHeight > 2 && pWidth > 2 && !label.includes('ground') && !label.includes('ceiling')) { // Don't add depth to flat ground/ceiling
        const darkerColor = shadeColor(color, -0.2);
        pCtx.fillStyle = darkerColor;

        if (label.includes('wall-left')) { // Left wall shows depth on its right side
            pCtx.beginPath();
            pCtx.moveTo(pWidth / 2, -pHeight / 2); // Top-right of main face
            pCtx.lineTo(pWidth / 2 + depthX, -pHeight / 2 - depthY); // Top-right-depth
            pCtx.lineTo(pWidth / 2 + depthX, pHeight / 2 - depthY);  // Bottom-right-depth
            pCtx.lineTo(pWidth / 2, pHeight / 2);   // Bottom-right of main face
            pCtx.closePath();
            pCtx.fill();
        } else if (label.includes('wall-right')) { // Right wall shows depth on its left side
             // To make it look like the "inside" of the wall from a different angle,
             // we can draw the depth piece "behind" by translating.
             // This is tricky with current rotation point. A simpler approach for now:
            pCtx.beginPath();
            pCtx.moveTo(-pWidth / 2, -pHeight / 2); // Top-left of main face
            pCtx.lineTo(-pWidth / 2 - depthX, -pHeight / 2 + depthY); // Top-left-depth (note: -depthX, +depthY for opposite skew)
            pCtx.lineTo(-pWidth / 2 - depthX, pHeight / 2 + depthY);  // Bottom-left-depth
            pCtx.lineTo(-pWidth / 2, pHeight / 2);   // Bottom-left of main face
            pCtx.closePath();
            pCtx.fill();
        } else { // Player parts, crossbars show top/side depth
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
    const color = colorOverride || (body.render && body.render.fillStyle) || '#333';

    pCtx.fillStyle = color;
    pCtx.beginPath();
    pCtx.arc(x, y, Math.max(1, radius), 0, Math.PI * 2);
    pCtx.fill();

    // Simple shading for depth illusion
    if (radius > 1) {
        const darkerColor = shadeColor(color, -0.25);
        pCtx.fillStyle = darkerColor;
        pCtx.beginPath();
        pCtx.arc(x + radius * 0.2, y + radius * 0.2, radius * 0.8, 0, Math.PI * 2); // Offset smaller circle
        pCtx.fill();

        pCtx.fillStyle = color; // Reset to original for a highlight (optional)
        pCtx.beginPath();
        pCtx.arc(x - radius * 0.1, y - radius * 0.1, radius * 0.5, 0, Math.PI*2);
        pCtx.fill();
    }
}


function customRenderAll() {
    pixelCtx.fillStyle = activeTheme.background;
    pixelCtx.fillRect(0, 0, PIXEL_CANVAS_WIDTH, PIXEL_CANVAS_HEIGHT);
    const bodiesToRender = Composite.allBodies(world).filter(body => !body.isSensor);

    // Sort bodies by Y position for pseudo-3D layering if needed, simple for now
    // bodiesToRender.sort((a, b) => (a.position.y + (a.bounds.max.y - a.bounds.min.y)/2) - (b.position.y + (b.bounds.max.y - b.bounds.min.y)/2));


    // Render Particles (underneath other objects for now, could be layered differently)
    particles.forEach(particle => {
        pixelCtx.fillStyle = particle.color;
        pixelCtx.fillRect(
            Math.round(particle.x - particle.size / 2),
            Math.round(particle.y - particle.size / 2),
            Math.max(1, particle.size), // Ensure size is at least 1 pixel
            Math.max(1, particle.size)
        );
    });

    bodiesToRender.forEach(body => {
        if (body.label === 'ball') {
            drawPixelIsoCircle(pixelCtx, body, activeTheme.ball);
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
                // Animation modifications
                if (playerObject.animationState === 'kicking_execute' && playerObject.kickingLeg) {
                    if ( (playerObject.kickingLeg === 'left' && body === playerObject.leftLeg) ||
                         (playerObject.kickingLeg === 'right' && body === playerObject.rightLeg) ) {
                        // Extend kicking leg forward
                        const kickExtensionAngle = 0.8 * (playerObject.animationFrame / playerObject.animationDuration); // Max 0.8 radians
                        renderAngle += (playerObject.body.position.x < CANVAS_WIDTH / 2 ? kickExtensionAngle : -kickExtensionAngle); // Kick towards center
                    } else if (body === playerObject.body) {
                        // Tilt body slightly during kick
                        renderAngle += (playerObject.body.position.x < CANVAS_WIDTH / 2 ? -0.1 : 0.1) * (playerObject.animationFrame / playerObject.animationDuration);
                    }
                } else if (playerObject.animationState === 'jumping') {
                    // Simple flail: make legs angle out more based on animation frame
                    const flailAmount = Math.sin(playerObject.animationFrame * 0.5) * 0.3; // Oscillate
                    if (body === playerObject.leftLeg) renderAngle -= flailAmount;
                    if (body === playerObject.rightLeg) renderAngle += flailAmount;
                }

                // Create a temporary body-like object for rendering with modified angle
                const tempRenderBody = {
                    ...body, // Spread original body properties
                    angle: renderAngle, // Override with potentially animated angle
                    position: body.position, // Ensure position is correctly passed
                    label: body.label, // Ensure label is correctly passed for size determination
                    render: body.render // Ensure render properties are passed
                };
                 if (body.label.includes('head')) {
                    drawPixelIsoCircle(pixelCtx, tempRenderBody, playerColor);
                } else {
                    drawPixelIsoRectangle(pixelCtx, tempRenderBody, playerColor);
                }
            } else { // Fallback if player object not found (should not happen)
                 if (body.label.includes('head')) { drawPixelIsoCircle(pixelCtx, body, playerColor); }
                 else { drawPixelIsoRectangle(pixelCtx, body, playerColor); }
            }

        } else if (body.isStatic) { // Ground, walls, ceiling, crossbars
             drawPixelIsoRectangle(pixelCtx, body, body.render.fillStyle);
        }
    });

    // Goal rendering needs to be adapted for isometric view too
    const goalPostColor = '#FFFFFF';
    const netColor = activeTheme.net;
    const postPixelThickness = Math.max(1, Math.round(8 / PIXEL_SCALE));
    const goalPixelHeight = Math.round(GOAL_HEIGHT / PIXEL_SCALE);
    const goalMouthPixelWidth = Math.round(GOAL_MOUTH_VISUAL_WIDTH / PIXEL_SCALE);
    const goalBaseY = Math.round((CANVAS_HEIGHT - GROUND_THICKNESS) / PIXEL_SCALE);
    const goalTopActualY = goalBaseY - goalPixelHeight;

    const isoDepth = postPixelThickness * ISOMETRIC_DEPTH_FACTOR * 1.5; // Depth for goal posts

    pixelCtx.lineWidth = Math.max(1, Math.round(1 / PIXEL_SCALE));

    // Left Goal
    const leftGoalMouthX = Math.round(WALL_THICKNESS / PIXEL_SCALE);

    // Back post (further away)
    pixelCtx.fillStyle = shadeColor(goalPostColor, -0.15);
    pixelCtx.fillRect(leftGoalMouthX + isoDepth, goalTopActualY - isoDepth * 0.5, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(leftGoalMouthX + goalMouthPixelWidth - postPixelThickness + isoDepth, goalTopActualY - isoDepth * 0.5, postPixelThickness, goalPixelHeight);
    // Crossbar - back
    pixelCtx.fillRect(leftGoalMouthX + isoDepth, goalTopActualY - isoDepth * 0.5, goalMouthPixelWidth, postPixelThickness);


    // Front posts
    pixelCtx.fillStyle = goalPostColor;
    pixelCtx.fillRect(leftGoalMouthX, goalTopActualY, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(leftGoalMouthX + goalMouthPixelWidth - postPixelThickness, goalTopActualY, postPixelThickness, goalPixelHeight);
    // Crossbar - front
    pixelCtx.fillRect(leftGoalMouthX, goalTopActualY, goalMouthPixelWidth, postPixelThickness);

    // Connecting sides for depth
    pixelCtx.fillStyle = shadeColor(goalPostColor, -0.1);
    pixelCtx.beginPath(); // Left post side
    pixelCtx.moveTo(leftGoalMouthX + postPixelThickness, goalTopActualY);
    pixelCtx.lineTo(leftGoalMouthX + postPixelThickness + isoDepth, goalTopActualY - isoDepth * 0.5);
    pixelCtx.lineTo(leftGoalMouthX + postPixelThickness + isoDepth, goalBaseY - isoDepth * 0.5);
    pixelCtx.lineTo(leftGoalMouthX + postPixelThickness, goalBaseY);
    pixelCtx.closePath();
    pixelCtx.fill();

    pixelCtx.beginPath(); // Right post side
    pixelCtx.moveTo(leftGoalMouthX + goalMouthPixelWidth - postPixelThickness, goalTopActualY);
    pixelCtx.lineTo(leftGoalMouthX + goalMouthPixelWidth - postPixelThickness + isoDepth, goalTopActualY - isoDepth * 0.5);
    pixelCtx.lineTo(leftGoalMouthX + goalMouthPixelWidth - postPixelThickness + isoDepth, goalBaseY - isoDepth*0.5);
    pixelCtx.lineTo(leftGoalMouthX + goalMouthPixelWidth - postPixelThickness, goalBaseY);
    pixelCtx.closePath();
    pixelCtx.fill();

    pixelCtx.beginPath(); // Top of crossbar
    pixelCtx.moveTo(leftGoalMouthX, goalTopActualY);
    pixelCtx.lineTo(leftGoalMouthX + isoDepth, goalTopActualY - isoDepth*0.5);
    pixelCtx.lineTo(leftGoalMouthX + goalMouthPixelWidth + isoDepth, goalTopActualY - isoDepth*0.5);
    pixelCtx.lineTo(leftGoalMouthX + goalMouthPixelWidth, goalTopActualY);
    pixelCtx.closePath();
    pixelCtx.fill();


    // Net (simple lines for now, needs better iso perspective)
    pixelCtx.strokeStyle = netColor;
    const netTopFrontY = goalTopActualY + postPixelThickness;
    const netBottomFrontY = goalBaseY -1; // -1 to be just above ground line
    const netFrontLeftX = leftGoalMouthX + postPixelThickness;
    const netFrontRightX = leftGoalMouthX + goalMouthPixelWidth - postPixelThickness;

    const netTopBackY = goalTopActualY - isoDepth * 0.5 + postPixelThickness;
    const netBottomBackY = goalBaseY - isoDepth * 0.5 -1;
    const netBackLeftX = leftGoalMouthX + isoDepth + postPixelThickness;
    const netBackRightX = leftGoalMouthX + goalMouthPixelWidth - postPixelThickness + isoDepth;

    // Horizontal net lines (front and back)
    for (let i = 0; i <= 4; i++) { // From 0 to 4 to include top and bottom "edges" if desired by pattern
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

    // Vertical and connecting net lines
    for (let i = 0; i <= 6; i++) { // From 0 to 6 for 7 lines (6 spaces)
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

        // Connecting lines from front to back (perspective)
        pixelCtx.beginPath();
        pixelCtx.moveTo(xFrontLine, netTopFrontY); // Top front point
        pixelCtx.lineTo(xBackLine, netTopBackY);   // Top back point
        pixelCtx.stroke();

        pixelCtx.beginPath();
        pixelCtx.moveTo(xFrontLine, netBottomFrontY); // Bottom front point
        pixelCtx.lineTo(xBackLine, netBottomBackY);   // Bottom back point
        pixelCtx.stroke();
    }


    // Right Goal (similar logic)
    const rightGoalMouthX = PIXEL_CANVAS_WIDTH - Math.round(WALL_THICKNESS / PIXEL_SCALE) - goalMouthPixelWidth;
    // Back post
    pixelCtx.fillStyle = shadeColor(goalPostColor, -0.15);
    pixelCtx.fillRect(rightGoalMouthX + isoDepth, goalTopActualY - isoDepth*0.5, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(rightGoalMouthX + goalMouthPixelWidth - postPixelThickness + isoDepth, goalTopActualY - isoDepth*0.5, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(rightGoalMouthX + isoDepth, goalTopActualY - isoDepth*0.5, goalMouthPixelWidth, postPixelThickness);


    // Front posts
    pixelCtx.fillStyle = goalPostColor;
    pixelCtx.fillRect(rightGoalMouthX, goalTopActualY, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(rightGoalMouthX + goalMouthPixelWidth - postPixelThickness, goalTopActualY, postPixelThickness, goalPixelHeight);
    pixelCtx.fillRect(rightGoalMouthX, goalTopActualY, goalMouthPixelWidth, postPixelThickness);

    // Connecting sides
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

    pixelCtx.beginPath(); // Top of crossbar
    pixelCtx.moveTo(rightGoalMouthX, goalTopActualY);
    pixelCtx.lineTo(rightGoalMouthX + isoDepth, goalTopActualY - isoDepth*0.5);
    pixelCtx.lineTo(rightGoalMouthX + goalMouthPixelWidth + isoDepth, goalTopActualY - isoDepth*0.5);
    pixelCtx.lineTo(rightGoalMouthX + goalMouthPixelWidth, goalTopActualY);
    pixelCtx.closePath();
    pixelCtx.fill();

    // Net for Right Goal
    pixelCtx.strokeStyle = netColor;
    const rgNetFrontLeftX = rightGoalMouthX + postPixelThickness;
    const rgNetFrontRightX = rightGoalMouthX + goalMouthPixelWidth - postPixelThickness;
    // Back coordinates for right goal net
    const rgNetBackLeftX = rightGoalMouthX + isoDepth + postPixelThickness;
    const rgNetBackRightX = rightGoalMouthX + goalMouthPixelWidth - postPixelThickness + isoDepth;

    // Horizontal net lines (front and back) - Right Goal
    for (let i = 0; i <= 4; i++) {
        const tFront = i / 4;
        const yFrontLine = netTopFrontY + (netBottomFrontY - netTopFrontY) * tFront; // Y positions are the same as left goal
        pixelCtx.beginPath();
        pixelCtx.moveTo(rgNetFrontLeftX, yFrontLine);
        pixelCtx.lineTo(rgNetFrontRightX, yFrontLine);
        pixelCtx.stroke();

        const tBack = i / 4;
        const yBackLine = netTopBackY + (netBottomBackY - netTopBackY) * tBack; // Y positions are the same
        pixelCtx.beginPath();
        pixelCtx.moveTo(rgNetBackLeftX, yBackLine);
        pixelCtx.lineTo(rgNetBackRightX, yBackLine);
        pixelCtx.stroke();
    }

    // Vertical and connecting net lines - Right Goal
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
