// ===================================================================================
// AI Player Logic
// ===================================================================================

// AI State Management
let aiState = 'IDLE';
let aiTargetPosition = { x: 0, y: 0, z: 0 };
let aiLastDecisionTime = 0;
let aiDecisionInterval = 100; // ms between AI decisions

// AI Constants (synced with game.js)
const AI_MOVE_SPEED = 5; // pixels per frame
const AI_JUMP_FORCE = 10; // pixels per jump
const AI_KICK_RANGE = 50; // pixels
const AI_GOAL_PROTECTION_RANGE = 100; // pixels from goal line

// Get constants from game.js with fallbacks
function getGameConstant(name, fallback) {
    if (typeof window[name] !== 'undefined') {
        return window[name];
    }
    return fallback;
}

const PLAYER_SIZE = getGameConstant('PLAYER_SIZE', 40);
const MOVE_FORCE = getGameConstant('MOVE_FORCE', 0.015);
const JUMP_FORCE = getGameConstant('JUMP_FORCE', 0.18);
const AIR_MOVE_FORCE_MULTIPLIER = getGameConstant('AIR_MOVE_FORCE_MULTIPLIER', 0.1);

// ===================================================================================
// AI Initialization
// ===================================================================================
function initializeAI(aiPlayer, ball, engine) {
    console.log("Initializing AI with Three.js support...");
    
    // Store references
    window.aiPlayer = aiPlayer;
    window.ball = ball;
    window.engine = engine;
    
    // Initialize AI state
    aiState = 'IDLE';
    aiTargetPosition = { x: 0, y: 0, z: 0 };
    aiLastDecisionTime = 0;
    
    console.log("AI initialized successfully");
}

// ===================================================================================
// AI Update Function
// ===================================================================================
function updateAI() {
    if (!window.aiPlayer || !window.ball) {
        console.warn("AI update called but AI not properly initialized");
        return;
    }
    
    const currentTime = Date.now();
    if (currentTime - aiLastDecisionTime < aiDecisionInterval) {
        return; // Not time for new decision yet
    }
    
    aiLastDecisionTime = currentTime;
    
    // Get current positions from Three.js meshes
    const aiPosition = window.aiPlayer.mesh.position;
    const ballPosition = window.ball.mesh.position;
    
    // Determine AI behavior based on ball position relative to AI's goal
    const aiGoalX = 800 - 30; // Right goal (AI defends right side)
    const ballDistanceToGoal = Math.abs(ballPosition.x - aiGoalX);
    const aiDistanceToBall = Math.sqrt(
        Math.pow(aiPosition.x - ballPosition.x, 2) + 
        Math.pow(aiPosition.z - ballPosition.z, 2)
    );
    
    // Check if ball is behind AI (closer to AI's goal)
    const ballBehindAI = ballPosition.x > aiPosition.x;
    
    // AI State Machine
    switch (aiState) {
        case 'IDLE':
            handleIdleState(aiPosition, ballPosition, ballBehindAI, ballDistanceToGoal);
            break;
        case 'CHASING':
            handleChasingState(aiPosition, ballPosition, aiDistanceToBall);
            break;
        case 'GOALKEEPER':
            handleGoalkeeperState(aiPosition, ballPosition, ballDistanceToGoal);
            break;
        case 'KICKING':
            handleKickingState(aiPosition, ballPosition, aiDistanceToBall);
            break;
    }
}

// ===================================================================================
// AI State Handlers
// ===================================================================================
function handleIdleState(aiPosition, ballPosition, ballBehindAI, ballDistanceToGoal) {
    // If ball is behind AI and close to goal, become goalkeeper
    if (ballBehindAI && ballDistanceToGoal < AI_GOAL_PROTECTION_RANGE) {
        aiState = 'GOALKEEPER';
        console.log("AI: Switching to GOALKEEPER mode");
        return;
    }
    
    // If ball is close, chase it
    const distanceToBall = Math.sqrt(
        Math.pow(aiPosition.x - ballPosition.x, 2) + 
        Math.pow(aiPosition.z - ballPosition.z, 2)
    );
    
    if (distanceToBall < 200) {
        aiState = 'CHASING';
        console.log("AI: Switching to CHASING mode");
        return;
    }
    
    // Default: move towards ball
    moveTowardsPosition(aiPosition, ballPosition);
}

