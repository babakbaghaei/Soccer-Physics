// --- Matter.js Aliases ---
const Engine = Matter.Engine;
const Render = Matter.Render;
const Runner = Matter.Runner;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Events = Matter.Events;
const Composite = Matter.Composite; // If needed for grouping bodies

// --- DOM Element References ---
const canvas = document.getElementById('gameCanvas');
const team1ScoreDisplay = document.getElementById('team1ScoreDisplay');
const team2ScoreDisplay = document.getElementById('team2ScoreDisplay');
const timerDisplay = document.getElementById('timerDisplay'); // Will use for round timer later
const gameMessageDisplay = document.getElementById('gameMessage');

// --- Game Constants ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// --- Game Variables ---
const SCORE_TO_WIN = 3;
let isGameOver = false;

let engine;
let world;
let render;
let runner;

let team1Score = 0;
let team2Score = 0;
let ball;
let players = []; // Array to hold player objects
// More game state variables will be added here (players, ball, etc.)

// --- Player Constants ---
const PLAYER_TEAM1_COLOR = '#D9534F'; // Reddish
const PLAYER_TEAM2_COLOR = '#428BCA'; // Bluish
const PLAYER_PART_FRICTION = 0.5;
const PLAYER_PART_RESTITUTION = 0.4;
const PLAYER_DENSITY = 0.002;

// --- Ragdoll Parts Dimensions ---
const HEAD_RADIUS = 15;
const BODY_WIDTH = 25;
const BODY_HEIGHT = 40;
const LEG_WIDTH = 15;
const LEG_HEIGHT = 35;


// --- Initialization Function ---
function setup() {
    // Create Matter.js Engine
    engine = Engine.create();
    world = engine.world;
    engine.world.gravity.y = 1; // Standard gravity

    // Create Matter.js Renderer
    render = Render.create({
        canvas: canvas,
        engine: engine,
        options: {
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            wireframes: false, // Show filled shapes
            background: '#e0ffe0', // Light green, same as CSS for consistency
            showAngleIndicator: false, // Don't show angle indicator on bodies
            // showCollisions: true, // Useful for debugging
            // showVelocity: true    // Useful for debugging
        }
    });

    // Set canvas dimensions explicitly (though renderer does it too)
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // --- Placeholder for game objects (field, players, ball) ---
    createField(); // Create the field boundaries and goals
    createBall(); // Create the ball

    createField(); // Create the field boundaries and goals
    createBall(); // Create the ball

    // Define controls mapping
    const playerControlKeys = ['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'];

    // Create Players
    // Team 1
    players.push(createPlayer(CANVAS_WIDTH / 4, CANVAS_HEIGHT / 2 - 100, PLAYER_TEAM1_COLOR, true));
    players[0].inputKey = playerControlKeys[0];
    players.push(createPlayer(CANVAS_WIDTH / 4 + 60, CANVAS_HEIGHT / 2 - 80, PLAYER_TEAM1_COLOR, true));
    players[1].inputKey = playerControlKeys[1];
    // Team 2
    players.push(createPlayer(CANVAS_WIDTH * 3 / 4, CANVAS_HEIGHT / 2 - 100, PLAYER_TEAM2_COLOR, false));
    players[2].inputKey = playerControlKeys[2];
    players.push(createPlayer(CANVAS_WIDTH * 3 / 4 - 60, CANVAS_HEIGHT / 2 - 80, PLAYER_TEAM2_COLOR, false));
    players[3].inputKey = playerControlKeys[3];
    
    setupInputListeners(); // Initialize keyboard listeners

    // Start the renderer
    Render.run(render);
    runner = Runner.create();
    Runner.run(runner, engine);

    // Hook player controls into the game loop
    // Hook player controls into the game loop
    Events.on(engine, 'beforeUpdate', handlePlayerControls);

    // Collision detection for goals
    Events.on(engine, 'collisionStart', (event) => {
        if (isGameOver) return; // Don't process new collisions if game is over
        const pairs = event.pairs;
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;

            if (bodyA.label === 'ball' || bodyB.label === 'ball') {
                const otherBody = (bodyA.label === 'ball') ? bodyB : bodyA;

                if (otherBody.label === 'goal-left') {
                    handleGoalScored(2);
                } else if (otherBody.label === 'goal-right') {
                    handleGoalScored(1);
                }
            }
        }
    });
    
    isGameOver = false; // Reset game over state at the start
    team1Score = 0;     // Reset scores
    team2Score = 0;
    updateScoreDisplay(); // Initialize score display
    showGameMessage(''); // Clear any previous game messages
    
    // Ensure runner is running if setup is called multiple times (e.g. for a play again feature later)
    if (runner && runner.enabled === false) {
        Runner.run(runner, engine);
    } else if (!runner) {
        runner = Runner.create();
        Runner.run(runner, engine);
    }
    // If runner exists and is enabled, do nothing.
}
// Make sure setupInputListeners and handlePlayerControls are defined before setup if not already.
// The current placement of these functions (after createPlayer but before setup's first call to them) is fine.
// However, it's common practice to define functions before they are referenced if not hoisted.
// For this script, it works due to hoisting or order of execution.

    // Create and run the physics engine runner
    runner = Runner.create();
    Runner.run(runner, engine);

    // Initial score display update
    updateScoreDisplay();

    // Placeholder for game loop logic that isn't physics updates
    // (e.g., checking win conditions, timer updates)
    // For now, Matter.Runner handles the physics loop.
    // We might add a separate requestAnimationFrame loop for non-physics game logic if needed.
    // Events.on(engine, 'afterUpdate', gameLoop); // Example of hooking into engine's loop
}

