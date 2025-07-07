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

// --- Game Variables ---
let engine;
let world;
let render;
let runner;
let isGameOver = false;
let team1Score = 0;
let team2Score = 0;
let ball;
let players = [];

// --- Field Constants ---
const GROUND_THICKNESS = 40;
const WALL_THICKNESS = 20;
const GOAL_HEIGHT = 120;
const GOAL_SENSOR_DEPTH = 30;

// --- Player Constants ---
const PLAYER_TEAM1_COLOR = '#D9534F'; // Reddish
const PLAYER_TEAM2_COLOR = '#428BCA'; // Bluish
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
const PLAYER_JUMP_FORCE = 0.035;
const PLAYER_FLAIL_HORIZONTAL_FORCE = 0.01;
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

    const playerControlKeys = ['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'];
    players = [];
    players.push(createPlayer(CANVAS_WIDTH / 4, CANVAS_HEIGHT / 2 - 100, PLAYER_TEAM1_COLOR, true, playerControlKeys[0]));
    players.push(createPlayer(CANVAS_WIDTH / 4 + 60, CANVAS_HEIGHT / 2 - 80, PLAYER_TEAM1_COLOR, true, playerControlKeys[1]));
    players.push(createPlayer(CANVAS_WIDTH * 3 / 4, CANVAS_HEIGHT / 2 - 100, PLAYER_TEAM2_COLOR, false, playerControlKeys[2]));
    players.push(createPlayer(CANVAS_WIDTH * 3 / 4 - 60, CANVAS_HEIGHT / 2 - 80, PLAYER_TEAM2_COLOR, false, playerControlKeys[3]));
    
    setupInputListeners();
    Render.run(render);

    if (runner) Runner.stop(runner);
    runner = Runner.create();
    Runner.run(runner, engine);

    Events.on(engine, 'beforeUpdate', handlePlayerControls);
    Events.on(engine, 'collisionStart', handleCollisions);
    
    isGameOver = false;
    team1Score = 0;
    team2Score = 0;
    updateScoreDisplay();
    showGameMessage('');
    timerDisplay.textContent = "Time: 0";
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
        density: 0.001, friction: 0.01, frictionAir: 0.005, restitution: 0.75,
        render: { fillStyle: '#FFDE00', strokeStyle: '#333', lineWidth: 2 }
    });
    World.add(world, ball);
}

function createPlayer(x, y, teamColor, isTeam1, inputKey) {
    const group = Body.nextGroup(true); // Prevent self-collision

    const head = Bodies.circle(
        x, y - BODY_HEIGHT / 2 - HEAD_RADIUS + 5, HEAD_RADIUS,
        {
            label: (isTeam1 ? 'player-t1' : 'player-t2') + '-head',
            collisionFilter: { group: group },
            density: PLAYER_DENSITY * 0.8,
            friction: PLAYER_PART_FRICTION,
            restitution: PLAYER_PART_RESTITUTION,
            render: { fillStyle: teamColor }
        }
    );

    const playerBody = Bodies.rectangle(
        x, y, BODY_WIDTH, BODY_HEIGHT,
        {
            label: (isTeam1 ? 'player-t1' : 'player-t2') + '-body',
            collisionFilter: { group: group },
            density: PLAYER_DENSITY,
            friction: PLAYER_PART_FRICTION,
            restitution: PLAYER_PART_RESTITUTION,
            render: { fillStyle: teamColor }
        }
    );

    const legYPos = y + BODY_HEIGHT / 2 + LEG_HEIGHT / 2 - 10;
    const legXOffset = BODY_WIDTH / 3;

    const leftLeg = Bodies.rectangle(
        x - legXOffset, legYPos, LEG_WIDTH, LEG_HEIGHT,
        {
            label: (isTeam1 ? 'player-t1' : 'player-t2') + '-leg-left',
            collisionFilter: { group: group },
            density: PLAYER_DENSITY * 1.1,
            friction: PLAYER_PART_FRICTION + 0.1,
            restitution: PLAYER_PART_RESTITUTION * 0.9,
            angle: -0.1,
            render: { fillStyle: teamColor }
        }
    );

    const rightLeg = Bodies.rectangle(
        x + legXOffset, legYPos, LEG_WIDTH, LEG_HEIGHT,
        {
            label: (isTeam1 ? 'player-t1' : 'player-t2') + '-leg-right',
            collisionFilter: { group: group },
            density: PLAYER_DENSITY * 1.1,
            friction: PLAYER_PART_FRICTION + 0.1,
            restitution: PLAYER_PART_RESTITUTION * 0.9,
            angle: 0.1,
            render: { fillStyle: teamColor }
        }
    );

    const constraintRenderOptions = { visible: false };

    const neckConstraint = Matter.Constraint.create({
        bodyA: head, bodyB: playerBody,
        pointA: { x: 0, y: HEAD_RADIUS * 0.5 }, pointB: { x: 0, y: -BODY_HEIGHT / 2 },
        length: 5, stiffness: 0.7, damping: 0.2, render: constraintRenderOptions
    });

    const leftHipConstraint = Matter.Constraint.create({
        bodyA: playerBody, bodyB: leftLeg,
        pointA: { x: -BODY_WIDTH / 2 * 0.7, y: BODY_HEIGHT / 2 * 0.9 }, pointB: { x: 0, y: -LEG_HEIGHT / 2 * 0.9 },
        length: 10, stiffness: 0.6, damping: 0.1, render: constraintRenderOptions
    });

    const rightHipConstraint = Matter.Constraint.create({
        bodyA: playerBody, bodyB: rightLeg,
        pointA: { x: BODY_WIDTH / 2 * 0.7, y: BODY_HEIGHT / 2 * 0.9 }, pointB: { x: 0, y: -LEG_HEIGHT / 2 * 0.9 },
        length: 10, stiffness: 0.6, damping: 0.1, render: constraintRenderOptions
    });
    
    const parts = [head, playerBody, leftLeg, rightLeg];
    const constraints = [neckConstraint, leftHipConstraint, rightHipConstraint];
    
    World.add(world, [...parts, ...constraints]);

    return {
        head: head, body: playerBody, leftLeg: leftLeg, rightLeg: rightLeg,
        parts: parts, constraints: constraints,
        color: teamColor, team: isTeam1 ? 1 : 2,
        inputKey: inputKey, actionCooldown: 0
    };
}

