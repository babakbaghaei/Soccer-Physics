// ===================================================================================
// Simple 3D Soccer Game - Fixed Version
// ===================================================================================

// Global Variables
let scene, camera, renderer;
let player1Mesh, player2Mesh, ballMesh;
let field;
let players = [];
let ball;
let keysPressed = {};

// Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 40;
const BALL_RADIUS = 15;
const MOVE_SPEED = 5;
const JUMP_FORCE = 10;

// ===================================================================================
// Setup Function
// ===================================================================================
function setup() {
    console.log("=== GAME SETUP START ===");
    
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
        
        // Start game loop
        animate();
        console.log("=== GAME SETUP COMPLETED ===");
    } catch (error) {
        console.error("Setup error:", error);
        console.error("Error stack:", error.stack);
    }
}

function initThreeJS() {
    console.log("Initializing Three.js...");
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    console.log("Scene created");
    
    // Create camera
    camera = new THREE.PerspectiveCamera(60, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 2000);
    camera.position.set(400, 300, 500);
    camera.lookAt(400, 0, 300);
    console.log("Camera created");
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
    renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
    console.log("Renderer created");
    
    // Create lights
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(200, 400, 200);
    scene.add(directionalLight);
    console.log("Lights added");
    
    // Create field
    createField();
    
    // Create players
    createPlayers();
    
    // Create ball
    createBall();
    
    console.log("All 3D objects created");
}

function createField() {
    console.log("Creating field...");
    
    // Create field ground
    const fieldGeometry = new THREE.PlaneGeometry(800, 600);
    const fieldMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 }); // Green
    field = new THREE.Mesh(fieldGeometry, fieldMaterial);
    field.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    scene.add(field);
    
    // Create center line
    const lineGeometry = new THREE.BoxGeometry(2, 600, 2);
    const lineMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    const centerLine = new THREE.Mesh(lineGeometry, lineMaterial);
    centerLine.position.set(400, 1, 300);
    scene.add(centerLine);
    
    console.log("Field created");
}

function createPlayers() {
    console.log("Creating players...");
    
    // Player 1 (Red)
    const playerGeometry = new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE);
    const player1Material = new THREE.MeshLambertMaterial({ color: 0xD9534F });
    player1Mesh = new THREE.Mesh(playerGeometry, player1Material);
    player1Mesh.position.set(200, PLAYER_SIZE/2, 450);
    scene.add(player1Mesh);
    
    // Player 2 (Blue) - AI
    const player2Material = new THREE.MeshLambertMaterial({ color: 0x428BCA });
    player2Mesh = new THREE.Mesh(playerGeometry, player2Material);
    player2Mesh.position.set(600, PLAYER_SIZE/2, 450);
    scene.add(player2Mesh);
    
    // Store player data
    players = [
        { mesh: player1Mesh, team: 1, isGrounded: true },
        { mesh: player2Mesh, team: 2, isGrounded: true }
    ];
    
    console.log("Players created");
}

function createBall() {
    console.log("Creating ball...");
    
    const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
    const ballMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
    ballMesh.position.set(CANVAS_WIDTH / 2, BALL_RADIUS, 100);
    scene.add(ballMesh);
    
    // Store ball data
    ball = { 
        mesh: ballMesh, 
        velocity: { x: 0, y: 0, z: 0 }
    };
    
    console.log("Ball created");
}

function initUI() {
    console.log("Initializing UI...");
    
    // Update UI element references
    const team1ScoreDisplay = document.getElementById('team1Score');
    const team2ScoreDisplay = document.getElementById('team2Score');
    const timerDisplay = document.getElementById('timer');
    
    if (team1ScoreDisplay) team1ScoreDisplay.textContent = "Team 1: 0";
    if (team2ScoreDisplay) team2ScoreDisplay.textContent = "Team 2: 0";
    if (timerDisplay) timerDisplay.textContent = "Time: 120";
    
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
    
    // Simple AI movement
    updateAI();
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
}

function updateAI() {
    // Simple AI: move towards ball
    const dx = ball.mesh.position.x - player2Mesh.position.x;
    const dz = ball.mesh.position.z - player2Mesh.position.z;
    
    if (Math.abs(dx) > 5) {
        player2Mesh.position.x += dx > 0 ? MOVE_SPEED : -MOVE_SPEED;
    }
    if (Math.abs(dz) > 5) {
        player2Mesh.position.z += dz > 0 ? MOVE_SPEED : -MOVE_SPEED;
    }
}

// ===================================================================================
// Control Functions
// ===================================================================================
function setupControls() {
    console.log("Setting up controls...");
    
    document.addEventListener('keydown', (event) => {
        keysPressed[event.key.toLowerCase()] = true;
    });
    
    document.addEventListener('keyup', (event) => {
        keysPressed[event.key.toLowerCase()] = false;
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