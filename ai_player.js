// AI Player Logic for Team 2 (Blue)

// --- AI Constants ---
// AI_PLAYER_INDEX is defined in game.js and will be globally available.

// --- Finite State Machine (FSM) States ---
const AI_STATE = {
    IDLE: 'IDLE',       // Ball is in opponent's half
    DEFEND: 'DEFEND',   // Ball is in AI's half
    ATTACK: 'ATTACK',   // Ball is near AI and in a good position to shoot
    RECOVER: 'RECOVER'  // After conceding a goal or defensive disarray
};

// --- Game Configuration (to be populated by initializeAI) ---
let C_WIDTH, C_HEIGHT, P_WIDTH, P_HEIGHT, J_FORCE, M_FORCE, AIR_M_FORCE_MULT, B_RADIUS, F_SURFACE_Y, G_HEIGHT, G_WIDTH;

// --- AI Variables ---
let currentAiState = AI_STATE.IDLE;
let gameIsOver = false; // مقدار داخلی برای وضعیت بازی
let lastJumpTime = 0;
const JUMP_COOLDOWN = 500; // Milliseconds (0.5 seconds)

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
// These will be effectively initialized after C_WIDTH is set in initializeAI
let OPPONENT_HALF_X_LINE;
let PLAYER1_ATTACK_ZONE_THIRD;

// ===================================================================================
// AI Initialization & Adaptation API
// ===================================================================================
function initializeAI(player, ball, engine, config) {
    aiPlayer = player;
    gameBall = ball;
    gameEngine = engine;

    C_WIDTH = config.CANVAS_WIDTH;
    C_HEIGHT = config.CANVAS_HEIGHT;
    P_WIDTH = config.PLAYER_WIDTH;
    P_HEIGHT = config.PLAYER_HEIGHT;
    J_FORCE = config.JUMP_FORCE;
    M_FORCE = config.MOVE_FORCE;
    AIR_M_FORCE_MULT = config.AIR_MOVE_FORCE_MULTIPLIER;
    B_RADIUS = config.BALL_RADIUS;
    F_SURFACE_Y = config.FIELD_SURFACE_Y; // قبلاً GROUND_Y بود
    G_HEIGHT = config.GOAL_HEIGHT;
    G_WIDTH = config.GOAL_WIDTH;
    gameIsOver = config.isGameOver; // مقدار اولیه

    // Initialize constants that depend on C_WIDTH
    OPPONENT_HALF_X_LINE = C_WIDTH / 2;
    PLAYER1_ATTACK_ZONE_THIRD = C_WIDTH / 4;

    console.log("AI Initialized for Player 2 (Blue). Current State: ", currentAiState);
    recentOpponentActions = [];
    opponentAttackZones = { left: 0, center: 0, right: 0 };
    opponentJumpFrequency = 0;
}

/**
 * Records an action from the opponent (Player 1) to learn patterns.
 * Call this from game.js when P1 makes a significant offensive move.
 * @param {number} p1PosX - Player 1's X position at the time of action.
 * @param {boolean} p1Jumped - Whether Player 1 was jumping/in air during the action.
 */
