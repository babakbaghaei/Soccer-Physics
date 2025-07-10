// AI Player Logic for Team 2 (Blue)

// --- AI Constants ---
// AI_PLAYER_INDEX is defined in game.js and will be globally available.

// --- Finite State Machine (FSM) States ---
const AI_STATE = {
    IDLE: 'IDLE',       // Ball is in opponent's half
    DEFEND: 'DEFEND',   // Ball is in AI's half
    ATTACK: 'ATTACK',   // Ball is near AI and in a good position to shoot
    RECOVER: 'RECOVER', // After conceding a goal or defensive disarray
    GOALKEEPER: 'GOALKEEPER' // Ball is between AI and its own goal - special goalkeeper behavior
};

// --- Global constants that will be available from game.js ---
let CANVAS_WIDTH = 800;
let CANVAS_HEIGHT = 600;
let PLAYER_WIDTH = 40;
let PLAYER_HEIGHT = 40;
let JUMP_FORCE = 0.18;
let MOVE_FORCE = 0.015;
let AIR_MOVE_FORCE_MULTIPLIER = 0.1;
let BALL_RADIUS = 15;
let GROUND_Y = 580;
let GOAL_HEIGHT = 120;
let GOAL_WIDTH = 30;
let isGameOver = false;

// --- AI Variables ---
let currentAiState = AI_STATE.IDLE;
let lastJumpTime = 0;
const JUMP_COOLDOWN = 500; // Milliseconds (0.5 seconds)

// --- Goalkeeper Variables ---
let goalkeeperPhase = 0; // 0: approaching, 1: jumping, 2: defending
let goalkeeperStartTime = 0;

// --- AI Player Object (to be initialized) ---
let aiPlayer = null; // Reference to the AI player's body and data from game.js
let gameBall = null; // Reference to the ball's body from game.js
let gameEngine = null; // Reference to the Matter.js engine

// --- Adaptive Learning Variables ---
let opponentAttackZones = { left: 0, center: 0, right: 0 }; // Based on P1's position in their half
let opponentJumpFrequency = 0;
const ADAPTATION_MEMORY_SIZE = 10; // Remember last N opponent attack positions/actions
let recentOpponentActions = [];

// --- Constants for Adaptive Learning ---
// Assuming CANVAS_WIDTH is globally available from game.js
const OPPONENT_HALF_X_LINE = CANVAS_WIDTH / 2;
const PLAYER1_ATTACK_ZONE_THIRD = CANVAS_WIDTH / 4; // Divides P1's half (0 to CANVAS_WIDTH/2) into rough thirds for zone tracking

// ===================================================================================
// AI Initialization & Adaptation API
// ===================================================================================
function initializeAI(player, ball, engine) {
    aiPlayer = player;
    gameBall = ball;
    gameEngine = engine;
    console.log("AI Initialized for Player 2 (Blue). Current State: ", currentAiState);
    recentOpponentActions = [];
    opponentAttackZones = { left: 0, center: 0, right: 0 };
    opponentJumpFrequency = 0;
    goalkeeperPhase = 0;
    goalkeeperStartTime = 0;
}

/**
 * Records an action from the opponent (Player 1) to learn patterns.
 * Call this from game.js when P1 makes a significant offensive move.
 * @param {number} p1PosX - Player 1's X position at the time of action.
 * @param {boolean} p1Jumped - Whether Player 1 was jumping/in air during the action.
 */
function recordOpponentOffensiveAction(p1PosX, p1Jumped) {
    // Action must originate from P1's half (i.e. p1PosX < OPPONENT_HALF_X_LINE)
    if (p1PosX >= OPPONENT_HALF_X_LINE) return;

    let zone = 'center';
    // P1's perspective: 'left' is x < PLAYER1_ATTACK_ZONE_THIRD
    // 'right' is x > OPPONENT_HALF_X_LINE - PLAYER1_ATTACK_ZONE_THIRD
    if (p1PosX < PLAYER1_ATTACK_ZONE_THIRD) {
        zone = 'left'; // Player 1 attacked from their left side
    } else if (p1PosX > OPPONENT_HALF_X_LINE - PLAYER1_ATTACK_ZONE_THIRD) {
        zone = 'right'; // Player 1 attacked from their right side
    } // Else, it's center

    recentOpponentActions.push({ zone: zone, jumped: p1Jumped });
    if (recentOpponentActions.length > ADAPTATION_MEMORY_SIZE) {
        recentOpponentActions.shift(); // Keep memory size limited
    }
    updateAdaptationParameters();
}