// --- Update Score Display Function ---
function updateScoreDisplay() {
    team1ScoreDisplay.textContent = `Team 1: ${team1Score}`;
    team2ScoreDisplay.textContent = `Team 2: ${team2Score}`;
}

// --- Game Message Function ---
function showGameMessage(message) {
    gameMessageDisplay.textContent = message;
}

// --- Placeholder for Game Loop (called by engine event or RAF) ---
// function gameLoop() {
//    // Check win conditions, update timer, etc.
// }

// --- Field Constants ---
const GROUND_THICKNESS = 40;
const WALL_THICKNESS = 20;
const GOAL_HEIGHT = 120;
const GOAL_SENSOR_DEPTH = 30; // How deep the sensor is for goal detection

function createField() {
    // Ground
    const ground = Bodies.rectangle(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT - GROUND_THICKNESS / 2,
        CANVAS_WIDTH, GROUND_THICKNESS,
        { isStatic: true, label: 'ground', render: { fillStyle: '#B8860B' } } // Darker Brown ground
    );

    // Left Wall
    const leftWall = Bodies.rectangle(
        WALL_THICKNESS / 2, CANVAS_HEIGHT / 2,
        WALL_THICKNESS, CANVAS_HEIGHT,
        { isStatic: true, label: 'wall-left', render: { fillStyle: '#808080' } } // Grey wall
    );

    // Right Wall
    const rightWall = Bodies.rectangle(
        CANVAS_WIDTH - WALL_THICKNESS / 2, CANVAS_HEIGHT / 2,
        WALL_THICKNESS, CANVAS_HEIGHT,
        { isStatic: true, label: 'wall-right', render: { fillStyle: '#808080' } }
    );

    // Ceiling
    const ceiling = Bodies.rectangle(
        CANVAS_WIDTH / 2, WALL_THICKNESS / 2,
        CANVAS_WIDTH, WALL_THICKNESS,
        { isStatic: true, label: 'ceiling', render: { fillStyle: '#808080' } }
    );

    // Goals Sensors
    const goalY = CANVAS_HEIGHT - GROUND_THICKNESS - GOAL_HEIGHT / 2;
    const goalPostRender = { fillStyle: '#FFFFFF' }; // White posts
    const goalSensorRenderLeft = { fillStyle: 'rgba(255, 100, 100, 0.3)' }; // Light red
    const goalSensorRenderRight = { fillStyle: 'rgba(100, 100, 255, 0.3)' }; // Light blue

    // Left Goal Sensor (Team 2 scores here)
    const leftGoalSensor = Bodies.rectangle(
        WALL_THICKNESS + GOAL_SENSOR_DEPTH / 2, goalY,
        GOAL_SENSOR_DEPTH, GOAL_HEIGHT,
        { isStatic: true, isSensor: true, label: 'goal-left', render: goalSensorRenderLeft }
    );
    // Left Goal Posts (Visual only)
    const leftPostTop = Bodies.rectangle(WALL_THICKNESS, goalY - GOAL_HEIGHT / 2, 10, 10, { isStatic: true, render: goalPostRender });
    const leftPostBottom = Bodies.rectangle(WALL_THICKNESS, goalY + GOAL_HEIGHT / 2, 10, 10, { isStatic: true, render: goalPostRender });


    // Right Goal Sensor (Team 1 scores here)
    const rightGoalSensor = Bodies.rectangle(
        CANVAS_WIDTH - WALL_THICKNESS - GOAL_SENSOR_DEPTH / 2, goalY,
        GOAL_SENSOR_DEPTH, GOAL_HEIGHT,
        { isStatic: true, isSensor: true, label: 'goal-right', render: goalSensorRenderRight }
    );
    // Right Goal Posts (Visual only)
    const rightPostTop = Bodies.rectangle(CANVAS_WIDTH - WALL_THICKNESS, goalY - GOAL_HEIGHT / 2, 10, 10, { isStatic: true, render: goalPostRender });
    const rightPostBottom = Bodies.rectangle(CANVAS_WIDTH - WALL_THICKNESS, goalY + GOAL_HEIGHT / 2, 10, 10, { isStatic: true, render: goalPostRender });

    World.add(world, [
        ground, leftWall, rightWall, ceiling,
        leftGoalSensor, leftPostTop, leftPostBottom,
        rightGoalSensor, rightPostTop, rightPostBottom
    ]);
}

