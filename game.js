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
const BALL_RADIUS = 15;
const BALL_COLOR = '#FFDE00';

const PIXEL_SCALE = 4;
const PIXEL_CANVAS_WIDTH = CANVAS_WIDTH / PIXEL_SCALE;
const PIXEL_CANVAS_HEIGHT = CANVAS_HEIGHT / PIXEL_SCALE;

// --- Game Variables ---
let pixelCanvas; // Off-screen canvas for pixel rendering
let pixelCtx;    // Context for the off-screen canvas

let engine;
let world;
let render;
let runner;
let isGameOver = false;
let team1Score = 0;
let team2Score = 0;
let ball;
let players = []; // Will store all player objects

// --- Field Constants ---
const GROUND_THICKNESS = 40;
const WALL_THICKNESS = 20;
const GOAL_HEIGHT = 120;
const GOAL_SENSOR_DEPTH = 30;

// --- Player Constants ---
const PLAYER_TEAM1_COLOR = '#D9534F'; // Reddish for Human Team
const PLAYER_TEAM2_COLOR = '#428BCA'; // Bluish for AI Opponent Team
const PLAYER_PART_FRICTION = 0.5;
const PLAYER_PART_RESTITUTION = 0.4;
const PLAYER_DENSITY = 0.002;
const HEAD_RADIUS = 15;
const BODY_WIDTH = 25;
const BODY_HEIGHT = 40;
const LEG_WIDTH = 15;
const LEG_HEIGHT = 35;

// --- Control Constants ---
const PLAYER_ACTION_COOLDOWN_FRAMES = 30;
const PLAYER_JUMP_FORCE_LEGS = 0.032;
const PLAYER_JUMP_FORCE_BODY = 0.012;
const PLAYER_FLAIL_HORIZONTAL_FORCE = 0.01;
const KICK_RANGE = 50;
const KICK_FORCE_MAGNITUDE = 0.06; // Increased for human player

const AI_ACTION_RANGE = 110; // Slightly increased range for AI to act
const AI_MOVE_FORCE = 0.0004; // Slightly reduced AI nudge force
const AI_KICK_ATTEMPT_STRENGTH = 0.028; // Slightly reduced AI kick strength

const keysPressed = {};

// --- Initialization Function ---
function setup() {
    engine = Engine.create();
    world = engine.world;
    engine.world.gravity.y = 1;

    render = Render.create({
        canvas: canvas,
        engine: engine,
        options: {
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            wireframes: false,
            background: '#ACE1AF',
            showAngleIndicator: false,
        }
    });

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    createField();
    createBall();

    players = []; // Clear players array for fresh setup

    // Team 1: Human (P0) + AI Teammate (P1)
    // Player 0 (Human) - Controlled by 'KeyW'
    players.push(createPlayer(CANVAS_WIDTH / 4 - 30, CANVAS_HEIGHT / 2, PLAYER_TEAM1_COLOR, true, 'KeyW', false));
    // Player 1 (AI Teammate)
    players.push(createPlayer(CANVAS_WIDTH / 4 + 30, CANVAS_HEIGHT / 2 - 50, PLAYER_TEAM1_COLOR, true, null, true));

    // Team 2: AI Opponents (P2, P3)
    // Player 2 (AI Opponent)
    players.push(createPlayer(CANVAS_WIDTH * 3 / 4 + 30, CANVAS_HEIGHT / 2, PLAYER_TEAM2_COLOR, false, null, true));
    // Player 3 (AI Opponent)
    players.push(createPlayer(CANVAS_WIDTH * 3 / 4 - 30, CANVAS_HEIGHT / 2 - 50, PLAYER_TEAM2_COLOR, false, null, true));

    render.options.enabled = false; // Disable Matter's default renderer

    // Main canvas setup
    const mainCtx = canvas.getContext('2d');
    mainCtx.imageSmoothingEnabled = false;

    // Create off-screen pixel canvas
    pixelCanvas = document.createElement('canvas');
    pixelCanvas.width = PIXEL_CANVAS_WIDTH;
    pixelCanvas.height = PIXEL_CANVAS_HEIGHT;
    pixelCtx = pixelCanvas.getContext('2d');
    pixelCtx.imageSmoothingEnabled = false;
    
    setupInputListeners();
    // Render.run(render); // DO NOT RUN THE MATTER RENDERER

    if (runner) Runner.stop(runner);
    runner = Runner.create();
    Runner.run(runner, engine); // Runner still updates the physics engine

    Events.on(engine, 'beforeUpdate', updateGame); // Changed to a single updateGame function
    Events.on(engine, 'collisionStart', handleCollisions);
    
    // Start custom rendering loop
    gameRenderLoop();

    isGameOver = false;
    team1Score = 0;
    team2Score = 0;
    updateScoreDisplay();
    showGameMessage('');
    timerDisplay.textContent = "Time: 0"; // Or actual timer if implemented
}