function updateAdaptationParameters() {
    opponentAttackZones = { left: 0, center: 0, right: 0 };
    let totalJumps = 0;
    recentOpponentActions.forEach(action => {
        opponentAttackZones[action.zone]++;
        if (action.jumped) totalJumps++;
    });
    opponentJumpFrequency = recentOpponentActions.length > 0 ? totalJumps / recentOpponentActions.length : 0;
    // console.log("AI Adaptation Updated: Zones:", opponentAttackZones, "Opponent Jump Freq:", opponentJumpFrequency.toFixed(2));
}


// ===================================================================================
// AI Update Function (Called every game tick)
// ===================================================================================
function updateAI() {
    if (!aiPlayer || !gameBall || !gameBall.velocity || isGameOver) {
        window.aiKicking = false;
        return;
    }
    const ballPosition = gameBall.position;
    const playerPosition = aiPlayer.body.position;
    const playerHalfX = CANVAS_WIDTH / 2;
    const ballVelocity = gameBall.velocity;
    determineAiState(ballPosition, playerPosition, playerHalfX, ballVelocity);
    // Only allow aiKicking if ball is in front and moving left (toward opponent's goal)
    if (currentAiState === AI_STATE.ATTACK && aiPlayer.isGrounded) {
        const footX = playerPosition.x + (playerPosition.x < ballPosition.x ? PLAYER_WIDTH/2 : -PLAYER_WIDTH/2);
        const dx = ballPosition.x - footX;
        const dist = Math.sqrt(dx*dx + Math.pow(ballPosition.y - (playerPosition.y + PLAYER_HEIGHT/2), 2));
        if (dist < PLAYER_WIDTH * 0.8 && ballPosition.x > playerPosition.x && ballVelocity.x < 0) {
            window.aiKicking = true;
        } else {
            window.aiKicking = false;
        }
    } else {
        window.aiKicking = false;
    }
    switch (currentAiState) {
        case AI_STATE.IDLE:
            handleIdleState(playerPosition);
            break;
        case AI_STATE.DEFEND:
            handleDefendState(ballPosition, playerPosition);
            break;
        case AI_STATE.ATTACK:
            handleAttackState(ballPosition, playerPosition);
            break;
        case AI_STATE.RECOVER:
            handleRecoverState(playerPosition);
            break;
        case AI_STATE.GOALKEEPER:
            handleGoalkeeperState(ballPosition, playerPosition);
            break;
    }
}

// ===================================================================================
// State Determination Logic
// ===================================================================================
function determineAiState(ballPos, playerPos, halfX, ballVel) {
    // برای تست: AI همیشه در حالت IDLE باشد
    currentAiState = AI_STATE.IDLE;
    return;
}

// ===================================================================================
// State Handling Functions (Initial stubs)
// ===================================================================================
function handleIdleState(playerPos) {
    let targetX = CANVAS_WIDTH * 0.75; // Default defensive position for player 2 (AI's right side of its half)
    const adaptationShift = PLAYER_WIDTH * 0.35; // How much to shift position based on opponent habits

    // Adaptive positioning: if opponent favors a side, shift AI's default idle position
    const totalRecentAttacks = recentOpponentActions.length; // recentOpponentActions.reduce((sum, action) => sum + 1, 0); is same as length
    // Only adapt if there's a decent amount of data and a clear preference
    if (totalRecentAttacks > ADAPTATION_MEMORY_SIZE / 2) {
        const leftAttacks = opponentAttackZones.left;
        const rightAttacks = opponentAttackZones.right;
        // If P1 attacks more from their left (AI's right goal side), AI should shift more to its right.
        if (leftAttacks > rightAttacks && leftAttacks > opponentAttackZones.center) {
            targetX += adaptationShift;
        }
        // If P1 attacks more from their right (AI's left goal side), AI should shift more to its left.
        else if (rightAttacks > leftAttacks && rightAttacks > opponentAttackZones.center) {
            targetX -= adaptationShift;
        }
    }
    // Ensure targetX is within reasonable bounds of AI's half
    targetX = Math.max(OPPONENT_HALF_X_LINE + PLAYER_WIDTH, Math.min(CANVAS_WIDTH - PLAYER_WIDTH, targetX));
    moveHorizontally(playerPos, targetX, MOVE_FORCE * 0.5); // Slower movement in idle
}

