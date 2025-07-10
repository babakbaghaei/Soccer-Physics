// ===================================================================================
// Global Variables
// ===================================================================================
let scene, camera, renderer;
let field, player1Mesh, player2Mesh, ballMesh;
let directionalLight, ambientLight;
let players = [];
let ball;
let keysPressed = {};
let isKicking = false;
let aiKicking = false;
let team1Score = 0;
let team2Score = 0;
let gameTimeRemaining = 120;
let isGameOver = false;

// ===================================================================================
// Constants
// ===================================================================================
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 40;
const BALL_RADIUS = 15;
const GOAL_HEIGHT = 120;
const GOAL_WIDTH = 30;
const GOAL_POST_WIDTH = 6;
const MOVE_SPEED = 5;
const JUMP_FORCE = 10;
const KICK_RANGE = 50;

// ===================================================================================
// Export Constants for AI
// ===================================================================================
window.CANVAS_WIDTH = CANVAS_WIDTH;
window.CANVAS_HEIGHT = CANVAS_HEIGHT;
window.PLAYER_SIZE = PLAYER_SIZE;
window.BALL_RADIUS = BALL_RADIUS;
window.GOAL_HEIGHT = GOAL_HEIGHT;
window.GOAL_WIDTH = GOAL_WIDTH;
window.aiKicking = aiKicking;

// ===================================================================================
// Setup Function
// ===================================================================================
function setup() {
    console.log("Starting game setup...");
    
    // Check if Three.js is loaded
    if (typeof THREE === 'undefined') {
        console.error("Three.js is not loaded!");
        return;
    }
    
    console.log("Three.js version:", THREE.REVISION);
    
    // Check if canvas exists
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    
    console.log("Canvas found:", canvas);
    
    try {
        // Initialize Three.js
        initThreeJS();
        
        // Initialize UI
        initUI();
        
        // Setup controls
        setupControls();
        
        // Initialize audio
        if (typeof window.initializeAudio === "function") {
            window.initializeAudio();
        }
        
        // Start game loop
        animate();
        console.log("Game setup completed!");
    } catch (error) {
        console.error("Setup error:", error);
        console.error("Error stack:", error.stack);
    }
}

function initThreeJS() {
    console.log("Initializing Three.js...");
    
    try {
        // Check WebGL support
        if (!window.WebGLRenderingContext) {
            console.error("WebGL not supported!");
            return;
        }
        
        // Create scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87CEEB); // Sky blue background
        console.log("Scene created");
        
        // Create camera
        camera = new THREE.PerspectiveCamera(60, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 2000);
        camera.position.set(400, 500, 800);
        camera.lookAt(400, 0, 300);
        console.log("Camera created");
        
        // Create renderer with fallback
        try {
            renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
            console.log("WebGL renderer created");
        } catch (webglError) {
            console.warn("WebGL failed, trying Canvas renderer:", webglError);
            renderer = new THREE.CanvasRenderer({ canvas: document.getElementById('gameCanvas') });
            console.log("Canvas renderer created");
        }
        
        renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        console.log("Renderer configured");
        
        // Create lights
        ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        scene.add(ambientLight);
        console.log("Ambient light added");
        
        directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(200, 400, 200);
        directionalLight.castShadow = true;
        scene.add(directionalLight);
        console.log("Directional light added");
        
        console.log("Three.js initialized successfully");
        
        // Create field
        createField3D();
        
        // Create players
        createPlayers3D();
        
        // Create ball
        createBall3D();
        
        console.log("All 3D objects created");
        
    } catch (error) {
        console.error("Error in initThreeJS:", error);
        throw error;
    }
}

function createField3D() {
    console.log("Creating field...");
    
    try {
        // Create field ground
        const fieldGeometry = new THREE.PlaneGeometry(800, 600);
        const fieldMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 }); // Green
        field = new THREE.Mesh(fieldGeometry, fieldMaterial);
        field.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        field.receiveShadow = true;
        scene.add(field);
        
        // Create field lines
        createFieldLines();
        
        // Create goal posts
        createGoalPosts();
        
        console.log("Field created successfully");
    } catch (error) {
        console.error("Error creating field:", error);
        throw error;
    }
}

function createFieldLines() {
    const lineMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    
    // Center line
    const centerLineGeometry = new THREE.BoxGeometry(2, 600, 2);
    const centerLine = new THREE.Mesh(centerLineGeometry, lineMaterial);
    centerLine.position.set(400, 1, 300);
    scene.add(centerLine);
    
    // Center circle (using multiple small boxes instead of RingGeometry)
    for (let i = 0; i < 32; i++) {
        const angle = (i / 32) * Math.PI * 2;
        const x = 400 + Math.cos(angle) * 50;
        const z = 300 + Math.sin(angle) * 50;
        
        const circleSegmentGeometry = new THREE.BoxGeometry(4, 2, 4);
        const circleSegment = new THREE.Mesh(circleSegmentGeometry, lineMaterial);
        circleSegment.position.set(x, 1, z);
        scene.add(circleSegment);
    }
}