function createField() {
    const ground = Bodies.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT - GROUND_THICKNESS / 2, CANVAS_WIDTH, GROUND_THICKNESS, { isStatic: true, label: 'ground', render: { fillStyle: '#B8860B' } });
    const leftWall = Bodies.rectangle(WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, label: 'wall-left', render: { fillStyle: '#808080' } });
    const rightWall = Bodies.rectangle(CANVAS_WIDTH - WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, label: 'wall-right', render: { fillStyle: '#808080' } });
    const ceiling = Bodies.rectangle(CANVAS_WIDTH / 2, WALL_THICKNESS / 2, CANVAS_WIDTH, WALL_THICKNESS, { isStatic: true, label: 'ceiling', render: { fillStyle: '#808080' } });
    const goalY = CANVAS_HEIGHT - GROUND_THICKNESS - GOAL_HEIGHT / 2;
    const goalPostRender = { fillStyle: '#FFFFFF' };
    const goalSensorRenderLeft = { fillStyle: 'rgba(255, 100, 100, 0.3)' };
    const goalSensorRenderRight = { fillStyle: 'rgba(100, 100, 255, 0.3)' };
    const leftGoalSensor = Bodies.rectangle(WALL_THICKNESS + GOAL_SENSOR_DEPTH / 2, goalY, GOAL_SENSOR_DEPTH, GOAL_HEIGHT, { isStatic: true, isSensor: true, label: 'goal-left', render: goalSensorRenderLeft });
    const leftPostTop = Bodies.rectangle(WALL_THICKNESS, goalY - GOAL_HEIGHT / 2 + 5 , 10, 10, { isStatic: true, render: goalPostRender });
    const leftPostBottom = Bodies.rectangle(WALL_THICKNESS, goalY + GOAL_HEIGHT / 2 - 5, 10, 10, { isStatic: true, render: goalPostRender });
    const rightGoalSensor = Bodies.rectangle(CANVAS_WIDTH - WALL_THICKNESS - GOAL_SENSOR_DEPTH / 2, goalY, GOAL_SENSOR_DEPTH, GOAL_HEIGHT, { isStatic: true, isSensor: true, label: 'goal-right', render: goalSensorRenderRight });
    const rightPostTop = Bodies.rectangle(CANVAS_WIDTH - WALL_THICKNESS, goalY - GOAL_HEIGHT / 2 + 5, 10, 10, { isStatic: true, render: goalPostRender });
    const rightPostBottom = Bodies.rectangle(CANVAS_WIDTH - WALL_THICKNESS, goalY + GOAL_HEIGHT / 2 - 5, 10, 10, { isStatic: true, render: goalPostRender });
    World.add(world, [ground, leftWall, rightWall, ceiling, leftGoalSensor, leftPostTop, leftPostBottom, rightGoalSensor, rightPostTop, rightPostBottom]);
}

function createBall() {
    ball = Bodies.circle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 150, BALL_RADIUS, {
        label: 'ball',
        density: 0.001,
        friction: 0.01,
        frictionAir: 0.008, // Increased for slightly less floaty ball
        restitution: 0.7,  // Reduced for slightly less bounciness
        render: { fillStyle: BALL_COLOR, strokeStyle: '#333', lineWidth: 2 }
    });
    World.add(world, ball);
}