// --- Safe horizontal movement: never move toward ball if it's behind and close ---
function safeMoveHorizontally(playerPosition, targetX, force, ballPos) {
    // If the ball is behind AI and close, do not move
    if (ballPos.x < playerPosition.x - PLAYER_WIDTH/2 && Math.abs(ballPos.x - playerPosition.x) < PLAYER_WIDTH * 1.5) {
        return;
    }
    // If the ball is between AI and its own goal and very close, stop
    if (ballPos.x < playerPosition.x && Math.abs(ballPos.x - playerPosition.x) < PLAYER_WIDTH * 1.5) {
        return;
    }
    moveHorizontally(playerPosition, targetX, force);
}

// --- Defend: only jump if ball is behind and close, otherwise move safely ---
function handleDefendState(ballPos, playerPos) {
    const scaledGravity = gameEngine.gravity.y * gameEngine.timing.timeScale * gameEngine.timing.timeScale;
    let predictedLandingX = predictBallLandingX(ballPos, gameBall.velocity, scaledGravity);

    // If the ball is behind AI and close, only jump cautiously
    if (ballPos.x < playerPos.x - PLAYER_WIDTH/2 && Math.abs(ballPos.x - playerPos.x) < PLAYER_WIDTH * 1.5) {
        if (aiPlayer.isGrounded && (Date.now() - lastJumpTime) > JUMP_COOLDOWN) {
            Matter.Body.applyForce(aiPlayer.body, aiPlayer.body.position, { x: -0.01, y: -JUMP_FORCE });
            aiPlayer.isGrounded = false;
            lastJumpTime = Date.now();
        }
        return;
    }
    // Otherwise, move safely
    safeMoveHorizontally(playerPos, predictedLandingX, MOVE_FORCE, ballPos);
    // Normal defensive jump
    if (shouldJump(ballPos, playerPos, false, opponentJumpFrequency > 0.6)) {
        performJump();
    }
}

// --- Attack: if ball is behind and close, only jump, do not attack ---
function handleAttackState(ballPos, playerPos) {
    if (ballPos.x < playerPos.x - PLAYER_WIDTH/2 && Math.abs(ballPos.x - playerPos.x) < PLAYER_WIDTH * 1.5) {
        if (aiPlayer.isGrounded && (Date.now() - lastJumpTime) > JUMP_COOLDOWN) {
            Matter.Body.applyForce(aiPlayer.body, aiPlayer.body.position, { x: -0.01, y: -JUMP_FORCE });
            aiPlayer.isGrounded = false;
            lastJumpTime = Date.now();
        }
        return;
    }
    moveHorizontally(playerPos, ballPos.x, MOVE_FORCE * 1.2);
    if (shouldJump(ballPos, playerPos, true, opponentJumpFrequency > 0.6 && ballPos.y < PLAYER_HEIGHT * 1.5)) {
        performJump();
    }
}

function handleRecoverState(playerPos) {
    // Move back to a default defensive position
    const defaultPositionX = CANVAS_WIDTH * 0.75; // Player 2 default side
    moveHorizontally(playerPos, defaultPositionX, MOVE_FORCE);
    // If player is significantly out of position (e.g., y too high), maybe a small corrective action
}