function createGoalPosts() {
    const goalPostGeometry = new THREE.BoxGeometry(GOAL_POST_WIDTH, GOAL_HEIGHT, GOAL_POST_WIDTH);
    const goalPostMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    
    // Left goal posts
    const leftGoalLeft = new THREE.Mesh(goalPostGeometry, goalPostMaterial);
    leftGoalLeft.position.set(GOAL_POST_WIDTH/2, GOAL_HEIGHT/2, 300 - GOAL_WIDTH/2);
    leftGoalLeft.castShadow = true;
    scene.add(leftGoalLeft);
    
    const leftGoalRight = new THREE.Mesh(goalPostGeometry, goalPostMaterial);
    leftGoalRight.position.set(GOAL_POST_WIDTH/2, GOAL_HEIGHT/2, 300 + GOAL_WIDTH/2);
    leftGoalRight.castShadow = true;
    scene.add(leftGoalRight);
    
    // Left goal crossbar
    const leftCrossbarGeometry = new THREE.BoxGeometry(GOAL_WIDTH + GOAL_POST_WIDTH, GOAL_POST_WIDTH, GOAL_POST_WIDTH);
    const leftCrossbar = new THREE.Mesh(leftCrossbarGeometry, goalPostMaterial);
    leftCrossbar.position.set(GOAL_POST_WIDTH/2, GOAL_HEIGHT, 300);
    leftCrossbar.castShadow = true;
    scene.add(leftCrossbar);
    
    // Right goal posts
    const rightGoalLeft = new THREE.Mesh(goalPostGeometry, goalPostMaterial);
    rightGoalLeft.position.set(CANVAS_WIDTH - GOAL_POST_WIDTH/2, GOAL_HEIGHT/2, 300 - GOAL_WIDTH/2);
    rightGoalLeft.castShadow = true;
    scene.add(rightGoalLeft);
    
    const rightGoalRight = new THREE.Mesh(goalPostGeometry, goalPostMaterial);
    rightGoalRight.position.set(CANVAS_WIDTH - GOAL_POST_WIDTH/2, GOAL_HEIGHT/2, 300 + GOAL_WIDTH/2);
    rightGoalRight.castShadow = true;
    scene.add(rightGoalRight);
    
    // Right goal crossbar
    const rightCrossbarGeometry = new THREE.BoxGeometry(GOAL_WIDTH + GOAL_POST_WIDTH, GOAL_POST_WIDTH, GOAL_POST_WIDTH);
    const rightCrossbar = new THREE.Mesh(rightCrossbarGeometry, goalPostMaterial);
    rightCrossbar.position.set(CANVAS_WIDTH - GOAL_POST_WIDTH/2, GOAL_HEIGHT, 300);
    rightCrossbar.castShadow = true;
    scene.add(rightCrossbar);
}

function createPlayers3D() {
    console.log("Creating players...");
    
    try {
        // Player 1 (Red)
        const playerGeometry = new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE);
        const player1Material = new THREE.MeshLambertMaterial({ color: 0xD9534F });
        player1Mesh = new THREE.Mesh(playerGeometry, player1Material);
        player1Mesh.position.set(200, PLAYER_SIZE/2, 450);
        player1Mesh.castShadow = true;
        scene.add(player1Mesh);
        
        // Player 2 (Blue) - AI
        const player2Material = new THREE.MeshLambertMaterial({ color: 0x428BCA });
        player2Mesh = new THREE.Mesh(playerGeometry, player2Material);
        player2Mesh.position.set(600, PLAYER_SIZE/2, 450);
        player2Mesh.castShadow = true;
        scene.add(player2Mesh);
        
        // Store player data
        players = [
            { mesh: player1Mesh, team: 1, isGrounded: true, color: '#D9534F' },
            { mesh: player2Mesh, team: 2, isGrounded: true, color: '#428BCA' }
        ];
        
        console.log("Players created successfully");
    } catch (error) {
        console.error("Error creating players:", error);
        throw error;
    }
}

function createBall3D() {
    console.log("Creating ball...");
    
    try {
        const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
        const ballMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
        ballMesh.position.set(CANVAS_WIDTH / 2, BALL_RADIUS, 100);
        ballMesh.castShadow = true;
        scene.add(ballMesh);
        
        // Store ball data
        ball = { 
            mesh: ballMesh, 
            position: ballMesh.position,
            velocity: { x: 0, y: 0, z: 0 }
        };
        
        console.log("Ball created successfully");
    } catch (error) {
        console.error("Error creating ball:", error);
        throw error;
    }
}

