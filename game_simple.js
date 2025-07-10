// Simple Three.js Soccer Game
console.log("Loading simple game...");

// Global variables
let scene, camera, renderer;
let cube1, cube2, ball;

// Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// Setup function
function setup() {
    console.log("Starting simple game setup...");
    
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
        // Create scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87CEEB);
        console.log("Scene created");
        
        // Create camera
        camera = new THREE.PerspectiveCamera(60, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 2000);
        camera.position.set(400, 300, 500);
        camera.lookAt(400, 0, 300);
        console.log("Camera created");
        
        // Create renderer
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
        console.log("Renderer created");
        
        // Create lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(200, 400, 200);
        scene.add(directionalLight);
        console.log("Lights added");
        
        // Create field (simple green plane)
        const fieldGeometry = new THREE.PlaneGeometry(800, 600);
        const fieldMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const field = new THREE.Mesh(fieldGeometry, fieldMaterial);
        field.rotation.x = -Math.PI / 2;
        scene.add(field);
        console.log("Field created");
        
        // Create player 1 (red cube)
        const playerGeometry = new THREE.BoxGeometry(40, 40, 40);
        const player1Material = new THREE.MeshLambertMaterial({ color: 0xD9534F });
        cube1 = new THREE.Mesh(playerGeometry, player1Material);
        cube1.position.set(200, 20, 450);
        scene.add(cube1);
        console.log("Player 1 created");
        
        // Create player 2 (blue cube)
        const player2Material = new THREE.MeshLambertMaterial({ color: 0x428BCA });
        cube2 = new THREE.Mesh(playerGeometry, player2Material);
        cube2.position.set(600, 20, 450);
        scene.add(cube2);
        console.log("Player 2 created");
        
        // Create ball (white sphere)
        const ballGeometry = new THREE.SphereGeometry(15, 16, 16);
        const ballMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        ball = new THREE.Mesh(ballGeometry, ballMaterial);
        ball.position.set(400, 15, 100);
        scene.add(ball);
        console.log("Ball created");
        
        // Start animation
        animate();
        console.log("Game setup completed!");
        
    } catch (error) {
        console.error("Setup error:", error);
        console.error("Error stack:", error.stack);
    }
}

// Animation loop
function animate() {
    try {
        requestAnimationFrame(animate);
        
        // Rotate cubes for testing
        cube1.rotation.y += 0.01;
        cube2.rotation.y += 0.01;
        ball.rotation.y += 0.02;
        
        // Render
        renderer.render(scene, camera);
    } catch (error) {
        console.error("Animation error:", error);
    }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', setup);