// --- Ball Constants ---
const BALL_RADIUS = 15;
const BALL_COLOR = '#FFDE00'; // Yellow ball

function createBall() {
    ball = Bodies.circle(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 150, // Start in the middle, a bit higher
        BALL_RADIUS,
        {
            label: 'ball',
            density: 0.001,
            friction: 0.01,
            frictionAir: 0.005,
            restitution: 0.75,
            render: {
                fillStyle: BALL_COLOR,
                strokeStyle: '#333',
                lineWidth: 2
            }
        }
    );
    World.add(world, ball);
}

function createPlayer(x, y, teamColor, isTeam1) {
    const group = Body.nextGroup(true); // Prevent self-collision within a player

    // --- Create Parts ---
    const head = Bodies.circle(x, y - BODY_HEIGHT / 2 - HEAD_RADIUS + 5, HEAD_RADIUS, { // Adjusted y for better connection
        label: (isTeam1 ? 'player-t1' : 'player-t2') + '-head',
        collisionFilter: { group: group },
        density: PLAYER_DENSITY * 0.8,
        friction: PLAYER_PART_FRICTION,
        restitution: PLAYER_PART_RESTITUTION,
        render: { fillStyle: teamColor }
    });

    const playerBody = Bodies.rectangle(x, y, BODY_WIDTH, BODY_HEIGHT, {
        label: (isTeam1 ? 'player-t1' : 'player-t2') + '-body',
        collisionFilter: { group: group },
        density: PLAYER_DENSITY,
        friction: PLAYER_PART_FRICTION,
        restitution: PLAYER_PART_RESTITUTION,
        render: { fillStyle: teamColor }
    });

    const legYOffset = BODY_HEIGHT / 2 + LEG_HEIGHT / 2 - 10; // Adjusted for better hip joint
    const legXOffset = BODY_WIDTH / 3; // Legs closer to center

    const leftLeg = Bodies.rectangle(x - legXOffset, y + legYOffset, LEG_WIDTH, LEG_HEIGHT, {
        label: (isTeam1 ? 'player-t1' : 'player-t2') + '-leg',
        collisionFilter: { group: group },
        density: PLAYER_DENSITY * 1.1, // Legs slightly denser
        friction: PLAYER_PART_FRICTION + 0.1, // Slightly more friction
        restitution: PLAYER_PART_RESTITUTION * 0.9,
        angle: -0.1, // Slight initial angle
        render: { fillStyle: teamColor }
    });

    const rightLeg = Bodies.rectangle(x + legXOffset, y + legYOffset, LEG_WIDTH, LEG_HEIGHT, {
        label: (isTeam1 ? 'player-t1' : 'player-t2') + '-leg',
        collisionFilter: { group: group },
        density: PLAYER_DENSITY * 1.1,
        friction: PLAYER_PART_FRICTION + 0.1,
        restitution: PLAYER_PART_RESTITUTION * 0.9,
        angle: 0.1, // Slight initial angle
        render: { fillStyle: teamColor }
    });

    // --- Create Constraints ---
    const constraintRender = { visible: false }; // Do not draw constraints

    const neck = Matter.Constraint.create({
        bodyA: head,
        bodyB: playerBody,
        pointA: { x: 0, y: HEAD_RADIUS * 0.5 }, // Connect lower part of head
        pointB: { x: 0, y: -BODY_HEIGHT / 2 }, // Connect top of body
        length: 5, // Shorter neck
        stiffness: 0.7,
        damping: 0.2, // More damping for less oscillation
        render: constraintRender
    });

    const leftHip = Matter.Constraint.create({
        bodyA: playerBody,
        bodyB: leftLeg,
        pointA: { x: -BODY_WIDTH / 2 * 0.7, y: BODY_HEIGHT / 2 * 0.9 }, // Connect lower inside of body
        pointB: { x: 0, y: -LEG_HEIGHT / 2 * 0.9 }, // Connect top of leg
        length: 10,
        stiffness: 0.6,
        damping: 0.1,
        render: constraintRender
    });

    const rightHip = Matter.Constraint.create({
        bodyA: playerBody,
        bodyB: rightLeg,
        pointA: { x: BODY_WIDTH / 2 * 0.7, y: BODY_HEIGHT / 2 * 0.9 },
        pointB: { x: 0, y: -LEG_HEIGHT / 2 * 0.9 },
        length: 10,
        stiffness: 0.6,
        damping: 0.1,
        render: constraintRender
    });
    
    const ragdollParts = [head, playerBody, leftLeg, rightLeg];
    const ragdollConstraints = [neck, leftHip, rightHip];
    
    World.add(world, [...ragdollParts, ...ragdollConstraints]);

    return {
        head: head,
        body: playerBody,
        leftLeg: leftLeg,
        rightLeg: rightLeg,
        parts: ragdollParts,
        constraints: ragdollConstraints,
        color: teamColor,
        team: isTeam1 ? 1 : 2,
        inputKey: null, // Will be assigned during creation
        actionCooldown: 0
    };
}

