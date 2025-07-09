// Enhanced AI System for PixelBall with Human-like Behavior
class EnhancedAI {
    constructor() {
        // Basic AI properties
        this.player = null;
        this.ball = null;
        this.engine = null;
        this.state = 'IDLE';
        this.lastJumpTime = 0;
        this.jumpCooldown = 500;
        
        // Enhanced behavior properties
        this.lastDecisionTime = 0;
        this.decisionDelay = 0;
        this.nextDecisionDelay = this.getRandomDecisionDelay();
        
        // Opportunistic behavior
        this.opportunityThreshold = 0.7; // 70% chance to take opportunities
        this.riskTakingLevel = 0.6; // 60% aggressive
        
        // Mistake simulation
        this.mistakeChance = 0.05; // 5% chance of mistakes
        this.lastMistakeTime = 0;
        this.mistakeCooldown = 3000; // 3 seconds between mistakes
        
        // Opponent analysis
        this.opponentPatterns = {
            attackZones: { left: 0, center: 0, right: 0 },
            jumpFrequency: 0,
            aggressionLevel: 0.5,
            recentActions: []
        };
        
        // Defensive boundaries (prevent own goals)
        this.defensiveBoundary = 0.85; // Don't go beyond 85% of field width
        this.goalAreaLimit = 0.95; // Absolutely never enter own goal area
        
        // Counter-attack state
        this.counterAttackWindow = 0;
        this.counterAttackDuration = 2000; // 2 seconds window
        
        // Emotional state simulation
        this.confidence = 0.5; // Affects decision making
        this.frustration = 0; // Increases with failed attempts
    }

    initialize(player, ball, engine) {
        this.player = player;
        this.ball = ball;
        this.engine = engine;
        console.log("Enhanced AI initialized");
    }

    update() {
        if (!this.player || !this.ball || isGameOver) return;

        const currentTime = Date.now();
        
        // Decision delay simulation (human-like thinking time)
        if (currentTime - this.lastDecisionTime < this.decisionDelay) {
            return; // Still "thinking"
        }

        this.updateOpponentAnalysis();
        this.updateEmotionalState();
        this.determineState();
        this.executeAction();
        
        // Set next decision delay
        this.lastDecisionTime = currentTime;
        this.decisionDelay = this.nextDecisionDelay;
        this.nextDecisionDelay = this.getRandomDecisionDelay();
    }

    getRandomDecisionDelay() {
        // Variable delay based on situation complexity
        const baseDelay = 80 + Math.random() * 80; // 80-160ms
        const situationMultiplier = this.getSituationComplexity();
        return Math.floor(baseDelay * situationMultiplier);
    }

    getSituationComplexity() {
        const ballSpeed = Math.sqrt(this.ball.velocity.x ** 2 + this.ball.velocity.y ** 2);
        const ballDistance = Math.abs(this.ball.position.x - this.player.body.position.x);
        
        // More complex situations need more thinking time
        if (ballSpeed > 5 || ballDistance < 100) return 1.5;
        if (this.state === 'ATTACK') return 1.3;
        return 1.0;
    }

    updateOpponentAnalysis() {
        // This would be called from main game when player 1 makes actions
        // For now, we simulate some analysis
        const recentActionsLimit = 10;
        if (this.opponentPatterns.recentActions.length > recentActionsLimit) {
            this.opponentPatterns.recentActions.shift();
        }
    }

    recordOpponentAction(action, position, wasAggressive = false) {
        this.opponentPatterns.recentActions.push({
            action,
            position,
            wasAggressive,
            timestamp: Date.now()
        });

        // Update patterns
        if (position.x < CANVAS_WIDTH * 0.33) {
            this.opponentPatterns.attackZones.left++;
        } else if (position.x > CANVAS_WIDTH * 0.66) {
            this.opponentPatterns.attackZones.right++;
        } else {
            this.opponentPatterns.attackZones.center++;
        }

        if (action === 'jump') {
            this.opponentPatterns.jumpFrequency = 
                (this.opponentPatterns.jumpFrequency + 1) / 2;
        }

        if (wasAggressive) {
            this.opponentPatterns.aggressionLevel = 
                Math.min(1.0, this.opponentPatterns.aggressionLevel + 0.1);
        }
    }

