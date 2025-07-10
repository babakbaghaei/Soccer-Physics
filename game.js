/// --- Matter.js Aliases ---
const Engine = Matter.Engine;
const Render = Matter.Render;
const Runner = Matter.Runner;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Events = Matter.Events;
const Composite = Matter.Composite;
const Composites = Matter.Composites;
const Constraint = Matter.Constraint;

import audioManager from './audioManager.js';

// ===================================================================================
// Global Variables
// ===================================================================================
let scene, camera, renderer;
let field, player1Mesh, player2Mesh, ballMesh;
let directionalLight, ambientLight;

// ===================================================================================
// Constants
// ===================================================================================
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 40;
const BALL_RADIUS = 15;

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
        
        console.log("Field created successfully");
    } catch (error) {
        console.error("Error creating field:", error);
        throw error;
    }
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
        
        console.log("Ball created successfully");
    } catch (error) {
        console.error("Error creating ball:", error);
        throw error;
    }
}

// ===================================================================================
// Game Loop
// ===================================================================================
function animate() {
    try {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    } catch (error) {
        console.error("Error in animate loop:", error);
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', setup);