// Added isAI parameter
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
        density: PLAYER_DENSITY * 1.1, friction: PLAYER_PART_FRICTION + 0.1, restitution: PLAYER_PART_RESTITUTION * 0.9, angle: -0.1, render: { fillStyle: teamColor }
    });
    const rightLeg = Bodies.rectangle(x + legXOffset, legYPos, LEG_WIDTH, LEG_HEIGHT, {
        label: (isTeam1 ? 'player-t1' : 'player-t2') + '-leg-right', collisionFilter: { group: group },
        density: PLAYER_DENSITY * 1.1, friction: PLAYER_PART_FRICTION + 0.1, restitution: PLAYER_PART_RESTITUTION * 0.9, angle: 0.1, render: { fillStyle: teamColor }
    });
    const constraintRenderOptions = { visible: false };
    const neckConstraint = Matter.Constraint.create({
        bodyA: head, bodyB: playerBody,
        pointA: { x: 0, y: HEAD_RADIUS * 0.5 }, pointB: { x: 0, y: -BODY_HEIGHT / 2 },
        length: 5, stiffness: 0.85, damping: 0.1, render: constraintRenderOptions
    });
    const leftHipConstraint = Matter.Constraint.create({
        bodyA: playerBody, bodyB: leftLeg,
        pointA: { x: -BODY_WIDTH / 2 * 0.7, y: BODY_HEIGHT / 2 * 0.9 }, pointB: { x: 0, y: -LEG_HEIGHT / 2 * 0.9 },
        length: 10, stiffness: 0.75, damping: 0.05, render: constraintRenderOptions
    });
    const rightHipConstraint = Matter.Constraint.create({
        bodyA: playerBody, bodyB: rightLeg,
        pointA: { x: BODY_WIDTH / 2 * 0.7, y: BODY_HEIGHT / 2 * 0.9 }, pointB: { x: 0, y: -LEG_HEIGHT / 2 * 0.9 },
        length: 10, stiffness: 0.75, damping: 0.05, render: constraintRenderOptions
    });
    const parts = [head, playerBody, leftLeg, rightLeg];
    const constraints = [neckConstraint, leftHipConstraint, rightHipConstraint];
    World.add(world, [...parts, ...constraints]);
    return {
        head: head, body: playerBody, leftLeg: leftLeg, rightLeg: rightLeg,
        parts: parts, constraints: constraints, color: teamColor, team: isTeam1 ? 1 : 2,
        inputKey: inputKey, actionCooldown: 0, isAI: isAI // Added isAI property
    };
}

function setupInputListeners() {
    document.addEventListener('keydown', (event) => {
        if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(event.code)) event.preventDefault(); // KeyS might be used by P2 later
        keysPressed[event.code] = true;
    });
    document.addEventListener('keyup', (event) => { keysPressed[event.code] = false; });
}

// Combined game update function
function updateGame() {
    if (isGameOver) return;
    handleHumanPlayerControls(); // Renamed for clarity
    updateAIPlayers();         // New function for AI logic
}

function handleHumanPlayerControls() {
    if (isGameOver) return;

    players.forEach(player => {
        if (player.isAI) return; // Only control human player(s)

        if (player.actionCooldown > 0) {
            player.actionCooldown--;
        }

        if (keysPressed[player.inputKey] && player.actionCooldown === 0) {
            player.actionCooldown = PLAYER_ACTION_COOLDOWN_FRAMES;

            // --- Improved Jumping ---
            Body.applyForce(player.leftLeg, player.leftLeg.position, { x: (Math.random()-0.5)*0.005, y: -PLAYER_JUMP_FORCE_LEGS * 0.5 });
            Body.applyForce(player.rightLeg, player.rightLeg.position, { x: (Math.random()-0.5)*0.005, y: -PLAYER_JUMP_FORCE_LEGS * 0.5 });
            Body.applyForce(player.body, player.body.position, { x: 0, y: -PLAYER_JUMP_FORCE_BODY });

            let horizontalForceDirection = (player.team === 1) ? 1 : -1;
            const randomXFlail = (Math.random() - 0.5) * 0.010; // Reduced random flail a bit
            Body.applyForce(player.body, player.body.position, { x: horizontalForceDirection * PLAYER_FLAIL_HORIZONTAL_FORCE + randomXFlail, y: 0 });
            Body.applyForce(player.body, { x: player.body.position.x + (Math.random() - 0.5) * 5, y: player.body.position.y }, { x: 0, y: -0.003 }); // Reduced spin force


            // --- Directional Kick Logic ---
            if (ball) {
                const opponentGoalX = (player.team === 1) ? CANVAS_WIDTH - WALL_THICKNESS : WALL_THICKNESS;
                const goalCenterY = CANVAS_HEIGHT - GROUND_THICKNESS - GOAL_HEIGHT / 2;

                const distLeftLegToBall = Matter.Vector.magnitude(Matter.Vector.sub(ball.position, player.leftLeg.position));
                const distRightLegToBall = Matter.Vector.magnitude(Matter.Vector.sub(ball.position, player.rightLeg.position));

                let kickingFootPosition;
                let kickingFootBody;

                if (distLeftLegToBall < distRightLegToBall) {
                    kickingFootPosition = player.leftLeg.position;
                    kickingFootBody = player.leftLeg;
                } else {
                    kickingFootPosition = player.rightLeg.position;
                    kickingFootBody = player.rightLeg;
                }

                const distFootToBallActual = Matter.Vector.magnitude(Matter.Vector.sub(ball.position, kickingFootPosition));

                if (distFootToBallActual < KICK_RANGE) {
                    const kickTargetPos = { x: opponentGoalX, y: goalCenterY };
                    let kickVector = Matter.Vector.sub(kickTargetPos, kickingFootPosition); // Vector from foot to goal
                    kickVector = Matter.Vector.normalise(kickVector);

                    // Add a slight upward trajectory to the kick
                    kickVector.y -= 0.30; // Increased lift for human player's kick
                    kickVector = Matter.Vector.normalise(kickVector); // Re-normalize after adjusting y

                    Body.applyForce(ball, ball.position, { // Apply force at ball's center
                        x: kickVector.x * KICK_FORCE_MAGNITUDE,
                        y: kickVector.y * KICK_FORCE_MAGNITUDE
                    });

                    // Small visual recoil on kicking leg
                    Body.applyForce(kickingFootBody, kickingFootPosition, {
                        x: -kickVector.x * KICK_FORCE_MAGNITUDE * 0.1, // Recoil proportional to kick
                        y: -kickVector.y * KICK_FORCE_MAGNITUDE * 0.1  - 0.005 // Extra little hop for the leg
                    });
                }
            }
        }
    });
}