function initUI() {
    console.log("Initializing UI...");
    
    // Update UI element references
    team1ScoreDisplay = document.getElementById('team1Score');
    team2ScoreDisplay = document.getElementById('team2Score');
    timerDisplay = document.getElementById('timer');
    gameMessageDisplay = document.getElementById('gameMessage');
    
    // Initialize scores
    team1ScoreDisplay.textContent = `Team 1: ${team1Score}`;
    team2ScoreDisplay.textContent = `Team 2: ${team2Score}`;
    timerDisplay.textContent = `Time: ${gameTimeRemaining}`;
    
    console.log("UI initialized");
}

// ===================================================================================
// Game Loop
// ===================================================================================
function animate() {
    try {
        requestAnimationFrame(animate);
        
        // Update game logic
        updateGame();
        
        // Render the scene
        renderer.render(scene, camera);
    } catch (error) {
        console.error("Error in animate loop:", error);
    }
}

function updateGame() {
    // Update player positions
    updatePlayerPositions();
    
    // Update ball physics
    updateBallPhysics();
    
    // Check collisions
    checkCollisions();
    
            // Update AI
        if (typeof window.updateAI === "function") {
            window.updateAI();
        }
        
        // Initialize AI if not done yet
        if (typeof window.initializeAI === "function" && !window.aiInitialized) {
            window.initializeAI(players[1], ball);
            window.aiInitialized = true;
        }
}

function updatePlayerPositions() {
    // Player 1 movement
    if (keysPressed['a']) {
        player1Mesh.position.x -= MOVE_SPEED;
    }
    if (keysPressed['d']) {
        player1Mesh.position.x += MOVE_SPEED;
    }
    if (keysPressed['q']) {
        player1Mesh.position.z -= MOVE_SPEED;
    }
    if (keysPressed['e']) {
        player1Mesh.position.z += MOVE_SPEED;
    }
    if (keysPressed['w'] && players[0].isGrounded) {
        player1Mesh.position.y += JUMP_FORCE;
        players[0].isGrounded = false;
        if (typeof window.playJumpSound === 'function') {
            window.playJumpSound();
        }
        setTimeout(() => {
            player1Mesh.position.y = PLAYER_SIZE/2;
            players[0].isGrounded = true;
        }, 500);
    }
    
    // Keep players within bounds
    players.forEach(player => {
        player.mesh.position.x = Math.max(PLAYER_SIZE/2, Math.min(CANVAS_WIDTH - PLAYER_SIZE/2, player.mesh.position.x));
        player.mesh.position.z = Math.max(PLAYER_SIZE/2, Math.min(CANVAS_HEIGHT - PLAYER_SIZE/2, player.mesh.position.z));
    });
}

function updateBallPhysics() {
    // Apply velocity
    ball.mesh.position.x += ball.velocity.x;
    ball.mesh.position.y += ball.velocity.y;
    ball.mesh.position.z += ball.velocity.z;
    
    // Apply gravity
    ball.velocity.y -= 0.8;
    
    // Ground collision
    if (ball.mesh.position.y < BALL_RADIUS) {
        ball.mesh.position.y = BALL_RADIUS;
        ball.velocity.y = 0;
        
        // Apply friction
        ball.velocity.x *= 0.95;
        ball.velocity.z *= 0.95;
    }
    
    // Wall collisions
    if (ball.mesh.position.x < BALL_RADIUS) {
        ball.mesh.position.x = BALL_RADIUS;
        ball.velocity.x = Math.abs(ball.velocity.x) * 0.8;
    }
    if (ball.mesh.position.x > CANVAS_WIDTH - BALL_RADIUS) {
        ball.mesh.position.x = CANVAS_WIDTH - BALL_RADIUS;
        ball.velocity.x = -Math.abs(ball.velocity.x) * 0.8;
    }
    if (ball.mesh.position.z < BALL_RADIUS) {
        ball.mesh.position.z = BALL_RADIUS;
        ball.velocity.z = Math.abs(ball.velocity.z) * 0.8;
    }
    if (ball.mesh.position.z > CANVAS_HEIGHT - BALL_RADIUS) {
        ball.mesh.position.z = CANVAS_HEIGHT - BALL_RADIUS;
        ball.velocity.z = -Math.abs(ball.velocity.z) * 0.8;
    }
    
    // Update ball data
    ball.position = ball.mesh.position;
}