// --- Input State & Handling ---
const keysPressed = {};

function setupInputListeners() {
    document.addEventListener('keydown', (event) => {
        // To prevent page scrolling with arrow keys, etc.
        if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(event.code)) {
            event.preventDefault();
        }
        keysPressed[event.code] = true;
    });

    document.addEventListener('keyup', (event) => {
        keysPressed[event.code] = false;
    });
}

const PLAYER_ACTION_COOLDOWN_FRAMES = 30; // Cooldown in frames (e.g., 30 frames = 0.5s at 60fps)
const PLAYER_JUMP_FORCE = 0.035; // Base upward force
const PLAYER_FLAIL_HORIZONTAL_FORCE = 0.01; // Base horizontal force for flailing

function handlePlayerControls() {
    players.forEach(player => {
        if (player.actionCooldown > 0) {
            player.actionCooldown--;
        }

        if (keysPressed[player.inputKey] && player.actionCooldown === 0) {
            player.actionCooldown = PLAYER_ACTION_COOLDOWN_FRAMES;

            let horizontalForceDirection = 0;
            // Basic direction: Team 1 pushes right, Team 2 pushes left
            // This can be refined to be towards ball or opponent goal
            if (player.team === 1) {
                horizontalForceDirection = 1;
            } else {
                horizontalForceDirection = -1;
            }

            // Add some randomness to make it more "comical"
            const randomX = (Math.random() - 0.5) * 0.015; // Random horizontal component
            const randomY = -PLAYER_JUMP_FORCE * (0.8 + Math.random() * 0.4); // Randomize jump height a bit

            Body.applyForce(player.body, player.body.position, {
                x: horizontalForceDirection * PLAYER_FLAIL_HORIZONTAL_FORCE + randomX,
                y: randomY
            });

            // Apply slight torque for rotation by applying force off-center to the body
            Body.applyForce(player.body,
                { x: player.body.position.x + (Math.random() - 0.5) * 10, y: player.body.position.y },
                { x: 0, y: -0.005 } // Small upward force to induce spin
            );

            // Make legs kick out a bit
            Body.applyForce(player.leftLeg, player.leftLeg.position, {
                x: (Math.random() - 0.7) * 0.01, // Bias kick outwards/forwards
                y: (Math.random() - 0.5) * 0.005
            });
            Body.applyForce(player.rightLeg, player.rightLeg.position, {
                x: (Math.random() - 0.3) * 0.01, // Bias kick outwards/forwards
                y: (Math.random() - 0.5) * 0.005
            });
        }
    });
}