    updateEmotionalState() {
        // Confidence affects performance
        if (this.state === 'ATTACK' && this.isOpportunityAvailable()) {
            this.confidence = Math.min(1.0, this.confidence + 0.05);
        }
        
        // Frustration increases over time without action
        if (this.state === 'IDLE' && this.frustration < 1.0) {
            this.frustration += 0.01;
        } else if (this.state === 'ATTACK') {
            this.frustration = Math.max(0, this.frustration - 0.1);
        }
    }

    determineState() {
        const ballPos = this.ball.position;
        const playerPos = this.player.body.position;
        const ballVel = this.ball.velocity;
        const halfField = CANVAS_WIDTH / 2;

        // Emergency defense (always override other states)
        if (this.isEmergencyDefenseNeeded(ballPos, ballVel)) {
            this.state = 'EMERGENCY_DEFENSE';
            return;
        }

        // Opportunistic attack detection
        if (this.isOpportunityAvailable() && Math.random() < this.opportunityThreshold) {
            this.state = 'OPPORTUNISTIC_ATTACK';
            this.confidence += 0.1;
            return;
        }

        // Counter-attack window
        if (this.counterAttackWindow > 0) {
            this.counterAttackWindow -= 16; // Assuming 60fps
            if (this.canCounterAttack(ballPos, playerPos)) {
                this.state = 'COUNTER_ATTACK';
                return;
            }
        }

        // Standard state determination with randomness
        const ballInMyHalf = ballPos.x > halfField;
        const distanceToBall = Math.abs(ballPos.x - playerPos.x);
        
        if (ballInMyHalf) {
            if (distanceToBall < 80 && this.canAttackBall(ballPos, playerPos)) {
                // Early attack with risk assessment
                const riskFactor = this.assessRisk(ballPos, ballVel);
                if (Math.random() < this.riskTakingLevel - riskFactor) {
                    this.state = 'EARLY_ATTACK';
                } else {
                    this.state = 'DEFEND';
                }
            } else {
                this.state = 'DEFEND';
            }
        } else {
            // Idle behavior with slight randomness
            if (Math.random() < 0.1) { // 10% chance of proactive positioning
                this.state = 'PROACTIVE_POSITIONING';
            } else {
                this.state = 'IDLE';
            }
        }
    }

    isEmergencyDefenseNeeded(ballPos, ballVel) {
        const myGoalX = CANVAS_WIDTH;
        const ballSpeed = Math.sqrt(ballVel.x ** 2 + ballVel.y ** 2);
        
        // Fast ball heading towards my goal
        if (ballVel.x > 3 && ballPos.x > CANVAS_WIDTH * 0.7 && ballSpeed > 4) {
            return true;
        }
        
        // Ball very close to my goal
        if (ballPos.x > CANVAS_WIDTH * 0.85) {
            return true;
        }
        
        return false;
    }

    isOpportunityAvailable() {
        const ballPos = this.ball.position;
        const myGoalX = CANVAS_WIDTH;
        const opponentGoalX = 0;
        
        // Opponent goal is "open" (simplified)
        const goalIsOpen = Math.random() < 0.3; // 30% chance goal appears open
        
        // Ball is in attacking position
        const ballInAttackPosition = ballPos.x < CANVAS_WIDTH * 0.6;
        
        // I'm in reasonable position to attack
        const inAttackPosition = this.player.body.position.x > CANVAS_WIDTH * 0.4;
        
        return goalIsOpen && ballInAttackPosition && inAttackPosition;
    }

    canCounterAttack(ballPos, playerPos) {
        // Recent successful defense + ball control opportunity
        const ballClose = Math.abs(ballPos.x - playerPos.x) < 60;
        const ballInMyControl = ballPos.x > playerPos.x - 40 && ballPos.x < playerPos.x + 40;
        
        return ballClose && ballInMyControl;
    }

    assessRisk(ballPos, ballVel) {
        let risk = 0;
        
        // High speed ball = higher risk
        const ballSpeed = Math.sqrt(ballVel.x ** 2 + ballVel.y ** 2);
        if (ballSpeed > 5) risk += 0.3;
        
        // Ball very close to my goal = higher risk
        if (ballPos.x > CANVAS_WIDTH * 0.8) risk += 0.4;
        
        // My position close to goal = higher risk
        if (this.player.body.position.x > CANVAS_WIDTH * 0.85) risk += 0.3;
        
        return Math.min(1.0, risk);
    }