function checkCollisions() {
    if (!ball || !players) return;
    
    // Check ball-player collisions
    players.forEach((player, index) => {
        const distance = Math.sqrt(
            Math.pow(ball.mesh.position.x - player.mesh.position.x, 2) +
            Math.pow(ball.mesh.position.z - player.mesh.position.z, 2) +
            Math.pow(ball.mesh.position.y - player.mesh.position.y, 2)
        );
        
        if (distance < BALL_RADIUS + PLAYER_SIZE / 2) {
            handleBallPlayerCollision(player, index);
        }
    });
    
    // Check goal scoring
    checkGoalScoring();
}

function handleBallPlayerCollision(player, playerIndex) {
    // Calculate collision response
    const dx = ball.mesh.position.x - player.mesh.position.x;
    const dz = ball.mesh.position.z - player.mesh.position.z;
    const dy = ball.mesh.position.y - player.mesh.position.y;
    
    const distance = Math.sqrt(dx * dx + dz * dz + dy * dy);
    
    if (distance > 0) {
        // Normalize direction
        const nx = dx / distance;
        const nz = dz / distance;
        const ny = dy / distance;
        
        // Push ball away from player
        const pushDistance = BALL_RADIUS + PLAYER_SIZE / 2 - distance;
        ball.mesh.position.x += nx * pushDistance;
        ball.mesh.position.z += nz * pushDistance;
        ball.mesh.position.y += ny * pushDistance;
        
        // Apply kick force if player is kicking
        if ((playerIndex === 0 && isKicking) || (playerIndex === 1 && window.aiKicking)) {
            applyKickForce(player, nx, nz, ny);
            if (typeof window.playKickSound === 'function') {
                window.playKickSound();
            }
        }
    }
}

function applyKickForce(player, nx, nz, ny) {
    const kickForce = 20;
    const kickDirectionX = nx * kickForce;
    const kickDirectionZ = nz * kickForce;
    const kickDirectionY = Math.abs(ny) * kickForce * 0.5;
    
    ball.velocity.x = kickDirectionX;
    ball.velocity.z = kickDirectionZ;
    ball.velocity.y = kickDirectionY;
    
    // Add some randomness
    ball.velocity.x += (Math.random() - 0.5) * 5;
    ball.velocity.z += (Math.random() - 0.5) * 5;
}

function checkGoalScoring() {
    const ballX = ball.mesh.position.x;
    const ballY = ball.mesh.position.y;
    const ballZ = ball.mesh.position.z;
    
    // Left goal (Team 1 scores)
    if (ballX < GOAL_POST_WIDTH && ballY < GOAL_HEIGHT && 
        ballZ > 300 - GOAL_WIDTH/2 && ballZ < 300 + GOAL_WIDTH/2) {
        scoreGoal(1);
    }
    
    // Right goal (Team 2 scores)
    if (ballX > CANVAS_WIDTH - GOAL_POST_WIDTH && ballY < GOAL_HEIGHT && 
        ballZ > 300 - GOAL_WIDTH/2 && ballZ < 300 + GOAL_WIDTH/2) {
        scoreGoal(2);
    }
}

function scoreGoal(team) {
    if (team === 1) {
        team1Score++;
        team1ScoreDisplay.textContent = `Team 1: ${team1Score}`;
    } else {
        team2Score++;
        team2ScoreDisplay.textContent = `Team 2: ${team2Score}`;
    }
    
    // Play goal sound
    if (typeof window.playGoalSound === 'function') {
        window.playGoalSound();
    }
    
    // Show goal message
    const teamName = team === 1 ? "قرمز" : "آبی";
    gameMessageDisplay.textContent = `گل! تیم ${teamName}`;
    gameMessageDisplay.classList.add('has-text');
    
    // Reset ball position
    resetBall();
    
    // Clear message after 2 seconds
    setTimeout(() => {
        gameMessageDisplay.textContent = '';
        gameMessageDisplay.classList.remove('has-text');
    }, 2000);
}

function resetBall() {
    ball.mesh.position.set(CANVAS_WIDTH / 2, BALL_RADIUS, 100);
    ball.velocity.x = 0;
    ball.velocity.y = 0;
    ball.velocity.z = 0;
}

// ===================================================================================
// Control Functions
// ===================================================================================
function setupControls() {
    console.log("Setting up controls...");
    
    document.addEventListener('keydown', (event) => {
        keysPressed[event.key.toLowerCase()] = true;
        if (event.key.toLowerCase() === 's') {
            isKicking = true;
        }
    });
    
    document.addEventListener('keyup', (event) => {
        keysPressed[event.key.toLowerCase()] = false;
        if (event.key.toLowerCase() === 's') {
            isKicking = false;
        }
    });
    
    // Prevent default behavior for game keys
    document.addEventListener('keydown', (event) => {
        if (['w', 'a', 's', 'd', 'q', 'e'].includes(event.key.toLowerCase())) {
            event.preventDefault();
        }
    });
    
    console.log("Controls set up");
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', setup);