// --- Start the game ---
// Wait for the DOM to be fully loaded before setting up the game
document.addEventListener('DOMContentLoaded', setup);


// --- Game Logic Functions ---
function resetPositions() {
    // Reset Ball
    if (ball) {
        Body.setPosition(ball, { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 - 150 });
        Body.setVelocity(ball, { x: 0, y: 0 });
        Body.setAngularVelocity(ball, 0);
    }

    // Reset Players - using approximate initial setup positions
    players.forEach((player, index) => {
        let startX, startY;
        const playerIndexInTeam = Math.floor(index / 2); // 0 or 1 for team, then use actual index for pos
        const onTeam1 = player.team === 1;

        if (onTeam1) {
            startX = (index % 2 === 0) ? CANVAS_WIDTH / 4 : CANVAS_WIDTH / 4 + 60;
            startY = (index % 2 === 0) ? CANVAS_HEIGHT / 2 - 100 : CANVAS_HEIGHT / 2 - 80;
        } else { // Team 2
            // player index 2 is team 2 player 0, index 3 is team 2 player 1
            const team2Index = index - 2;
            startX = (team2Index % 2 === 0) ? CANVAS_WIDTH * 3 / 4 : CANVAS_WIDTH * 3 / 4 - 60;
            startY = (team2Index % 2 === 0) ? CANVAS_HEIGHT / 2 - 100 : CANVAS_HEIGHT / 2 - 80;
        }
        
        // Reset main body part
        Body.setPosition(player.body, { x: startX, y: startY });
        Body.setVelocity(player.body, { x: 0, y: 0 });
        Body.setAngularVelocity(player.body, 0);
        Body.setAngle(player.body, 0);


        // Reset head relative to new body position
        Body.setPosition(player.head, { x: startX, y: startY - BODY_HEIGHT / 2 - HEAD_RADIUS + 5 });
        Body.setVelocity(player.head, { x: 0, y: 0 });
        Body.setAngularVelocity(player.head, 0);
        Body.setAngle(player.head, 0);

        // Reset legs relative to new body position
        const legY = startY + BODY_HEIGHT / 2 + LEG_HEIGHT / 2 - 10;
        const legXOffset = BODY_WIDTH / 3;

        Body.setPosition(player.leftLeg, { x: startX - legXOffset, y: legY });
        Body.setVelocity(player.leftLeg, { x: 0, y: 0 });
        Body.setAngularVelocity(player.leftLeg, 0);
        Body.setAngle(player.leftLeg, -0.1);

        Body.setPosition(player.rightLeg, { x: startX + legXOffset, y: legY });
        Body.setVelocity(player.rightLeg, { x: 0, y: 0 });
        Body.setAngularVelocity(player.rightLeg, 0);
        Body.setAngle(player.rightLeg, 0.1);
        
        player.actionCooldown = 0; // Reset action cooldown
    });
}