function setupInputListeners() {
    document.addEventListener('keydown', (event) => {
        if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(event.code)) event.preventDefault();
        keysPressed[event.code] = true;
    });
    document.addEventListener('keyup', (event) => { keysPressed[event.code] = false; });
}

function handlePlayerControls() {
    if (isGameOver) return;
    players.forEach(player => {
        if (player.actionCooldown > 0) player.actionCooldown--;
        if (keysPressed[player.inputKey] && player.actionCooldown === 0) {
            player.actionCooldown = PLAYER_ACTION_COOLDOWN_FRAMES;
            let horizontalForceDirection = (player.team === 1) ? 1 : -1;
            const randomX = (Math.random() - 0.5) * 0.015;
            const randomY = -PLAYER_JUMP_FORCE * (0.8 + Math.random() * 0.4);
            Body.applyForce(player.body, player.body.position, { x: horizontalForceDirection * PLAYER_FLAIL_HORIZONTAL_FORCE + randomX, y: randomY });
            Body.applyForce(player.body, { x: player.body.position.x + (Math.random() - 0.5) * 10, y: player.body.position.y }, { x: 0, y: -0.005 });
            Body.applyForce(player.leftLeg, player.leftLeg.position, { x: (Math.random() - 0.7) * 0.01, y: (Math.random() - 0.5) * 0.005 });
            Body.applyForce(player.rightLeg, player.rightLeg.position, { x: (Math.random() - 0.3) * 0.01, y: (Math.random() - 0.5) * 0.005 });
        }
    });
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
    players.forEach((player, index) => {
        let startX, startY;
        if (player.team === 1) {
            startX = (index % 2 === 0) ? CANVAS_WIDTH / 4 : CANVAS_WIDTH / 4 + 60;
            startY = (index % 2 === 0) ? CANVAS_HEIGHT / 2 - 100 : CANVAS_HEIGHT / 2 - 80;
        } else {
            const team2Index = index - 2; // Adjust index for team 2
            startX = (team2Index % 2 === 0) ? CANVAS_WIDTH * 3 / 4 : CANVAS_WIDTH * 3 / 4 - 60;
            startY = (team2Index % 2 === 0) ? CANVAS_HEIGHT / 2 - 100 : CANVAS_HEIGHT / 2 - 80;
        }
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
            if (otherBody.label === 'goal-left') handleGoalScored(2);
            else if (otherBody.label === 'goal-right') handleGoalScored(1);
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

document.addEventListener('DOMContentLoaded', setup);