function recordOpponentOffensiveAction(p1PosX, p1Jumped) {
    // Action must originate from P1's half (i.e. p1PosX < C_WIDTH / 2)
    if (p1PosX >= C_WIDTH / 2) return;

    let zone = 'center';
    const opponentHalfLine = C_WIDTH / 2;
    const player1AttackZoneThird = C_WIDTH / 4;
    // P1's perspective: 'left' is x < player1AttackZoneThird
    // 'right' is x > opponentHalfLine - player1AttackZoneThird
    if (p1PosX < player1AttackZoneThird) {
        zone = 'left'; // Player 1 attacked from their left side
    } else if (p1PosX > opponentHalfLine - player1AttackZoneThird) {
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
function updateAI(isCurrentlyGameOver) { // دریافت وضعیت بازی
    gameIsOver = isCurrentlyGameOver; // به‌روزرسانی وضعیت بازی
    if (!aiPlayer || !gameBall || !gameBall.velocity || gameIsOver) {
        return;
    }

    const ballPosition = gameBall.position;
    const playerPosition = aiPlayer.body.position;
    const playerHalfX = C_WIDTH / 2; // استفاده از متغیر داخلی
    const ballVelocity = gameBall.velocity;

    // Update current state based on game conditions
    determineAiState(ballPosition, playerPosition, playerHalfX, ballVelocity);

    // Execute actions based on the current state
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
    }
    // Apply movement and jump decisions to the AI player's body
    // This will be expanded in later steps
}

// ===================================================================================
// State Determination Logic
// ===================================================================================
function determineAiState(ballPos, playerPos, halfX, ballVel) {
    const ballInAiHalf = ballPos.x > halfX;
    const ballNearPlayerX = Math.abs(ballPos.x - playerPos.x) < P_WIDTH * 2.5; // Player can reach horizontally
    const ballNearPlayerY = Math.abs(ballPos.y - playerPos.y) < P_HEIGHT * 2.5; // Player can reach vertically (for jump/hit)
    const ballAbovePlayer = playerPos.y > ballPos.y; // Ball is higher than player's feet
    const ballBelowPlayerHead = ballPos.y > playerPos.y - P_HEIGHT; // Ball is below player's head (roughly)

    const recoveryThreshold = P_WIDTH * 0.5; // How close to default position to be considered recovered

    // RECOVER state logic:
    // If in RECOVER state, check if player has reached the recovery position.
    // The recovery position is typically the default defensive X coordinate.
    if (currentAiState === AI_STATE.RECOVER) {
        const recoveredX = Math.abs(playerPos.x - (C_WIDTH * 0.75)) < recoveryThreshold;
        // Could also check Y position if player gets thrown high, but ground check is more important.
        if (recoveredX && aiPlayer.isGrounded) {
            // Transition out of RECOVER based on ball position
            currentAiState = ballInAiHalf ? AI_STATE.DEFEND : AI_STATE.IDLE;
            // console.log("AI Recovered. New State: ", currentAiState);
            return; // State decided
        } else {
            return; // Stay in RECOVER until position is met
        }
    }

    // ATTACK state logic:
    // Conditions: Ball in AI's half, close to player, and in a "hittable" zone.
    // "Hittable" could mean ball is not too high and ideally in front or slightly above.
    if (ballInAiHalf && ballNearPlayerX && ballNearPlayerY) {
        if (ballPos.y < F_SURFACE_Y - B_RADIUS * 0.5 && // Ball is off the ground
            ballAbovePlayer && // Ball is generally above feet
            ballBelowPlayerHead && // Ball is not way above head
            (ballVel.x > -0.5 || playerPos.x < ballPos.x)) { // Ball moving towards opponent or AI is behind/level with ball
            currentAiState = AI_STATE.ATTACK;
            // console.log("AI State -> ATTACK");
            return;
        }
    }

    // DEFEND state logic:
    // Conditions: Ball in AI's half but not meeting ATTACK criteria.
    if (ballInAiHalf) {
        currentAiState = AI_STATE.DEFEND;
        // console.log("AI State -> DEFEND");
        return;
    }

    // IDLE state logic:
    // Conditions: Ball in opponent's half.
    if (!ballInAiHalf) {
        currentAiState = AI_STATE.IDLE;
        // console.log("AI State -> IDLE");
        return;
    }

    // Default fallback, though above conditions should cover all scenarios.
    // If somehow no state is set, default to IDLE or DEFEND based on ball position.
    if (currentAiState !== AI_STATE.RECOVER) { // Ensure recover is not overridden
        currentAiState = ballInAiHalf ? AI_STATE.DEFEND : AI_STATE.IDLE;
        // console.log("AI State -> Fallback: ", currentAiState);
    }
}

// ===================================================================================
// State Handling Functions (Initial stubs)
// ===================================================================================
function handleIdleState(playerPos) {
    let targetX = C_WIDTH * 0.75; // Default defensive position for player 2 (AI's right side of its half)
    const adaptationShift = P_WIDTH * 0.35; // How much to shift position based on opponent habits

    // Adaptive positioning: if opponent favors a side, shift AI's default idle position
    const totalRecentAttacks = recentOpponentActions.length;
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
    const opponentHalfLine = C_WIDTH / 2;
    targetX = Math.max(opponentHalfLine + P_WIDTH, Math.min(C_WIDTH - P_WIDTH, targetX));
    moveHorizontally(playerPos, targetX, M_FORCE * 0.5); // Slower movement in idle
}

function handleDefendState(ballPos, playerPos) {
    const scaledGravity = gameEngine.gravity.y * gameEngine.timing.timeScale * gameEngine.timing.timeScale;
    let predictedLandingX = predictBallLandingX(ballPos, gameBall.velocity, scaledGravity);

    // Optional: Minor adjustment to predictedLandingX based on opponent habits if ball is very far.
    // This is more complex and might make AI jittery if not careful.
    // Example: If opponent strongly prefers their left and ball is coming from P1's side,
    // slightly bias prediction towards covering AI's right side of goal.
    // For now, direct prediction is usually better in active defense.

    moveHorizontally(playerPos, predictedLandingX, M_FORCE);

    // Pass opponent jump frequency hint to shouldJump
    if (shouldJump(ballPos, playerPos, false, opponentJumpFrequency > 0.6)) {
        performJump();
    }
}

function handleAttackState(ballPos, playerPos) {
    // Decide whether to attempt a chip shot
    // Basic condition: AI is not on kick cooldown and has a random chance.
    // More advanced: check if opponent P1 is far from their goal, or if ball is in good spot for chip.
    if (!aiPlayer.kickCooldown && Math.random() < 0.15) { // 15% chance to attempt a chip if in attack state and not on cooldown
        aiPlayer.chipShotAttempt = true;
        console.log(`AI ${aiPlayer.body.label} decided to chip. Cooldown: ${aiPlayer.kickCooldown}`); // DEBUG LOG
    } else {
        // Default attack behavior if not chipping
        // (ensure chipShotAttempt is false if not actively trying one this tick, though it's reset on successful kick)
        // aiPlayer.chipShotAttempt = false; // This might prematurely cancel an attempt if collision doesn't happen immediately
    }

    // Move towards the ball to hit it
    moveHorizontally(playerPos, ballPos.x, M_FORCE * 1.2); // Slightly faster for attack

    // Jump if ball is above and close
    if (shouldJump(ballPos, playerPos, true, opponentJumpFrequency > 0.6 && ballPos.y < P_HEIGHT * 1.5)) {
        performJump();
    }
}

function handleRecoverState(playerPos) {
    // Move back to a default defensive position
    const defaultPositionX = C_WIDTH * 0.75; // Player 2 default side
    moveHorizontally(playerPos, defaultPositionX, M_FORCE);
    // If player is significantly out of position (e.g., y too high), maybe a small corrective action
}

// ===================================================================================
// AI Action Functions (Movement and Jumping)
// ===================================================================================
function moveHorizontally(playerPosition, targetX, force) {
    const currentMoveForce = aiPlayer.isGrounded ? force : force * AIR_M_FORCE_MULT;
    // Add a small dead zone to prevent jittering if AI is very close to targetX
    const deadZone = P_WIDTH * 0.1;
    if (targetX < playerPosition.x - deadZone) { // Target is to the left
        window.Matter.Body.applyForce(aiPlayer.body, playerPosition, { x: -currentMoveForce, y: 0 });
    } else if (targetX > playerPosition.x + deadZone) { // Target is to the right
        window.Matter.Body.applyForce(aiPlayer.body, playerPosition, { x: currentMoveForce, y: 0 });
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

    let jumpRangeX = isAttacking ? P_WIDTH * 1.5 : P_WIDTH * 2;
    // Tighter horizontal range for attack jumps, needs to be more precise
    if (isAttacking) jumpRangeX = P_WIDTH * 1.2;


    let jumpHeightMin = P_HEIGHT * 0.5; // Ball's center must be at least half player height above player's feet
    let jumpHeightMax = P_HEIGHT * 3;   // And not too high to be reachable (approx 3x player height)

    // If opponent is jumpy, AI might need to adjust its defensive jump timing/height check
    if (!isAttacking && opponentIsLikelyToJump) {
        jumpHeightMin = P_HEIGHT * 0.25; // Be ready for slightly lower aerials or earlier jumps
        jumpRangeX = P_WIDTH * 2.2; // Slightly wider anticipation
    }

    // Specific condition for attacking: ball should ideally be in front and slightly above.
    if (isAttacking) {
        // Player wants to hit the ball forward (towards x=0 for Player 2)
        // So, ball should be slightly to the left of player, or player moving into it from right.
        // verticalDistance check is crucial: ball must be above feet and below/at head height.
        if (ballPos.x < playerPos.x + P_WIDTH * 0.5) { // Ball is generally in front or not too far behind
             if (horizontalDistance < jumpRangeX &&
                 verticalDistance > P_HEIGHT * 0.1 && // Ball just needs to be a bit above feet
                 verticalDistance < P_HEIGHT * 1.5) { // And not higher than head for a good attacking header
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
        window.Matter.Body.applyForce(aiPlayer.body, aiPlayer.body.position, { x: 0, y: -J_FORCE });
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
    // F_SURFACE_Y is the top surface of the ground. Ball's y is its center.
    if (ballPos.y + B_RADIUS >= F_SURFACE_Y) {
        return ballPos.x;
    }

    // Parabolic trajectory calculation to predict landing spot
    // Formula for time to reach ground: t = (vy + sqrt(vy^2 + 2*g*h)) / g
    // where:
    // vy = current vertical velocity (ballVel.y)
    // g = gravity (gravityY, ensure it's positive for calculation)
    // h = current height above ground (F_SURFACE_Y - (ballPos.y + B_RADIUS)) -> distance for ball bottom to reach ground surface

    const h = (F_SURFACE_Y - B_RADIUS) - ballPos.y; // Height from ball's center to ground level minus radius
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
    const minX = C_WIDTH / 2 + B_RADIUS;
    const maxX = C_WIDTH - B_RADIUS;
    predictedX = Math.max(minX, predictedX);
    predictedX = Math.min(maxX, predictedX);

    // Strategic override: if ball is moving very slowly horizontally towards AI,
    // or is very high, AI might prefer a central defensive position.
    if (Math.abs(ballVel.x) < 0.5 && ballPos.x > C_WIDTH / 2) {
        // If ball is in AI half and slow, target its current X or a bit towards center goal.
        const goalCenter = C_WIDTH - G_WIDTH / 2;
        //趋向于球门中心
        if (predictedX > goalCenter - G_WIDTH*0.25 && predictedX < goalCenter + G_WIDTH*0.25){
             //If already aiming near goal, fine.
        } else {
            //predictedX = (predictedX + goalCenter)/2; // Average with goal center
        }
    }

    // If ball is very high (e.g., above player's max jump height),
    // AI should position itself more centrally rather than directly under.
    const maxReachableHeightByPlayer = F_SURFACE_Y - P_HEIGHT * 2.5; // Approximate
    if (ballPos.y < maxReachableHeightByPlayer && timeToImpact > 0.5) { // If ball is high and will take time to fall
        //predictedX = (predictedX + (C_WIDTH * 0.75)) / 2; // Average with default defensive spot
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
    console.log("AI State Reset to RECOVER.");
}

// ===================================================================================
// Expose functions to be used by game.js
// ===================================================================================
export { initializeAI, updateAI, resetAIState, recordOpponentOffensiveAction };