let goalScoredRecently = false; // To prevent multiple score triggers for one event

function handleGoalScored(scoringTeam) {
    if (goalScoredRecently) return; // Debounce
    goalScoredRecently = true;

    if (scoringTeam === 1) {
        team1Score++;
    } else if (scoringTeam === 2) {
        team2Score++;
    }
    updateScoreDisplay();
    const originalMessage = gameMessageDisplay.textContent; // Store if there's a win message
    showGameMessage(`Goal for Team ${scoringTeam}!`);

    setTimeout(() => {
        // Only clear if it's still the goal message and not a win message
        if (gameMessageDisplay.textContent === `Goal for Team ${scoringTeam}!`) {
            showGameMessage(originalMessage || '');
        }
        goalScoredRecently = false; // Reset debounce after message clears or timeout
    }, 1800);

    resetPositions();
    // TODO: Check win condition
    checkWinCondition(); // Check for win after positions are reset and scores updated
}

function checkWinCondition() {
    if (isGameOver) return true; // Already decided

    let winner = null;
    if (team1Score >= SCORE_TO_WIN) {
        winner = 1;
    } else if (team2Score >= SCORE_TO_WIN) {
        winner = 2;
    }

    if (winner) {
        isGameOver = true;
        showGameMessage(`Team ${winner} Wins! Final Score: ${team1Score} - ${team2Score}`);
        if (runner) { // Ensure runner exists before trying to stop it
            Runner.stop(runner);
        }
        // Player controls are implicitly stopped by isGameOver flag in handlePlayerControls
        return true; // Win condition met
    }
    return false; // No winner yet
}

// Modify handlePlayerControls to check isGameOver
function handlePlayerControls() {
    if (isGameOver) return; // Stop controls if game is over

    players.forEach(player => {
        if (player.actionCooldown > 0) {
            player.actionCooldown--;
        }

        if (keysPressed[player.inputKey] && player.actionCooldown === 0) {
            player.actionCooldown = PLAYER_ACTION_COOLDOWN_FRAMES;

            let horizontalForceDirection = 0;
            if (player.team === 1) {
                horizontalForceDirection = 1;
            } else {
                horizontalForceDirection = -1;
            }

            const randomX = (Math.random() - 0.5) * 0.015;
            const randomY = -PLAYER_JUMP_FORCE * (0.8 + Math.random() * 0.4);

            Body.applyForce(player.body, player.body.position, {
                x: horizontalForceDirection * PLAYER_FLAIL_HORIZONTAL_FORCE + randomX,
                y: randomY
            });

            Body.applyForce(player.body,
                { x: player.body.position.x + (Math.random() - 0.5) * 10, y: player.body.position.y },
                { x: 0, y: -0.005 }
            );

            Body.applyForce(player.leftLeg, player.leftLeg.position, {
                x: (Math.random() - 0.7) * 0.01,
                y: (Math.random() - 0.5) * 0.005
            });
            Body.applyForce(player.rightLeg, player.rightLeg.position, {
                x: (Math.random() - 0.3) * 0.01,
                y: (Math.random() - 0.5) * 0.005
            });
        }
    });
}