function updateAIPlayers() {
// AI logic updated here
    players.forEach(player => {
        if (player.isAI) {
            // Update AI player's action cooldown
            if (player.actionCooldown > 0) {
                player.actionCooldown--;
            }
            executeAIPlayerLogic(player);
        }
    });
}

function executeAIPlayerLogic(player) {
    if (!ball || isGameOver) return; // No ball or game over, no AI action

    const ballPos = ball.position;
    const playerPos = player.body.position;

    // 1. Basic Movement: Nudge towards the ball
    const directionToBallX = ballPos.x - playerPos.x;
    let moveForceX = 0;
    if (Math.abs(directionToBallX) > BALL_RADIUS + player.body.width / 2) { // Don't nudge if very close/overlapping
        moveForceX = Math.sign(directionToBallX) * AI_MOVE_FORCE;
        // Apply force to the AI player's main body to move it
        Body.applyForce(player.body, playerPos, { x: moveForceX, y: (Math.random() - 0.5) * AI_MOVE_FORCE * 0.1 }); // Tiny random y for less robotic movement
    }

    // 2. Action Decision (Jump/Kick/Flail)
    const distanceToBall = Matter.Vector.magnitude(Matter.Vector.sub(ballPos, playerPos));

    if (distanceToBall < AI_ACTION_RANGE && player.actionCooldown === 0) {
        // AI acts less frequently and with less power
        player.actionCooldown = PLAYER_ACTION_COOLDOWN_FRAMES * (1.8 + Math.random() * 0.7);

        let horizontalActionForceDirection;
        if (player.team === 1) {
            horizontalActionForceDirection = 1;
        } else {
            horizontalActionForceDirection = -1;
        }

        const randomXComponent = (Math.random() - 0.5) * 0.015; // AI is a bit less horizontally aggressive
        const randomYComponent = -AI_KICK_ATTEMPT_STRENGTH * (0.5 + Math.random() * 0.4); // AI jumps a bit less powerfully/high

        Body.applyForce(player.body, playerPos, {
            x: horizontalActionForceDirection * PLAYER_FLAIL_HORIZONTAL_FORCE * 0.5 + randomXComponent, // Reduced base horizontal force for AI
            y: randomYComponent
        });

        // Reduced leg force for AI
        Body.applyForce(player.leftLeg, player.leftLeg.position, { x: (Math.random() - 0.5) * 0.01, y: -AI_KICK_ATTEMPT_STRENGTH * 0.1 });
        Body.applyForce(player.rightLeg, player.rightLeg.position, { x: (Math.random() - 0.5) * 0.01, y: -AI_KICK_ATTEMPT_STRENGTH * 0.1 });

        if (Math.random() < 0.3) { // Slightly reduced chance of AI spinning
            Body.applyForce(player.body,
                { x: player.body.position.x + (Math.random() - 0.5) * 6, y: player.body.position.y }, // Less spin force
                { x: 0, y: -0.002 }
            );
        }
    }
}