function handleGoalkeeperState(ballPos, playerPos) {
    // AI's goal is on the right side
    const aiGoalX = CANVAS_WIDTH - GOAL_WIDTH / 2;
    const aiGoalWidth = GOAL_WIDTH;
    const aiGoalLeft = aiGoalX - aiGoalWidth / 2;
    const aiGoalRight = aiGoalX + aiGoalWidth / 2;

    // فاصله توپ تا خط دروازه
    const ballToGoal = aiGoalX - ballPos.x;
    // فاصله افقی AI تا توپ
    const aiToBall = ballPos.x - playerPos.x;

    // اگر توپ خیلی نزدیک به خط دروازه است (در آستانه گل شدن)
    if (ballPos.x > aiGoalLeft - PLAYER_WIDTH && ballToGoal < PLAYER_WIDTH * 1.2) {
        // فقط اگر توپ خیلی نزدیک به خط دروازه است، سعی کند با پرش دفع کند
        if (aiPlayer.isGrounded && (Date.now() - lastJumpTime) > JUMP_COOLDOWN) {
            Matter.Body.applyForce(aiPlayer.body, aiPlayer.body.position, {
                x: 0.03, // به سمت راست
                y: -JUMP_FORCE * 1.2
            });
            aiPlayer.isGrounded = false;
            lastJumpTime = Date.now();
        }
        // همیشه بین توپ و دروازه قرار بگیرد
        moveHorizontally(playerPos, aiGoalX - PLAYER_WIDTH * 1.2, MOVE_FORCE * 0.5);
        return;
    }

    // اگر توپ سمت راست AI است (بین AI و دروازه خودش)
    if (aiToBall > 0 && ballPos.x >= aiGoalLeft && ballPos.x <= aiGoalRight) {
        // AI باید کاملاً متوقف شود و هیچ حرکتی نکند
        return;
    }

    // در غیر این صورت، رفتار دفاعی عادی
    const defaultPositionX = CANVAS_WIDTH * 0.75;
    moveHorizontally(playerPos, defaultPositionX, MOVE_FORCE);
}

// ===================================================================================
// AI Action Functions (Movement and Jumping)
// ===================================================================================
function moveHorizontally(playerPosition, targetX, force) {
    const currentMoveForce = aiPlayer.isGrounded ? force : force * AIR_MOVE_FORCE_MULTIPLIER;
    // Add a small dead zone to prevent jittering if AI is very close to targetX
    const deadZone = PLAYER_WIDTH * 0.1;
    if (targetX < playerPosition.x - deadZone) { // Target is to the left
        Matter.Body.applyForce(aiPlayer.body, playerPosition, { x: -currentMoveForce, y: 0 });
    } else if (targetX > playerPosition.x + deadZone) { // Target is to the right
        Matter.Body.applyForce(aiPlayer.body, playerPosition, { x: currentMoveForce, y: 0 });
    }
}

/**
 * Determines if the AI should jump.
 * @param {object} ballPos - Ball's position.
 * @param {object} playerPos - AI Player's position.
 * @param {boolean} isAttacking - True if in ATTACK state.
 * @param {boolean} [opponentIsLikelyToJump=false] - Hint if opponent frequently jumps.
 * @returns {boolean}
 */