    canAttackBall(ballPos, playerPos) {
        const distanceY = Math.abs(ballPos.y - playerPos.y);
        const distanceX = Math.abs(ballPos.x - playerPos.x);
        
        return distanceX < 60 && distanceY < 80;
    }

    executeAction() {
        // Simulate occasional mistakes
        if (this.shouldMakeMistake()) {
            this.executeMistake();
            return;
        }

        switch (this.state) {
            case 'IDLE':
                this.executeIdle();
                break;
            case 'DEFEND':
                this.executeDefend();
                break;
            case 'ATTACK':
            case 'EARLY_ATTACK':
            case 'OPPORTUNISTIC_ATTACK':
                this.executeAttack();
                break;
            case 'COUNTER_ATTACK':
                this.executeCounterAttack();
                break;
            case 'EMERGENCY_DEFENSE':
                this.executeEmergencyDefense();
                break;
            case 'PROACTIVE_POSITIONING':
                this.executeProactivePositioning();
                break;
        }
    }

    shouldMakeMistake() {
        const currentTime = Date.now();
        if (currentTime - this.lastMistakeTime < this.mistakeCooldown) {
            return false;
        }
        
        // Higher frustration = more mistakes
        const adjustedMistakeChance = this.mistakeChance + (this.frustration * 0.02);
        
        if (Math.random() < adjustedMistakeChance) {
            this.lastMistakeTime = currentTime;
            return true;
        }
        return false;
    }

    executeMistake() {
        const mistakes = ['wrongDirection', 'missedJump', 'tooEarly', 'tooLate'];
        const mistake = mistakes[Math.floor(Math.random() * mistakes.length)];
        
        switch (mistake) {
            case 'wrongDirection':
                // Move in wrong direction briefly
                const wrongForce = Math.random() < 0.5 ? -MOVE_FORCE : MOVE_FORCE;
                this.applyHorizontalForce(wrongForce * 0.5);
                break;
            case 'missedJump':
                // Jump at wrong time
                if (this.player.isGrounded) {
                    this.performJump();
                }
                break;
            case 'tooEarly':
            case 'tooLate':
                // Do nothing (represents poor timing)
                break;
        }
        
        console.log(`AI made mistake: ${mistake}`);
    }

    executeIdle() {
        const targetX = CANVAS_WIDTH * 0.75; // Default position
        
        // Adaptive positioning based on opponent patterns
        const totalAttacks = Object.values(this.opponentPatterns.attackZones)
                                   .reduce((a, b) => a + b, 0);
        
        if (totalAttacks > 5) {
            if (this.opponentPatterns.attackZones.left > this.opponentPatterns.attackZones.right) {
                targetX += 30; // Shift right if opponent attacks from their left
            } else if (this.opponentPatterns.attackZones.right > this.opponentPatterns.attackZones.left) {
                targetX -= 30; // Shift left if opponent attacks from their right
            }
        }

        // Random small movements for "life"
        if (Math.random() < 0.05) { // 5% chance
            targetX += (Math.random() - 0.5) * 40;
        }

        this.moveTowardsX(targetX, MOVE_FORCE * 0.5);
    }

    executeDefend() {
        const ballPos = this.ball.position;
        const predictedX = this.predictBallLanding();
        
        // Ensure we don't go too far back
        const safeX = Math.min(predictedX, CANVAS_WIDTH * this.defensiveBoundary);
        
        this.moveTowardsX(safeX, MOVE_FORCE);
        
        // Jump decision with opponent behavior consideration
        if (this.shouldDefensiveJump()) {
            this.performJump();
        }
    }

    executeAttack() {
        const ballPos = this.ball.position;
        
        // Don't attack if too close to own goal
        if (this.player.body.position.x > CANVAS_WIDTH * this.goalAreaLimit) {
            this.executeDefend();
            return;
        }
        
        this.moveTowardsX(ballPos.x, MOVE_FORCE * 1.2);
        
        if (this.shouldAttackJump()) {
            this.performJump();
        }
    }

    executeCounterAttack() {
        // Quick aggressive move towards opponent goal
        const targetX = Math.max(ballPos.x - 50, CANVAS_WIDTH * 0.3);
        this.moveTowardsX(targetX, MOVE_FORCE * 1.5);
        
        if (this.shouldAttackJump()) {
            this.performJump();
        }
    }