let goalScoredRecently = false;
function handleGoalScored(scoringTeam) {
    if (isGameOver || goalScoredRecently) return;
    goalScoredRecently = true;
    if (scoringTeam === 1) team1Score++; else if (scoringTeam === 2) team2Score++;
    updateScoreDisplay();
    if (checkWinCondition()) return;
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
    if (team1Score >= SCORE_TO_WIN) winner = 1;
    else if (team2Score >= SCORE_TO_WIN) winner = 2;
    if (winner) {
        isGameOver = true;
        showGameMessage(`Team ${winner} Wins! Final Score: ${team1Score} - ${team2Score}`);
        if (runner) Runner.stop(runner);
        return true;
    }
    return false;
}

function resetPositions() {
    if (ball) {
        Body.setPosition(ball, { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 - 150 });
        Body.setVelocity(ball, { x: 0, y: 0 }); Body.setAngularVelocity(ball, 0);
    }
    // Initial positions for 2v2 (Human P0, AI P1 vs AI P2, AI P3)
    const team1_P0_Start = { x: CANVAS_WIDTH / 4 - 30, y: CANVAS_HEIGHT / 2 };
    const team1_P1_Start = { x: CANVAS_WIDTH / 4 + 30, y: CANVAS_HEIGHT / 2 - 50 };
    const team2_P2_Start = { x: CANVAS_WIDTH * 3 / 4 + 30, y: CANVAS_HEIGHT / 2 };
    const team2_P3_Start = { x: CANVAS_WIDTH * 3 / 4 - 30, y: CANVAS_HEIGHT / 2 - 50 };

    const startPositions = [team1_P0_Start, team1_P1_Start, team2_P2_Start, team2_P3_Start];

    players.forEach((player, index) => {
        const startX = startPositions[index].x;
        const startY = startPositions[index].y;

        Body.setPosition(player.body, { x: startX, y: startY });
        Body.setVelocity(player.body, { x: 0, y: 0 }); Body.setAngularVelocity(player.body, 0); Body.setAngle(player.body, 0);
        Body.setPosition(player.head, { x: startX, y: startY - BODY_HEIGHT / 2 - HEAD_RADIUS + 5 });
        Body.setVelocity(player.head, { x: 0, y: 0 }); Body.setAngularVelocity(player.head, 0); Body.setAngle(player.head, 0);
        const legY = startY + BODY_HEIGHT / 2 + LEG_HEIGHT / 2 - 10;
        const legXOffset = BODY_WIDTH / 3;
        Body.setPosition(player.leftLeg, { x: startX - legXOffset, y: legY });
        Body.setVelocity(player.leftLeg, { x: 0, y: 0 }); Body.setAngularVelocity(player.leftLeg, 0); Body.setAngle(player.leftLeg, -0.1);
        Body.setPosition(player.rightLeg, { x: startX + legXOffset, y: legY });
        Body.setVelocity(player.rightLeg, { x: 0, y: 0 }); Body.setAngularVelocity(player.rightLeg, 0); Body.setAngle(player.rightLeg, 0.1);
        player.actionCooldown = 0;
    });
}

