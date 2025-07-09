import { 
    CANVAS_WIDTH, CANVAS_HEIGHT, GROUND_Y, GROUND_THICKNESS, 
    WALL_THICKNESS, GOAL_HEIGHT, GOAL_WIDTH, GOAL_POST_WIDTH,
    COLORS 
} from '../config/constants.js';

export class Field {
    constructor(world) {
        this.world = world;
        this.bodies = [];
        this.goals = {};
        this.createField();
    }

    createField() {
        // Ground
        const ground = Bodies.rectangle(CANVAS_WIDTH / 2, GROUND_Y, CANVAS_WIDTH, GROUND_THICKNESS, {
            isStatic: true,
            render: { fillStyle: COLORS.GRASS_DARK },
            label: 'ground'
        });

        // Walls
        const leftWall = Bodies.rectangle(-WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { 
            isStatic: true, 
            render: { fillStyle: COLORS.GRAY } 
        });
        
        const rightWall = Bodies.rectangle(CANVAS_WIDTH + WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { 
            isStatic: true, 
            render: { fillStyle: COLORS.GRAY } 
        });
        
        const ceiling = Bodies.rectangle(CANVAS_WIDTH / 2, -WALL_THICKNESS / 2, CANVAS_WIDTH, WALL_THICKNESS, { 
            isStatic: true, 
            render: { fillStyle: COLORS.GRAY } 
        });

        // Goal posts
        const goal1Post = Bodies.rectangle(GOAL_POST_WIDTH / 2, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, GOAL_POST_WIDTH, GOAL_HEIGHT, {
            isStatic: true, 
            render: { fillStyle: COLORS.WHITE }, 
            label: "goalPost1"
        });

        const goal2Post = Bodies.rectangle(CANVAS_WIDTH - GOAL_POST_WIDTH / 2, GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2, GOAL_POST_WIDTH, GOAL_HEIGHT, {
            isStatic: true, 
            render: { fillStyle: COLORS.WHITE }, 
            label: "goalPost2"
        });

        // Goal areas (for detection)
        const goal1Area = {
            x: GOAL_WIDTH / 2,
            y: GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2,
            width: GOAL_WIDTH,
            height: GOAL_HEIGHT,
            team: 2
        };

        const goal2Area = {
            x: CANVAS_WIDTH - GOAL_WIDTH / 2,
            y: GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT / 2,
            width: GOAL_WIDTH,
            height: GOAL_HEIGHT,
            team: 1
        };

        this.goals = { team1: goal2Area, team2: goal1Area };

        // Add all bodies to world
        this.bodies = [ground, leftWall, rightWall, ceiling, goal1Post, goal2Post];
        World.add(this.world, this.bodies);
    }

    checkGoal(ball) {
        if (!ball) return null;

        const ballPos = ball.getPosition();
        const ballRadius = 15; // BALL_RADIUS

        // Check goal 1 (left side - team 2 scores)
        const goal1 = this.goals.team2;
        if (ballPos.x - ballRadius < goal1.x + goal1.width / 2 &&
            ballPos.x + ballRadius > goal1.x - goal1.width / 2 &&
            ballPos.y - ballRadius < goal1.y + goal1.height / 2 &&
            ballPos.y + ballRadius > goal1.y - goal1.height / 2) {
            return 2; // Team 2 scores
        }

        // Check goal 2 (right side - team 1 scores)
        const goal2 = this.goals.team1;
        if (ballPos.x - ballRadius < goal2.x + goal2.width / 2 &&
            ballPos.x + ballRadius > goal2.x - goal2.width / 2 &&
            ballPos.y - ballRadius < goal2.y + goal2.height / 2 &&
            ballPos.y + ballRadius > goal2.y - goal2.height / 2) {
            return 1; // Team 1 scores
        }

        return null;
    }

    drawNets(ctx, pixelationScale) {
        // Left goal net
        this.drawNet(ctx, 
            0, 
            (GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT) * pixelationScale,
            GOAL_WIDTH * pixelationScale, 
            GOAL_HEIGHT * pixelationScale
        );

        // Right goal net
        this.drawNet(ctx,
            (CANVAS_WIDTH - GOAL_WIDTH) * pixelationScale,
            (GROUND_Y - GROUND_THICKNESS / 2 - GOAL_HEIGHT) * pixelationScale,
            GOAL_WIDTH * pixelationScale, 
            GOAL_HEIGHT * pixelationScale
        );
    }

    drawNet(ctx, x, y, width, height) {
        ctx.strokeStyle = 'rgba(220, 220, 220, 0.7)';
        ctx.lineWidth = Math.max(1, Math.floor(2 * 0.25)); // PIXELATION_SCALE_FACTOR
        const spacing = Math.max(2, Math.floor(15 * 0.25));

        // Vertical lines
        for (let i = 0; i <= width; i += spacing) {
            ctx.beginPath();
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i, y + height);
            ctx.stroke();
        }

        // Horizontal lines
        for (let j = 0; j <= height; j += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, y + j);
            ctx.lineTo(x + width, y + j);
            ctx.stroke();
        }
    }

    drawGrass(ctx, pixelationScale) {
        const grassStartY = (GROUND_Y - GROUND_THICKNESS / 2) * pixelationScale;
        const grassHeight = (CANVAS_HEIGHT - (GROUND_Y - GROUND_THICKNESS / 2)) * pixelationScale;
        const stripeWidth = 50 * pixelationScale;

        for (let x = 0; x < CANVAS_WIDTH * pixelationScale; x += stripeWidth) {
            const currentStripeWidth = Math.min(stripeWidth, CANVAS_WIDTH * pixelationScale - x);
            ctx.fillStyle = (Math.floor(x / stripeWidth) % 2 === 0) ? COLORS.GRASS_DARK : COLORS.GRASS_LIGHT;
            ctx.fillRect(x, grassStartY, currentStripeWidth, grassHeight);
        }
    }

    getGoalAreas() {
        return this.goals;
    }
}