function handleChasingState(aiPosition, ballPosition, distanceToBall) {
    if (distanceToBall < AI_KICK_RANGE) {
        aiState = 'KICKING';
        console.log("AI: Switching to KICKING mode");
        return;
    }
    
    // Chase the ball
    moveTowardsPosition(aiPosition, ballPosition);
    
    // Jump if needed to reach ball
    if (ballPosition.y > aiPosition.y + 20) {
        jump();
    }
}

function handleGoalkeeperState(aiPosition, ballPosition, ballDistanceToGoal) {
    // If ball is no longer a threat, return to idle
    if (ballDistanceToGoal > AI_GOAL_PROTECTION_RANGE * 1.5) {
        aiState = 'IDLE';
        console.log("AI: Returning to IDLE from GOALKEEPER");
        return;
    }
    
    // Goalkeeper behavior: protect the goal
    const goalX = 800 - 30; // Right goal
    const goalZ = 300; // Center of goal
    
    // Move to intercept ball
    const interceptX = Math.min(Math.max(ballPosition.x, goalX - 50), goalX + 50);
    const interceptZ = goalZ;
    
    moveTowardsPosition(aiPosition, { x: interceptX, y: 0, z: interceptZ });
    
    // Jump if ball is high
    if (ballPosition.y > 50) {
        jump();
    }
}

function handleKickingState(aiPosition, ballPosition, distanceToBall) {
    if (distanceToBall > AI_KICK_RANGE * 1.5) {
        aiState = 'CHASING';
        console.log("AI: Returning to CHASING from KICKING");
        window.aiKicking = false;
        return;
    }
    
    // Set AI kicking flag for collision detection
    window.aiKicking = true;
    
    // Kick the ball towards opponent's goal
    kickBall(ballPosition);
    
    // After kicking, return to chasing
    aiState = 'CHASING';
    window.aiKicking = false;
}

// ===================================================================================
// AI Movement Functions
// ===================================================================================
function moveTowardsPosition(currentPos, targetPos) {
    const dx = targetPos.x - currentPos.x;
    const dz = targetPos.z - currentPos.z;
    
    // Move horizontally
    if (Math.abs(dx) > 5) {
        if (dx > 0) {
            window.aiPlayer.mesh.position.x += AI_MOVE_SPEED;
        } else {
            window.aiPlayer.mesh.position.x -= AI_MOVE_SPEED;
        }
    }
    
    // Move vertically (z-axis in our 3D setup)
    if (Math.abs(dz) > 5) {
        if (dz > 0) {
            window.aiPlayer.mesh.position.z += AI_MOVE_SPEED;
        } else {
            window.aiPlayer.mesh.position.z -= AI_MOVE_SPEED;
        }
    }
}

function jump() {
    if (window.aiPlayer.isGrounded) {
        window.aiPlayer.mesh.position.y += AI_JUMP_FORCE;
        window.aiPlayer.isGrounded = false;
        
        // Play jump sound
        if (typeof window.playJumpSound === 'function') {
            window.playJumpSound();
        }
        
        // Reset grounded state after jump
        setTimeout(() => {
            window.aiPlayer.mesh.position.y = PLAYER_SIZE / 2;
            window.aiPlayer.isGrounded = true;
        }, 500);
    }
}

function kickBall(ballPosition) {
    // Calculate kick direction towards opponent's goal (left side)
    const opponentGoalX = 30; // Left goal
    const kickDirectionX = opponentGoalX - ballPosition.x;
    const kickDirectionZ = 300 - ballPosition.z; // Towards center
    
    // Apply kick force to ball
    const kickForce = 15;
    window.ball.velocity.x = (kickDirectionX / Math.sqrt(kickDirectionX * kickDirectionX + kickDirectionZ * kickDirectionZ)) * kickForce;
    window.ball.velocity.z = (kickDirectionZ / Math.sqrt(kickDirectionX * kickDirectionX + kickDirectionZ * kickDirectionZ)) * kickForce;
    window.ball.velocity.y = 5; // Add some upward force
    
    console.log("AI: Kicked ball with force:", window.ball.velocity);
}

// ===================================================================================
// Export Functions
// ===================================================================================
window.initializeAI = initializeAI;
window.updateAI = updateAI;