function handleCollisions(event) {
    if (isGameOver) return;
    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;
        if (bodyA.label === 'ball' || bodyB.label === 'ball') {
            const otherBody = (bodyA.label === 'ball') ? bodyB : bodyA;
            if (otherBody.label === 'goal-left') handleGoalScored(2); // Team 2 scores in left goal
            else if (otherBody.label === 'goal-right') handleGoalScored(1); // Team 1 scores in right goal
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
    customRenderAll(); // Draw the game with pixel art
    requestAnimationFrame(gameRenderLoop);
}

function drawPixelRectangle(pCtx, body, colorOverride = null) {
    const x = body.position.x / PIXEL_SCALE;
    const y = body.position.y / PIXEL_SCALE;
    let pWidth, pHeight;

    // Determine dimensions based on label or a fallback for generic static bodies
    // This is a simplified way to map physics bodies to pixel sizes.
    // For dynamic bodies like players, use their predefined constants.
    // For static, it's trickier if they aren't simple axis-aligned rects from Bodies.rectangle.
    // We'll use a rough estimation from bounds for unspecific static bodies.

    const label = body.label || '';
    if (label.includes('body')) { pWidth = BODY_WIDTH / PIXEL_SCALE; pHeight = BODY_HEIGHT / PIXEL_SCALE; }
    else if (label.includes('leg')) { pWidth = LEG_WIDTH / PIXEL_SCALE; pHeight = LEG_HEIGHT / PIXEL_SCALE; }
    else if (label === 'ground') { pWidth = CANVAS_WIDTH / PIXEL_SCALE; pHeight = GROUND_THICKNESS / PIXEL_SCALE; }
    else if (label.includes('wall')) { // Assuming full height walls
        pWidth = WALL_THICKNESS / PIXEL_SCALE; pHeight = CANVAS_HEIGHT / PIXEL_SCALE;
        if (label === 'wall-left' && x > pWidth) { /* adjust x for left wall if needed */ } // x is center
        else if (label === 'wall-right' && x < PIXEL_CANVAS_WIDTH - pWidth) { /* adjust x for right wall */ }
    }
    else if (label === 'ceiling') { pWidth = CANVAS_WIDTH / PIXEL_SCALE; pHeight = WALL_THICKNESS / PIXEL_SCALE; }
    else if (label.includes('post')) { // For goal posts (visual cues)
        // The goal posts in createField are 10 wide in world units, so 10/PIXEL_SCALE
        pWidth = Math.max(1, 10 / PIXEL_SCALE); pHeight = Math.max(1, GOAL_HEIGHT / PIXEL_SCALE);
    }
    else { // Fallback for other static rectangles (e.g. if we add more misc field parts)
        const boundsWidth = (body.bounds.max.x - body.bounds.min.x) / PIXEL_SCALE;
        const boundsHeight = (body.bounds.max.y - body.bounds.min.y) / PIXEL_SCALE;
        pWidth = Math.max(1, Math.round(boundsWidth));
        pHeight = Math.max(1, Math.round(boundsHeight));
    }

    pCtx.fillStyle = colorOverride || (body.render && body.render.fillStyle) || '#333'; // Default to dark grey if no color

    pCtx.save();
    pCtx.translate(x, y);
    pCtx.rotate(body.angle); // Rotate dynamic bodies like player parts
    pCtx.fillRect(-pWidth / 2, -pHeight / 2, pWidth, pHeight);
    pCtx.restore();
}

function drawPixelCircle(pCtx, body, colorOverride = null) {
    const x = body.position.x / PIXEL_SCALE;
    const y = body.position.y / PIXEL_SCALE;
    const radius = (body.circleRadius || HEAD_RADIUS) / PIXEL_SCALE; // Use HEAD_RADIUS as fallback for player heads

    pCtx.fillStyle = colorOverride || (body.render && body.render.fillStyle) || '#333';
    pCtx.beginPath();
    // Draw a "pixelated" circle by drawing a small square or a few squares
    // For simplicity, a small filled circle on low-res canvas is fine for MVP
    pCtx.arc(x, y, Math.max(1, radius), 0, Math.PI * 2);
    pCtx.fill();
}

function customRenderAll() {
    // Clear off-screen pixel canvas
    pixelCtx.fillStyle = '#ACE1AF'; // Background color for pixel canvas (same as main canvas default)
    pixelCtx.fillRect(0, 0, PIXEL_CANVAS_WIDTH, PIXEL_CANVAS_HEIGHT);

    // Draw static field elements
    // Iterate through specific field bodies we know exist, rather than all static bodies
    // This avoids trying to render goal sensors, for example.
    const fieldBodies = World.getAllBodies(world).filter(body =>
        body.isStatic &&
        (body.label === 'ground' || body.label.includes('wall') || body.label === 'ceiling' || body.label.includes('post')) &&
        (!body.isSensor) // Don't draw sensors
    );

    fieldBodies.forEach(body => {
        drawPixelRectangle(pixelCtx, body); // Uses body.render.fillStyle
    });

    // Draw ball
    if (ball) {
        drawPixelCircle(pixelCtx, ball, BALL_COLOR);
    }

    // Draw players
    players.forEach(player => {
        player.parts.forEach(part => {
            if (part.label.includes('head')) {
                drawPixelCircle(pixelCtx, part, player.color);
            } else {
                drawPixelRectangle(pixelCtx, part, player.color);
            }
        });
    });

    // Draw pixelCanvas to main canvas (scaled up)
    const mainCtx = canvas.getContext('2d');
    mainCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    mainCtx.imageSmoothingEnabled = false;
    mainCtx.drawImage(
        pixelCanvas,
        0, 0, PIXEL_CANVAS_WIDTH, PIXEL_CANVAS_HEIGHT,
        0, 0, CANVAS_WIDTH, CANVAS_HEIGHT
    );
}


document.addEventListener('DOMContentLoaded', setup);