function shouldJump(ballPos, playerPos, isAttacking = false, opponentIsLikelyToJump = false) {
    const timeSinceLastJump = Date.now() - lastJumpTime;
    if (!aiPlayer.isGrounded || timeSinceLastJump < JUMP_COOLDOWN) {
        return false;
    }

    const horizontalDistance = Math.abs(ballPos.x - playerPos.x);
    const verticalDistance = playerPos.y - ballPos.y; // Positive if ball is above player's feet

    let jumpRangeX = isAttacking ? PLAYER_WIDTH * 1.5 : PLAYER_WIDTH * 2;
    // Tighter horizontal range for attack jumps, needs to be more precise
    if (isAttacking) jumpRangeX = PLAYER_WIDTH * 1.2;


    let jumpHeightMin = PLAYER_HEIGHT * 0.5; // Ball's center must be at least half player height above player's feet
    let jumpHeightMax = PLAYER_HEIGHT * 3;   // And not too high to be reachable (approx 3x player height)

    // If opponent is jumpy, AI might need to adjust its defensive jump timing/height check
    if (!isAttacking && opponentIsLikelyToJump) {
        jumpHeightMin = PLAYER_HEIGHT * 0.25; // Be ready for slightly lower aerials or earlier jumps
        jumpRangeX = PLAYER_WIDTH * 2.2; // Slightly wider anticipation
    }

    // Specific condition for attacking: ball should ideally be in front and slightly above.
    if (isAttacking) {
        // Player wants to hit the ball forward (towards x=0 for Player 2)
        // So, ball should be slightly to the left of player, or player moving into it from right.
        // verticalDistance check is crucial: ball must be above feet and below/at head height.
        if (ballPos.x < playerPos.x + PLAYER_WIDTH * 0.5) { // Ball is generally in front or not too far behind
             if (horizontalDistance < jumpRangeX &&
                 verticalDistance > PLAYER_HEIGHT * 0.1 && // Ball just needs to be a bit above feet
                 verticalDistance < PLAYER_HEIGHT * 1.5) { // And not higher than head for a good attacking header
                 return true;
             }
        }
    } else { // Defensive jump
        if (horizontalDistance < jumpRangeX &&
            verticalDistance > jumpHeightMin &&
            verticalDistance < jumpHeightMax) {
            return true;
        }
    }
    return false;
}

function performJump() {
    if (aiPlayer.isGrounded && (Date.now() - lastJumpTime) > JUMP_COOLDOWN) {
        Matter.Body.applyForce(aiPlayer.body, aiPlayer.body.position, { x: 0, y: -JUMP_FORCE });
        aiPlayer.isGrounded = false; // Assume this will be updated by collision events in game.js
        lastJumpTime = Date.now();
        // console.log("AI Player jumped.");
    }
}

