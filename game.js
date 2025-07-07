// Soccer Physics Game - Main Game Logic
class SoccerPhysicsGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.engine = Matter.Engine.create();
        this.world = this.engine.world;
        
        // Game state
        this.gameState = 'menu'; // 'menu', 'playing', 'paused', 'ended'
        this.gameTime = 60; // seconds
        this.maxTime = 60;
        this.team1Score = 0;
        this.team2Score = 0;
        
        // Physics settings
        this.engine.world.gravity.y = 1.2;
        
        // Game objects
        this.players = [];
        this.ball = null;
        this.boundaries = [];
        this.goals = [];
        
        // Controls
        this.keys = {};
        this.playerControls = {
            player1: 'KeyA',
            player2: 'KeyS',
            player3: 'KeyK',
            player4: 'KeyL'
        };
        
        // Visual settings
        this.fieldColor = '#32CD32';
        this.grassPattern = [];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.createField();
        this.createPlayers();
        this.createBall();
        this.generateGrassPattern();
        this.render();
        
        // Start game loop
        this.gameLoop();
    }
    
    setupEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            e.preventDefault();
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            e.preventDefault();
        });
        
        // Button controls
        document.getElementById('startButton').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('resetButton').addEventListener('click', () => {
            this.resetGame();
        });
        
        document.getElementById('playAgainButton').addEventListener('click', () => {
            this.resetGame();
            document.getElementById('gameOver').style.display = 'none';
        });

        // Physics collision events
        Matter.Events.on(this.engine, 'collisionStart', (event) => {
            const pairs = event.pairs;
            for (let i = 0; i < pairs.length; i++) {
                const pair = pairs[i];
                this.players.forEach(player => {
                    // Check if a player's leg is colliding with the ground
                    if ((pair.bodyA.label === 'playerPart_leg' && pair.bodyB.label === 'ground') ||
                        (pair.bodyB.label === 'playerPart_leg' && pair.bodyA.label === 'ground')) {

                        // Check if the colliding leg belongs to this player
                        if (player.parts.includes(pair.bodyA) || player.parts.includes(pair.bodyB)) {
                            player.isGrounded = true;
                            player.jumpCount = 0; // Reset jumpCount when grounded
                        }
                    }
                });
            }
        });

        // It's often more robust to set isGrounded = false when a jump action is taken,
        // and rely on collisionStart to set it true.
        // Matter.Events.on(this.engine, 'collisionEnd', (event) => {
        //     const pairs = event.pairs;
        //     for (let i = 0; i < pairs.length; i++) {
        //         const pair = pairs[i];
        //         this.players.forEach(player => {
        //             if ((pair.bodyA.label === 'playerPart_leg' && pair.bodyB.label === 'ground') ||
        //                 (pair.bodyB.label === 'playerPart_leg' && pair.bodyA.label === 'ground')) {
        //                 if (player.parts.includes(pair.bodyA) || player.parts.includes(pair.bodyB)) {
        //                     // This might make the player lose grounded status too easily if one foot lifts slightly.
        //                     // player.isGrounded = false;
        //                 }
        //             }
        //         });
        //     }
        // });
    }
    
    createField() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Field boundaries
        const thickness = 20;
        
        // Ground
        const ground = Matter.Bodies.rectangle(width/2, height - thickness/2, width, thickness, {
            isStatic: true,
            label: 'ground', // Added label for ground
            render: { fillStyle: '#8B4513' }
        });
        
        // Ceiling (invisible boundary)
        const ceiling = Matter.Bodies.rectangle(width/2, -thickness/2, width, thickness, {
            isStatic: true,
            render: { visible: false }
        });
        
        // Left wall
        const leftWall = Matter.Bodies.rectangle(-thickness/2, height/2, thickness, height, {
            isStatic: true,
            render: { fillStyle: '#8B4513' }
        });
        
        // Right wall  
        const rightWall = Matter.Bodies.rectangle(width + thickness/2, height/2, thickness, height, {
            isStatic: true,
            render: { fillStyle: '#8B4513' }
        });
        
        this.boundaries = [ground, ceiling, leftWall, rightWall];
        Matter.World.add(this.world, this.boundaries);
        
        // Goals
        this.createGoals();
    }
    
    createGoals() {
        const goalWidth = 20;
        const goalHeight = 150;
        const goalDepth = 50;
        
        // Left goal (Team 2 scores here)
        const leftGoalTop = Matter.Bodies.rectangle(goalDepth/2, this.canvas.height - goalHeight - 20, goalDepth, 20, {
            isStatic: true,
            render: { fillStyle: '#ffffff' },
            label: 'goalPost'
        });
        
        const leftGoalBottom = Matter.Bodies.rectangle(goalDepth/2, this.canvas.height - 20, goalDepth, 20, {
            isStatic: true,
            render: { fillStyle: '#ffffff' },
            label: 'goalPost'
        });
        
        const leftGoalBack = Matter.Bodies.rectangle(5, this.canvas.height - goalHeight/2 - 20, 10, goalHeight, {
            isStatic: true,
            render: { fillStyle: '#ffffff' },
            label: 'goalPost'
        });
        
        // Right goal (Team 1 scores here)
        const rightGoalTop = Matter.Bodies.rectangle(this.canvas.width - goalDepth/2, this.canvas.height - goalHeight - 20, goalDepth, 20, {
            isStatic: true,
            render: { fillStyle: '#ffffff' },
            label: 'goalPost'
        });
        
        const rightGoalBottom = Matter.Bodies.rectangle(this.canvas.width - goalDepth/2, this.canvas.height - 20, goalDepth, 20, {
            isStatic: true,
            render: { fillStyle: '#ffffff' },
            label: 'goalPost'
        });
        
        const rightGoalBack = Matter.Bodies.rectangle(this.canvas.width - 5, this.canvas.height - goalHeight/2 - 20, 10, goalHeight, {
            isStatic: true,
            render: { fillStyle: '#ffffff' },
            label: 'goalPost'
        });
        
        this.goals = [
            { side: 'left', area: { x: 0, y: this.canvas.height - goalHeight - 20, width: goalDepth + 10, height: goalHeight }},
            { side: 'right', area: { x: this.canvas.width - goalDepth - 10, y: this.canvas.height - goalHeight - 20, width: goalDepth + 10, height: goalHeight }}
        ];
        
        Matter.World.add(this.world, [leftGoalTop, leftGoalBottom, leftGoalBack, rightGoalTop, rightGoalBottom, rightGoalBack]);
    }
    
    createPlayers() {
        // Ragdoll player creation
        const playerSize = 25;
        
        // Team 1 (Pastel Pink) - Left side
        this.players[0] = this.createRagdollPlayer(200, 400, '#FFB6C1', 'player1');
        this.players[1] = this.createRagdollPlayer(150, 500, '#FFB6C1', 'player2');
        
        // Team 2 (Pastel Blue) - Right side  
        this.players[2] = this.createRagdollPlayer(800, 400, '#87CEEB', 'player3');
        this.players[3] = this.createRagdollPlayer(850, 500, '#87CEEB', 'player4');
    }
    
    createRagdollPlayer(x, y, color, controlKey) {
        // Create ragdoll with head, body, and limbs
        const head = Matter.Bodies.circle(x, y - 30, 15, {
            density: 0.002,
            frictionAir: 0.05,
            friction: 0.7, // Slightly reduced
            restitution: 0.4, // Slightly increased
            render: { fillStyle: color }
        });
        
        const body = Matter.Bodies.rectangle(x, y, 20, 40, {
            density: 0.003,
            frictionAir: 0.08,
            friction: 0.8, // Slightly reduced
            restitution: 0.3, // Slightly increased
            render: { fillStyle: color }
        });
        
        const leftLeg = Matter.Bodies.rectangle(x - 10, y + 35, 12, 30, {
            density: 0.004,
            frictionAir: 0.1,
            friction: 0.6, // Reduced from 1.2
            restitution: 0.2, // Increased from 0.1
            render: { fillStyle: color }
        });
        
        const rightLeg = Matter.Bodies.rectangle(x + 10, y + 35, 12, 30, {
            density: 0.004,
            frictionAir: 0.1,
            friction: 0.6, // Reduced from 1.2
            restitution: 0.2, // Increased from 0.1
            render: { fillStyle: color }
        });
        
        // Connect body parts with constraints
        const neckConstraint = Matter.Constraint.create({
            bodyA: head,
            bodyB: body,
            length: 20,
            stiffness: 0.8, // Reduced from 0.9
            damping: 0.15   // Increased from 0.1
        });
        
        const leftLegConstraint = Matter.Constraint.create({
            bodyA: body,
            bodyB: leftLeg,
            length: 25,
            stiffness: 0.6, // Reduced from 0.7
            damping: 0.1    // Increased from 0.05
        });
        
        const rightLegConstraint = Matter.Constraint.create({
            bodyA: body,
            bodyB: rightLeg,
            length: 25,
            stiffness: 0.6, // Reduced from 0.7
            damping: 0.1    // Increased from 0.05
        });
        
        const player = {
            head: head,
            body: body,
            leftLeg: leftLeg,
            rightLeg: rightLeg,
            constraints: [neckConstraint, leftLegConstraint, rightLegConstraint],
            controlKey: controlKey,
            color: color,
            team: color === '#FFB6C1' ? 1 : 2,
            kickCooldown: 0,
            jumpCount: 0,
            isGrounded: false // Initialize isGrounded state
        };
        
        // Add labels to player parts for collision detection
        head.label = 'playerPart';
        body.label = 'playerPart';
        leftLeg.label = 'playerPart_leg'; // Specific label for legs/feet
        rightLeg.label = 'playerPart_leg'; // Specific label for legs/feet

        player.parts = [head, body, leftLeg, rightLeg]; // Store parts for easy access

        Matter.World.add(this.world, [head, body, leftLeg, rightLeg, ...player.constraints]);
        
        return player;
    }
    
    createBall() {
        this.ball = Matter.Bodies.circle(this.canvas.width/2, 200, 20, {
            density: 0.002,
            frictionAir: 0.03,
            friction: 0.5,
            restitution: 0.7,
            render: { 
                fillStyle: '#F0F8FF',
                strokeStyle: '#B19CD9',
                lineWidth: 2
            },
            label: 'ball'
        });
        
        Matter.World.add(this.world, this.ball);
    }
    
    generateGrassPattern() {
        // Create pixelated grass pattern
        for (let i = 0; i < 200; i++) {
            this.grassPattern.push({
                x: Math.random() * this.canvas.width,
                y: this.canvas.height - 40 + Math.random() * 20,
                size: Math.random() * 3 + 1,
                shade: Math.random() * 0.3
            });
        }
    }
    
    handlePlayerControls() {
        if (this.gameState !== 'playing') return;
        
        this.players.forEach(player => {
            if (player.kickCooldown > 0) {
                player.kickCooldown--;
            }
            
            // Decrease jump count over time - This is now handled by isGrounded
            // if (player.jumpCount > 0) {
            //     player.jumpCount--;
            // }
            
            if (this.keys[this.playerControls[player.controlKey]] && player.kickCooldown === 0) {
                // Check if player is grounded before allowing jump/kick
                if (player.isGrounded) {
                    player.isGrounded = false; // Player is now in the air
                    player.jumpCount++; // Increment jump count (can be used for multi-jump or other logic)

                    const force = 0.028; // Jump force
                    let horizontalForce = 0;
                    
                    const ballActualDistance = Math.sqrt(
                        Math.pow(this.ball.position.x - player.body.position.x, 2) +
                        Math.pow(this.ball.position.y - player.body.position.y, 2)
                    );
                    const ballDirectionX = this.ball.position.x - player.body.position.x; // Just the X direction for horizontal force

                    let targetHorizontalForce = 0;
                    const maxInfluenceDistance = 350; // Max distance ball has strong influence
                    const minInfluenceDistance = 50; // Min distance, full influence

                    if (ballActualDistance < maxInfluenceDistance) {
                        let influenceFactor = 1.0;
                        if (ballActualDistance > minInfluenceDistance) {
                            influenceFactor = 1.0 - (ballActualDistance - minInfluenceDistance) / (maxInfluenceDistance - minInfluenceDistance);
                        }
                        influenceFactor = Math.max(0, influenceFactor); // Ensure factor is not negative

                        targetHorizontalForce = (ballDirectionX > 0 ? 1 : -1) * 0.015 * influenceFactor; // Max horizontal push towards ball
                    }

                    // Add a very small general horizontal nudge based on team direction.
                    // This helps avoid purely vertical jumps and gives a slight field momentum.
                    let baseNudge = 0;
                    if (player.team === 1) { // Team 1 (Pink, on left side) generally wants to move right
                        baseNudge = 0.003;
                    } else { // Team 2 (Blue, on right side) generally wants to move left
                        baseNudge = -0.003;
                    }
                    
                    horizontalForce = targetHorizontalForce + baseNudge;
                    // Ensure total horizontal force isn't excessive if both target and nudge align
                    const maxHorizontalForce = 0.020;
                    horizontalForce = Math.max(-maxHorizontalForce, Math.min(maxHorizontalForce, horizontalForce));

                    Matter.Body.applyForce(player.body, player.body.position, {
                        x: horizontalForce,
                        y: -force
                    });
                    Matter.Body.applyForce(player.head, player.head.position, {
                        x: horizontalForce * 0.3,
                        y: -force * 0.25 // Adjusted head force ratio
                    });

                    // Leg flair - apply force outwards from body center slightly
                    const legFlairForce = 0.005;
                    if (player.leftLeg.position.x < player.body.position.x) { // Left leg is to the left
                        Matter.Body.applyForce(player.leftLeg, player.leftLeg.position, { x: -legFlairForce, y: -force * 0.05 });
                    } else {
                        Matter.Body.applyForce(player.leftLeg, player.leftLeg.position, { x: legFlairForce, y: -force * 0.05 });
                    }
                    if (player.rightLeg.position.x > player.body.position.x) { // Right leg is to the right
                        Matter.Body.applyForce(player.rightLeg, player.rightLeg.position, { x: legFlairForce, y: -force * 0.05 });
                    } else {
                        Matter.Body.applyForce(player.rightLeg, player.rightLeg.position, { x: -legFlairForce, y: -force * 0.05 });
                    }

                    player.kickCooldown = 20;

                    // Kick ball logic
                    const ballDistance = Math.sqrt(
                        Math.pow(this.ball.position.x - player.body.position.x, 2) +
                        Math.pow(this.ball.position.y - player.body.position.y, 2)
                    );

                    if (ballDistance < 75) { // Increased kick detection radius
                        const kickForceMultiplier = 0.035; // Slightly stronger kick
                        const angle = Math.atan2(
                            this.ball.position.y - player.body.position.y,
                            this.ball.position.x - player.body.position.x
                        );

                        // Apply force to ball
                        Matter.Body.applyForce(this.ball, this.ball.position, {
                            x: Math.cos(angle) * kickForceMultiplier,
                            y: Math.sin(angle) * kickForceMultiplier - 0.015 // More lift on kick
                        });

                        // Small reactive force on player's body from kicking
                        Matter.Body.applyForce(player.body, player.body.position, {
                            x: -Math.cos(angle) * kickForceMultiplier * 0.1,
                            y: -Math.sin(angle) * kickForceMultiplier * 0.1
                        });
                    }
                }
            }
        });
    }
    
    checkGoals() {
        if (this.gameState !== 'playing') return;
        
        const ballX = this.ball.position.x;
        const ballY = this.ball.position.y;
        
        // Check left goal (Team 2 scores)
        if (ballX < this.goals[0].area.width && 
            ballY > this.goals[0].area.y && 
            ballY < this.goals[0].area.y + this.goals[0].area.height) {
            this.score(2);
        }
        
        // Check right goal (Team 1 scores)
        if (ballX > this.goals[1].area.x && 
            ballY > this.goals[1].area.y && 
            ballY < this.goals[1].area.y + this.goals[1].area.height) {
            this.score(1);
        }
    }
    
    score(team) {
        if (team === 1) {
            this.team1Score++;
            document.getElementById('team1Score').textContent = `TEAM 1: ${this.team1Score}`;
        } else {
            this.team2Score++;
            document.getElementById('team2Score').textContent = `TEAM 2: ${this.team2Score}`;
        }
        
        // Reset ball position
        Matter.Body.setPosition(this.ball, { x: this.canvas.width/2, y: 200 });
        Matter.Body.setVelocity(this.ball, { x: 0, y: 0 });
        
        // Reset players
        this.resetPlayerPositions();
        
        // Flash effect
        this.flashScreen();
    }
    
    flashScreen() {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    resetPlayerPositions() {
        // Reset Team 1 (Red)
        Matter.Body.setPosition(this.players[0].body, { x: 200, y: 400 });
        Matter.Body.setPosition(this.players[1].body, { x: 150, y: 500 });
        
        // Reset Team 2 (Blue)
        Matter.Body.setPosition(this.players[2].body, { x: 800, y: 400 });
        Matter.Body.setPosition(this.players[3].body, { x: 850, y: 500 });
        
        // Reset velocities
        this.players.forEach(player => {
            Matter.Body.setVelocity(player.body, { x: 0, y: 0 });
            Matter.Body.setVelocity(player.head, { x: 0, y: 0 });
            Matter.Body.setVelocity(player.leftLeg, { x: 0, y: 0 });
            Matter.Body.setVelocity(player.rightLeg, { x: 0, y: 0 });
        });
    }
    
    updateTimer() {
        if (this.gameState === 'playing') {
            this.gameTime -= 1/60; // Assuming 60 FPS
            
            if (this.gameTime <= 0) {
                this.gameTime = 0;
                this.endGame();
            }
            
            document.getElementById('timer').textContent = `TIME: ${Math.ceil(this.gameTime)}s`;
        }
    }
    
    startGame() {
        this.gameState = 'playing';
        this.gameTime = this.maxTime;
        document.getElementById('startButton').textContent = 'PLAYING...';
        document.getElementById('startButton').disabled = true;
    }
    
    endGame() {
        this.gameState = 'ended';
        
        let winnerText = '';
        if (this.team1Score > this.team2Score) {
            winnerText = 'TEAM 1 (PINK) WINS!';
        } else if (this.team2Score > this.team1Score) {
            winnerText = 'TEAM 2 (SKY BLUE) WINS!';
        } else {
            winnerText = "IT'S A TIE!";
        }
        
        document.getElementById('winnerText').textContent = winnerText;
        document.getElementById('gameOver').style.display = 'flex';
    }
    
    resetGame() {
        this.gameState = 'menu';
        this.gameTime = this.maxTime;
        this.team1Score = 0;
        this.team2Score = 0;
        
        // Update UI
        document.getElementById('team1Score').textContent = 'TEAM 1: 0';
        document.getElementById('team2Score').textContent = 'TEAM 2: 0';
        document.getElementById('timer').textContent = `TIME: ${this.maxTime}s`;
        document.getElementById('startButton').textContent = 'START GAME';
        document.getElementById('startButton').disabled = false;
        
        // Reset ball
        Matter.Body.setPosition(this.ball, { x: this.canvas.width/2, y: 200 });
        Matter.Body.setVelocity(this.ball, { x: 0, y: 0 });
        
        // Reset players
        this.resetPlayerPositions();
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw field background
        this.drawField();
        
        // Draw grass pattern
        this.drawGrass();
        
        // Draw center circle
        this.drawCenterCircle();

        // Draw 3D Goals
        this.drawGoals3D();
        
        // Draw goal areas (these are the lines on the ground)
        this.drawGoalAreas();
        
        // Draw players
        this.players.forEach(player => this.drawPlayer(player));
        
        // Draw ball
        this.drawBall();
        
        // Draw ball trail effect
        this.drawBallTrail();
    }
    
    drawField() {
        // Field background with pastel gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#C7EFCF');
        gradient.addColorStop(0.5, '#B2E6B8');
        gradient.addColorStop(1, '#98E4A3');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Add 3D depth with darker strips
        this.ctx.fillStyle = 'rgba(144, 238, 144, 0.3)';
        for (let i = 0; i < this.canvas.width; i += 50) {
            this.ctx.fillRect(i, 0, 25, this.canvas.height);
        }
        
        // Field lines in soft white
        this.ctx.strokeStyle = '#F5F5F5';
        this.ctx.lineWidth = 4;
        
        // Center line
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width/2, 0);
        this.ctx.lineTo(this.canvas.width/2, this.canvas.height);
        this.ctx.stroke();
        
        // Outer boundary
        this.ctx.strokeRect(15, 15, this.canvas.width - 30, this.canvas.height - 45);
    }
    
    drawGrass() {
        // Draw pixelated grass
        this.grassPattern.forEach(grass => {
            this.ctx.fillStyle = `rgba(0, 100, 0, ${0.3 + grass.shade})`;
            this.ctx.fillRect(grass.x, grass.y, grass.size, grass.size);
        });
    }
    
    drawCenterCircle() {
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(this.canvas.width/2, this.canvas.height/2, 80, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    
    drawGoalAreas() {
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 3;
        
        // Left goal area
        this.ctx.strokeRect(10, this.canvas.height - 170, 100, 140);
        
        // Right goal area
        this.ctx.strokeRect(this.canvas.width - 110, this.canvas.height - 170, 100, 140);
    }
    
    drawPlayer(player) {
        // Draw ragdoll player with 3D pixelated style
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 2;
        
        // Draw simplified player shadow (ellipse at feet)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        const shadowPlayerRadiusX = 25;
        const shadowPlayerRadiusY = 8;
        // Approximate player's "base" position - using the body's y position as a reference
        const baseY = player.body.position.y + 20; // Offset to appear under the player
        this.ctx.beginPath();
        this.ctx.ellipse(
            player.body.position.x,
            baseY,
            shadowPlayerRadiusX,
            shadowPlayerRadiusY,
            0,
            0,
            Math.PI * 2
        );
        this.ctx.fill();
        
        // Main body parts
        this.ctx.fillStyle = player.color;
        
        // Body with 3D highlight
        this.drawPixelated3DRect(player.body.position.x, player.body.position.y, 20, 40, player.body.angle, player.color);
        
        // Head with 3D effect
        this.drawPixelated3DCircle(player.head.position.x, player.head.position.y, 15, player.color);
        
        // Legs with 3D effect
        this.drawPixelated3DRect(player.leftLeg.position.x, player.leftLeg.position.y, 12, 30, player.leftLeg.angle, player.color);
        this.drawPixelated3DRect(player.rightLeg.position.x, player.rightLeg.position.y, 12, 30, player.rightLeg.angle, player.color);
        
        // Eyes for comedy
        this.ctx.fillStyle = '#333';
        const eyeSize = 4;
        this.ctx.fillRect(player.head.position.x - 7, player.head.position.y - 6, eyeSize, eyeSize);
        this.ctx.fillRect(player.head.position.x + 4, player.head.position.y - 6, eyeSize, eyeSize);
        
        // Eye highlights
        this.ctx.fillStyle = '#FFF';
        this.ctx.fillRect(player.head.position.x - 6, player.head.position.y - 5, 2, 2);
        this.ctx.fillRect(player.head.position.x + 5, player.head.position.y - 5, 2, 2);
    }
    
    drawBall() {
        const ball = this.ball;
        
        // Ball shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.beginPath();
        const shadowYOffset = ball.render.sprite && ball.render.sprite.yOffset ? ball.render.sprite.yOffset / 2 : 10; // Adjust based on sprite if available, else default
        const shadowRadiusX = (ball.circleRadius || 20) * 1.0; // Use ball.circleRadius if available
        const shadowRadiusY = (ball.circleRadius || 20) * 0.4;
        this.ctx.ellipse(
            ball.position.x,
            ball.position.y + (ball.circleRadius || 20) * 0.5 + shadowYOffset / 3, // Position shadow under the ball
            shadowRadiusX,
            shadowRadiusY,
            0,
            0,
            Math.PI * 2
        );
        this.ctx.fill();
        
        // Main ball with 3D effect
        this.drawPixelated3DCircle(ball.position.x, ball.position.y, 20, '#F0F8FF');
        
        // Ball pattern with pastel colors
        this.ctx.strokeStyle = '#D8BFD8';
        this.ctx.lineWidth = 3;
        
        // Curved lines for soccer ball pattern
        this.ctx.beginPath();
        this.ctx.arc(ball.position.x, ball.position.y, 15, 0, Math.PI);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(ball.position.x, ball.position.y, 15, Math.PI/3, Math.PI * 4/3);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(ball.position.x, ball.position.y, 15, Math.PI * 2/3, Math.PI * 5/3);
        this.ctx.stroke();
        
        // Center dot
        this.ctx.fillStyle = '#DDA0DD';
        this.ctx.fillRect(ball.position.x - 2, ball.position.y - 2, 4, 4);
    }
    
    drawBallTrail() {
        // Simple trail effect
        if (this.ball.velocity.x * this.ball.velocity.x + this.ball.velocity.y * this.ball.velocity.y > 1) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            for (let i = 1; i <= 3; i++) {
                const trailX = this.ball.position.x - (this.ball.velocity.x * i * 2);
                const trailY = this.ball.position.y - (this.ball.velocity.y * i * 2);
                this.ctx.beginPath();
                this.ctx.arc(trailX, trailY, 20 - i * 5, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    drawGoals3D() {
        const goalPostColor = '#E0E0E0'; // Light grey posts
        const goalPostThickness = 8;
        const netColor = 'rgba(200, 200, 200, 0.4)';

        const canvasHeight = this.canvas.height;
        const groundLevelY = canvasHeight - 20; // From ground body thickness
        const goalVisualHeight = 150; // From createGoals
        const goalMouthWidth = 50; // From createGoals goalDepth, which is used as width for top/bottom bars

        // Left Goal (Team 2 scores)
        const leftGoalPost1X = 0;
        const leftGoalPost2X = goalMouthWidth;
        const goalTopY = groundLevelY - goalVisualHeight;

        this.ctx.fillStyle = goalPostColor;
        // Post 1 (leftmost)
        this.ctx.fillRect(leftGoalPost1X, goalTopY, goalPostThickness, goalVisualHeight);
        // Post 2 (rightmost of the opening)
        this.ctx.fillRect(leftGoalPost2X - goalPostThickness, goalTopY, goalPostThickness, goalVisualHeight);
        // Crossbar
        this.ctx.fillRect(leftGoalPost1X, goalTopY, leftGoalPost2X - leftGoalPost1X, goalPostThickness);

        // Net (simple back and side representation)
        this.ctx.fillStyle = netColor;
        this.ctx.beginPath();
        this.ctx.moveTo(leftGoalPost1X + goalPostThickness / 2, goalTopY + goalPostThickness / 2);
        this.ctx.lineTo(leftGoalPost1X + goalPostThickness / 2, groundLevelY);
        this.ctx.lineTo(0, groundLevelY);
        this.ctx.lineTo(0, groundLevelY - goalVisualHeight / 1.5);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.moveTo(leftGoalPost2X - goalPostThickness / 2, goalTopY + goalPostThickness / 2);
        this.ctx.lineTo(leftGoalPost2X - goalPostThickness / 2, groundLevelY);
        this.ctx.lineTo(0, groundLevelY);
        this.ctx.closePath();
        this.ctx.fill();

        // Right Goal (Team 1 scores)
        const rightGoalPost1X = this.canvas.width - goalMouthWidth;
        const rightGoalPost2X = this.canvas.width;

        this.ctx.fillStyle = goalPostColor;
        // Post 1 (leftmost of the opening)
        this.ctx.fillRect(rightGoalPost1X, goalTopY, goalPostThickness, goalVisualHeight);
        // Post 2 (rightmost)
        this.ctx.fillRect(rightGoalPost2X - goalPostThickness, goalTopY, goalPostThickness, goalVisualHeight);
        // Crossbar
        this.ctx.fillRect(rightGoalPost1X, goalTopY, rightGoalPost2X - rightGoalPost1X, goalPostThickness);

        // Net
        this.ctx.fillStyle = netColor;
        this.ctx.beginPath();
        this.ctx.moveTo(rightGoalPost1X + goalPostThickness / 2, goalTopY + goalPostThickness / 2);
        this.ctx.lineTo(rightGoalPost1X + goalPostThickness / 2, groundLevelY);
        this.ctx.lineTo(this.canvas.width, groundLevelY);
        this.ctx.lineTo(this.canvas.width, groundLevelY - goalVisualHeight / 1.5);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.moveTo(rightGoalPost2X - goalPostThickness / 2, goalTopY + goalPostThickness / 2);
        this.ctx.lineTo(rightGoalPost2X - goalPostThickness / 2, groundLevelY);
        this.ctx.lineTo(this.canvas.width, groundLevelY);
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    drawPixelatedRect(x, y, width, height, angle = 0) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);
        this.ctx.fillRect(-width/2, -height/2, width, height);
        this.ctx.strokeRect(-width/2, -height/2, width, height);
        this.ctx.restore();
    }
    
    drawPixelatedCircle(x, y, radius) {
        // Pixelated circle using small rectangles
        const pixels = 8;
        const angleStep = (Math.PI * 2) / pixels;
        
        for (let i = 0; i < pixels; i++) {
            const angle = i * angleStep;
            const pixelX = x + Math.cos(angle) * radius;
            const pixelY = y + Math.sin(angle) * radius;
            
            this.ctx.fillRect(pixelX - 2, pixelY - 2, 4, 4);
        }
        
        // Fill center
        this.ctx.fillRect(x - radius/2, y - radius/2, radius, radius);
        this.ctx.strokeRect(x - radius/2, y - radius/2, radius, radius);
    }
    
    drawPixelated3DRect(x, y, width, height, angle = 0, color) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);
        
        // Main color
        this.ctx.fillStyle = color;
        this.ctx.fillRect(-width/2, -height/2, width, height);
        
        // Highlight (lighter top and left)
        // const r = parseInt(color.substr(1,2), 16);
        // const g = parseInt(color.substr(3,2), 16);
        // const b = parseInt(color.substr(5,2), 16);
        // const highlight = `rgb(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 30)})`;
        
        // this.ctx.fillStyle = highlight;
        // this.ctx.fillRect(-width/2, -height/2, width, 4); // Top highlight
        // this.ctx.fillRect(-width/2, -height/2, 4, height); // Left highlight
        
        // Shadow (darker bottom and right)
        // const shadow = `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`;
        // this.ctx.fillStyle = shadow;
        // this.ctx.fillRect(-width/2, height/2 - 4, width, 4); // Bottom shadow
        // this.ctx.fillRect(width/2 - 4, -height/2, 4, height); // Right shadow
        
        this.ctx.strokeRect(-width/2, -height/2, width, height);
        this.ctx.restore();
    }
    
    drawPixelated3DCircle(x, y, radius, color) {
        // Main circle
        this.ctx.fillStyle = color;
        this.drawPixelatedCircle(x, y, radius);
        
        // 3D highlight
        // const r = parseInt(color.substr(1,2), 16);
        // const g = parseInt(color.substr(3,2), 16);
        // const b = parseInt(color.substr(5,2), 16);
        // const highlight = `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)})`;
        
        // this.ctx.fillStyle = highlight;
        // this.ctx.fillRect(x - radius/3, y - radius/3, radius/2, radius/3);
        
        // 3D shadow
        // const shadow = `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`;
        // this.ctx.fillStyle = shadow;
        // this.ctx.fillRect(x + radius/4, y + radius/4, radius/3, radius/3);
    }
    
    gameLoop() {
        // Update physics
        Matter.Engine.update(this.engine);
        
        // Handle input
        this.handlePlayerControls();
        
        // Check goals
        this.checkGoals();
        
        // Update timer
        this.updateTimer();
        
        // Render
        this.render();
        
        // Continue loop
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    const game = new SoccerPhysicsGame();
});