    executeEmergencyDefense() {
        // Priority: get between ball and goal
        const ballPos = this.ball.position;
        const myGoalCenter = CANVAS_WIDTH;
        
        // Position between ball and goal, but not IN the goal
        const emergencyX = Math.min(
            ballPos.x + 30,
            CANVAS_WIDTH * this.defensiveBoundary
        );
        
        this.moveTowardsX(emergencyX, MOVE_FORCE * 1.8);
        
        // Always try to jump if ball is close
        if (Math.abs(ballPos.x - this.player.body.position.x) < 50) {
            this.performJump();
        }
    }

    executeProactivePositioning() {
        // Move to a strategically better position
        const currentX = this.player.body.position.x;
        const idealX = CANVAS_WIDTH * 0.7;
        
        this.moveTowardsX(idealX, MOVE_FORCE * 0.7);
    }

    shouldDefensiveJump() {
        const ballPos = this.ball.position;
        const playerPos = this.player.body.position;
        const distanceX = Math.abs(ballPos.x - playerPos.x);
        const distanceY = playerPos.y - ballPos.y;
        
        // Standard jump conditions
        if (distanceX < PLAYER_WIDTH * 2 && distanceY > 20 && distanceY < 120) {
            // Factor in opponent behavior
            if (this.opponentPatterns.jumpFrequency > 0.6) {
                return Math.random() < 0.8; // 80% chance if opponent jumps a lot
            }
            return Math.random() < 0.7; // 70% chance normally
        }
        
        return false;
    }

    shouldAttackJump() {
        const ballPos = this.ball.position;
        const playerPos = this.player.body.position;
        const distanceX = Math.abs(ballPos.x - playerPos.x);
        const distanceY = playerPos.y - ballPos.y;
        
        if (distanceX < PLAYER_WIDTH * 1.5 && distanceY > 10 && distanceY < 80) {
            // More aggressive if confident
            const confidence_bonus = this.confidence * 0.3;
            return Math.random() < (0.6 + confidence_bonus);
        }
        
        return false;
    }

    moveTowardsX(targetX, force) {
        const currentX = this.player.body.position.x;
        const deadZone = PLAYER_WIDTH * 0.1;
        
        // Ensure we don't move into own goal
        const safeTargetX = Math.min(targetX, CANVAS_WIDTH * this.goalAreaLimit);
        
        const adjustedForce = this.player.isGrounded ? force : force * AIR_MOVE_FORCE_MULTIPLIER;
        
        if (safeTargetX < currentX - deadZone) {
            this.applyHorizontalForce(-adjustedForce);
        } else if (safeTargetX > currentX + deadZone) {
            this.applyHorizontalForce(adjustedForce);
        }
    }

    applyHorizontalForce(force) {
        Matter.Body.applyForce(this.player.body, this.player.body.position, { x: force, y: 0 });
    }

    performJump() {
        const currentTime = Date.now();
        if (this.player.isGrounded && (currentTime - this.lastJumpTime) > this.jumpCooldown) {
            Matter.Body.applyForce(this.player.body, this.player.body.position, { x: 0, y: -JUMP_FORCE });
            this.player.isGrounded = false;
            this.lastJumpTime = currentTime;
        }
    }

    predictBallLanding() {
        // Simplified prediction for now
        const ballPos = this.ball.position;
        const ballVel = this.ball.velocity;
        
        if (ballVel.y <= 0) return ballPos.x; // Ball going up or horizontal
        
        const timeToGround = (GROUND_Y - ballPos.y) / ballVel.y;
        return ballPos.x + (ballVel.x * timeToGround);
    }

    // Called when AI successfully defends
    triggerCounterAttack() {
        this.counterAttackWindow = this.counterAttackDuration;
        this.confidence += 0.2;
    }

    reset() {
        this.state = 'IDLE';
        this.counterAttackWindow = 0;
        this.confidence = 0.5;
        this.frustration = 0;
        this.opponentPatterns = {
            attackZones: { left: 0, center: 0, right: 0 },
            jumpFrequency: 0,
            aggressionLevel: 0.5,
            recentActions: []
        };
    }
}

// Export the enhanced AI
window.EnhancedAI = EnhancedAI;