// ===================================================================================
// Ball Prediction Logic
// ===================================================================================
function predictBallLandingX(ballPos, ballVel, gravityY) {
    // If ball is on or below ground, prediction is its current X.
    // GROUND_Y is the top surface of the ground. Ball's y is its center.
    if (ballPos.y + BALL_RADIUS >= GROUND_Y) {
        return ballPos.x;
    }

    // Parabolic trajectory calculation to predict landing spot
    // Formula for time to reach ground: t = (vy + sqrt(vy^2 + 2*g*h)) / g
    // where:
    // vy = current vertical velocity (ballVel.y)
    // g = gravity (gravityY, ensure it's positive for calculation)
    // h = current height above ground (GROUND_Y - (ballPos.y + BALL_RADIUS)) -> distance for ball bottom to reach ground surface

    const h = (GROUND_Y - BALL_RADIUS) - ballPos.y; // Height from ball's center to ground level minus radius
    const g = Math.abs(gravityY); // Ensure gravity is positive

    // If ball is already on the ground or somehow below, or g is 0.
    if (h <= 0 || g === 0) {
        return ballPos.x;
    }

    // Calculate time to reach ground
    // We need to consider the two solutions for t from the quadratic formula:
    // ax^2 + bx + c = 0  =>  0.5*g*t^2 + vy*t - h = 0
    // t = (-vy +/- sqrt(vy^2 - 4*(0.5g)*(-h))) / (2*0.5g)
    // t = (-vy +/- sqrt(vy^2 + 2*g*h)) / g
    // We take the positive t that makes sense for future landing.

    const discriminant = ballVel.y * ballVel.y + 2 * g * h;
    if (discriminant < 0) {
        // Should not happen if ball is above ground and gravity is normal (ball will eventually fall)
        // This might mean ball is moving upwards so fast it won't return before some other event,
        // or it's a very unusual situation. For defensive purposes, might aim for current X or a safe spot.
        return ballPos.x; // Fallback to current X
    }

    const t1 = (-ballVel.y + Math.sqrt(discriminant)) / g;
    const t2 = (-ballVel.y - Math.sqrt(discriminant)) / g;

    // Select the meaningful positive time to impact
    let timeToImpact = 0;
    if (t1 > 0 && t2 > 0) {
        timeToImpact = Math.min(t1, t2); // Should usually be t1 if vy is upwards or zero
                                         // if vy is downwards, t1 is positive, t2 is negative
    } else if (t1 > 0) {
        timeToImpact = t1;
    } else if (t2 > 0) {
        // This case (t1 <=0, t2 > 0) implies ballVel.y is significantly positive (upwards)
        // and the formula gives one past time and one future time.
        // However, standard physics would mean -vy + sqrt(...) is the one for peak and return.
        // If ballVel.y is positive (upwards), -ballVel.y is negative. sqrt(discriminant) must be > ballVel.y.
        // If ballVel.y is negative (downwards), -ballVel.y is positive. Then t1 is always positive.
        // So we primarily care about t1 if it's positive.
        timeToImpact = t2; // Less likely path, but check just in case
    } else {
        // No positive time to impact, ball might be moving away upwards indefinitely or stuck
        // Or calculation error. Fallback.
        return ballPos.x;
    }

    if (timeToImpact <= 0) { // If no valid future time, return current X.
        return ballPos.x;
    }

    let predictedX = ballPos.x + ballVel.x * timeToImpact;

    // Factor in air resistance (simplistic reduction in travel distance)
    // This is a fudge factor. Real air resistance is complex (proportional to v^2).
    const airResistanceFactor = 0.98; // Assume it travels 98% of the raw predicted distance
    predictedX = ballPos.x + (predictedX - ballPos.x) * airResistanceFactor;


    // Clamp prediction to AI's half of the field, but allow it to go slightly beyond goal to defend.
    // Give some buffer near walls and goal.
    const minX = CANVAS_WIDTH / 2 + BALL_RADIUS;
    const maxX = CANVAS_WIDTH - BALL_RADIUS;
    predictedX = Math.max(minX, predictedX);
    predictedX = Math.min(maxX, predictedX);

    // Strategic override: if ball is moving very slowly horizontally towards AI,
    // or is very high, AI might prefer a central defensive position.
    if (Math.abs(ballVel.x) < 0.5 && ballPos.x > CANVAS_WIDTH / 2) {
        // If ball is in AI half and slow, target its current X or a bit towards center goal.
        const goalCenter = CANVAS_WIDTH - GOAL_WIDTH / 2;
        //趋向于球门中心
        if (predictedX > goalCenter - GOAL_WIDTH*0.25 && predictedX < goalCenter + GOAL_WIDTH*0.25){
             //If already aiming near goal, fine.
        } else {
            //predictedX = (predictedX + goalCenter)/2; // Average with goal center
        }
    }

    // If ball is very high (e.g., above player's max jump height),
    // AI should position itself more centrally rather than directly under.
    const maxReachableHeightByPlayer = GROUND_Y - PLAYER_HEIGHT * 2.5; // Approximate
    if (ballPos.y < maxReachableHeightByPlayer && timeToImpact > 0.5) { // If ball is high and will take time to fall
        //predictedX = (predictedX + (CANVAS_WIDTH * 0.75)) / 2; // Average with default defensive spot
    }


    // console.log(`Predicted X: ${predictedX.toFixed(2)}, Time: ${timeToImpact.toFixed(2)}, h:${h.toFixed(2)}, vy:${ballVel.y.toFixed(2)}`);
    return predictedX;
}

// ===================================================================================
// Utility function to be called if AI needs to reset (e.g., after a goal)
// ===================================================================================
function resetAIState() {
    currentAiState = AI_STATE.RECOVER; // Or IDLE, depending on desired post-goal behavior
    // Reset any temporary AI variables if needed
    goalkeeperPhase = 0;
    goalkeeperStartTime = 0;
    console.log("AI State Reset to RECOVER.");
}

// ===================================================================================
// Expose functions to be used by game.js
// ===================================================================================
window.initializeAI = initializeAI;
window.updateAI = updateAI;
window.resetAIState = resetAIState;
window.recordOpponentOffensiveAction = recordOpponentOffensiveAction;
