const PIXELATION_SCALE_FACTOR = 0.25;
let lowResCanvas;
let lowResCtx;
let staticBackgroundCanvas;
let staticBackgroundCtx;
let isShaking = false;
let shakeMagnitude = 0;
let shakeDuration = 0;
let shakeTimer = 0;
let shakeOffsetX = 0;
let shakeOffsetY = 0;

const particlePool = [];
const MAX_PARTICLES = 100;

import { drawSimplifiedSun, drawSimplifiedCloud, drawSimplifiedNet, drawSimplifiedSoccerBall } from './rendererHelpers.js';

export function initRenderer(canvas) {
    const lowResCanvas = document.createElement('canvas');
    lowResCanvas.width = canvas.width * PIXELATION_SCALE_FACTOR;
    lowResCanvas.height = canvas.height * PIXELATION_SCALE_FACTOR;
    const lowResCtx = lowResCanvas.getContext('2d');
    lowResCtx.imageSmoothingEnabled = false;

    const staticBackgroundCanvas = document.createElement('canvas');
    staticBackgroundCanvas.width = lowResCanvas.width;
    staticBackgroundCanvas.height = lowResCanvas.height;
    const staticBackgroundCtx = staticBackgroundCanvas.getContext('2d');

    for (let i = 0; i < MAX_PARTICLES; i++) {
        particlePool.push({
            active: false,
            x: 0, y: 0,
            vx: 0, vy: 0,
            life: 0,
            size: 0,
            color: '#000000'
        });
    }

    drawStaticBackground(staticBackgroundCtx, staticBackgroundCanvas.width, staticBackgroundCanvas.height);

    return { lowResCanvas, lowResCtx, staticBackgroundCanvas, staticBackgroundCtx };
}

function drawStaticBackground(ctx, width, height) {
    const grassStartY_scaled = (580 - 40) * PIXELATION_SCALE_FACTOR;
    const grassHeight_scaled = (600 - (580 - 40) + 2) * PIXELATION_SCALE_FACTOR;
    const STRIPE_WIDTH_WORLD = 50;
    const stripeWidth_scaled = STRIPE_WIDTH_WORLD * PIXELATION_SCALE_FACTOR;
    const GRASS_COLOR_DARK = "#228B22";
    const GRASS_COLOR_LIGHT = "#32CD32";

    for (let x_stripe = 0; x_stripe < width; x_stripe += stripeWidth_scaled) {
        const currentStripeWidth = Math.min(stripeWidth_scaled, width - x_stripe);
        ctx.fillStyle = (Math.floor(x_stripe / stripeWidth_scaled) % 2 === 0) ? GRASS_COLOR_DARK : GRASS_COLOR_LIGHT;
        ctx.fillRect(x_stripe, grassStartY_scaled, currentStripeWidth, grassHeight_scaled);
    }
    drawFootballFieldLines(ctx);
}

function drawFootballFieldLines(targetCtx) {
    const scale = PIXELATION_SCALE_FACTOR;
    const CANVAS_WIDTH = 800;
    const CANVAS_HEIGHT = 600;
    const FIELD_SURFACE_Y = 580 - 40;

    targetCtx.save();
    targetCtx.strokeStyle = '#FFFFFF';
    targetCtx.lineWidth = Math.max(2, Math.floor(4 * scale));

    targetCtx.beginPath();
    targetCtx.moveTo(CANVAS_WIDTH / 2 * scale, FIELD_SURFACE_Y * scale);
    targetCtx.lineTo(CANVAS_WIDTH / 2 * scale, CANVAS_HEIGHT * scale);
    targetCtx.stroke();

    const centerCircleRadius = 30 * scale;
    const circleCenterY_scaled = (FIELD_SURFACE_Y * scale + CANVAS_HEIGHT * scale) / 2;
    const circleCenterX_scaled = CANVAS_WIDTH / 2 * scale;
    targetCtx.beginPath();
    targetCtx.arc(circleCenterX_scaled, circleCenterY_scaled, centerCircleRadius, 0, 2 * Math.PI);
    targetCtx.stroke();

    const penaltyAreaDepth_world = 30;
    const penaltyAreaLength_world = 120;
    const goalBoxDepth_world = 15;
    const goalBoxLength_world = 60;

    const penaltyBoxScaledY = FIELD_SURFACE_Y * scale;
    const penaltyAreaDepthScaled = penaltyAreaDepth_world * scale;
    const penaltyAreaLengthScaled = penaltyAreaLength_world * scale;
    targetCtx.strokeRect(0, penaltyBoxScaledY, penaltyAreaLengthScaled, penaltyAreaDepthScaled);
    targetCtx.strokeRect((CANVAS_WIDTH * scale) - penaltyAreaLengthScaled, penaltyBoxScaledY, penaltyAreaLengthScaled, penaltyAreaDepthScaled);

    const goalBoxScaledY = FIELD_SURFACE_Y * scale;
    const goalBoxDepthScaled = goalBoxDepth_world * scale;
    const goalBoxLengthScaled = goalBoxLength_world * scale;
    targetCtx.strokeRect(0, goalBoxScaledY, goalBoxLengthScaled, goalBoxDepthScaled);
    targetCtx.strokeRect((CANVAS_WIDTH * scale) - goalBoxLengthScaled, goalBoxScaledY, goalBoxLengthScaled, goalBoxDepthScaled);

    const penaltySpotY = (FIELD_SURFACE_Y + (CANVAS_HEIGHT - FIELD_SURFACE_Y) / 2);
    const penaltySpotRadius = 5 * scale;
    targetCtx.fillStyle = '#FFFFFF';
    targetCtx.beginPath();
    targetCtx.arc(80 * scale, penaltySpotY * scale, penaltySpotRadius, 0, 2 * Math.PI);
    targetCtx.fill();
    targetCtx.beginPath();
    targetCtx.arc((CANVAS_WIDTH - 80) * scale, penaltySpotY * scale, penaltySpotRadius, 0, 2 * Math.PI);
    targetCtx.fill();

    const cornerArcRadius = 12 * scale;
    targetCtx.beginPath();
    targetCtx.arc(0, FIELD_SURFACE_Y * scale, cornerArcRadius, 0, 0.5 * Math.PI);
    targetCtx.stroke();
    targetCtx.beginPath();
    targetCtx.arc(0, CANVAS_HEIGHT * scale, cornerArcRadius, 1.5 * Math.PI, 2 * Math.PI);
    targetCtx.stroke();
    targetCtx.beginPath();
    targetCtx.arc(CANVAS_WIDTH * scale, FIELD_SURFACE_Y * scale, cornerArcRadius, 0.5 * Math.PI, Math.PI);
    targetCtx.stroke();
    targetCtx.beginPath();
    targetCtx.arc(CANVAS_WIDTH * scale, CANVAS_HEIGHT * scale, cornerArcRadius, Math.PI, 1.5 * Math.PI);
    targetCtx.stroke();

    targetCtx.restore();
}

let cloudPositions = [
    { x: 150, y: 120, width: 80, height: 30, speed: 0.3 },
    { x: 400, y: 80, width: 100, height: 40, speed: 0.2 },
    { x: 650, y: 150, width: 70, height: 25, speed: 0.4 }
];

function drawDynamicSky(targetCtx, gameTimeRemaining, ROUND_DURATION_SECONDS) {
    const CANVAS_WIDTH = 800;
    const gameProgress = (ROUND_DURATION_SECONDS - gameTimeRemaining) / ROUND_DURATION_SECONDS;
    let sunWorldX = 50 + gameProgress * (CANVAS_WIDTH - 100);
    let sunWorldY = 80 + Math.sin(gameProgress * Math.PI) * 40;
    let sunWorldRadius = 25;

    drawSimplifiedSun(targetCtx, sunWorldX, sunWorldY, sunWorldRadius, PIXELATION_SCALE_FACTOR);

    cloudPositions.forEach(cloud => {
        cloud.x += cloud.speed;
        if (cloud.x > CANVAS_WIDTH + cloud.width) {
            cloud.x = -cloud.width;
            cloud.y = 50 + Math.random() * 100;
        }
        drawSimplifiedCloud(targetCtx, cloud.x, cloud.y, cloud.width, cloud.height, PIXELATION_SCALE_FACTOR);
    });
}

export function createImpactParticles(x, y, count = 5, color = '#A0522D') {
    let particlesCreated = 0;
    for (let i = 0; i < particlePool.length; i++) {
        if (particlesCreated >= count) break;
        let p = particlePool[i];
        if (!p.active) {
            p.active = true;
            p.x = x;
            p.y = y;
            const angle = Math.random() * Math.PI - Math.PI;
            const speed = Math.random() * 2 + 1;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed * 0.5;
            p.life = Math.random() * 30 + 30;
            p.size = Math.random() * 2 + 1;
            p.color = color;
            particlesCreated++;
        }
    }
}

function updateAndDrawParticles(targetCtx) {
    for (let i = 0; i < particlePool.length; i++) {
        let p = particlePool[i];
        if (p.active) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            p.life--;

            if (p.life <= 0) {
                p.active = false;
            } else {
                targetCtx.fillStyle = p.color;
                targetCtx.fillRect(
                    p.x * PIXELATION_SCALE_FACTOR - (p.size * PIXELATION_SCALE_FACTOR / 2),
                    p.y * PIXELATION_SCALE_FACTOR - (p.size * PIXELATION_SCALE_FACTOR / 2),
                    p.size * PIXELATION_SCALE_FACTOR,
                    p.size * PIXELATION_SCALE_FACTOR
                );
            }
        }
    }
}

export function triggerScreenShake(magnitude, duration) {
    isShaking = true;
    shakeMagnitude = magnitude * PIXELATION_SCALE_FACTOR;
    shakeDuration = duration;
    shakeTimer = duration;
}

export function draw(mainCtx, world, players, gameTimeRemaining, ROUND_DURATION_SECONDS, lowResCanvas, lowResCtx, staticBackgroundCanvas, staticBackgroundCtx) {
    console.log('Inside draw function, world:', world, 'players:', players);
    const CANVAS_WIDTH = 800;
    const FIELD_SURFACE_Y = 580 - 40;
    const GOAL_HEIGHT = 120;
    const GOAL_WIDTH = 30;
    const GROUND_Y = (580 - 40) + (40 * 2) / 2;
    const GROUND_THICKNESS = 40 * 2;

    if (isShaking) {
        shakeOffsetX = (Math.random() - 0.5) * shakeMagnitude * 2;
        shakeOffsetY = (Math.random() - 0.5) * shakeMagnitude * 2;
        shakeTimer--;
        if (shakeTimer <= 0) {
            isShaking = false;
            shakeOffsetX = 0;
            shakeOffsetY = 0;
        }
    } else {
        shakeOffsetX = 0;
        shakeOffsetY = 0;
    }

    lowResCtx.save();
    lowResCtx.translate(shakeOffsetX, shakeOffsetY);

    lowResCtx.clearRect(0, 0, lowResCanvas.width, lowResCanvas.height);
    lowResCtx.fillStyle = "#87CEEB";
    lowResCtx.fillRect(0, 0, lowResCanvas.width, lowResCanvas.height);
    drawDynamicSky(lowResCtx, gameTimeRemaining, ROUND_DURATION_SECONDS);

    lowResCtx.drawImage(staticBackgroundCanvas, 0, 0);

    drawSimplifiedNet(lowResCtx, 0, (FIELD_SURFACE_Y - GOAL_HEIGHT), GOAL_WIDTH, GOAL_HEIGHT, PIXELATION_SCALE_FACTOR);
    drawSimplifiedNet(lowResCtx, (CANVAS_WIDTH - GOAL_WIDTH), (FIELD_SURFACE_Y - GOAL_HEIGHT), GOAL_WIDTH, GOAL_HEIGHT, PIXELATION_SCALE_FACTOR);

    const allBodies = window.Matter.Composite.allBodies(world);
    allBodies.forEach(body => {
        if (body.render && body.render.visible === false) return;

        lowResCtx.beginPath();
        const vertices = body.vertices;
        lowResCtx.moveTo(vertices[0].x * PIXELATION_SCALE_FACTOR, vertices[0].y * PIXELATION_SCALE_FACTOR);
        for (let j = 1; j < vertices.length; j++) {
            lowResCtx.lineTo(vertices[j].x * PIXELATION_SCALE_FACTOR, vertices[j].y * PIXELATION_SCALE_FACTOR);
        }
        lowResCtx.closePath();

        if (body.label.startsWith('player')) {
            const player = players.find(p => p.body === body);
            lowResCtx.fillStyle = player.color;
            lowResCtx.fill();
        } else if (body.label === 'ball') {
            drawSimplifiedSoccerBall(lowResCtx, body, PIXELATION_SCALE_FACTOR);
        } else if (body.isStatic) {
            lowResCtx.fillStyle = (body.render && body.render.fillStyle) ? body.render.fillStyle : '#CCC';
            if (!(body.label === 'Rectangle Body' && body.position.y > (GROUND_Y - GROUND_THICKNESS) && body.area >= (CANVAS_WIDTH * GROUND_THICKNESS * 0.8))) {
                lowResCtx.fill();
            }
        }

        if (!body.isSensor && body.label !== 'ball') {
            lowResCtx.lineWidth = Math.max(1, Math.floor(2 * PIXELATION_SCALE_FACTOR));
            lowResCtx.strokeStyle = '#000000';
            lowResCtx.stroke();
        }
    });

    updateAndDrawParticles(lowResCtx);

    lowResCtx.restore();

    mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);
    mainCtx.imageSmoothingEnabled = false;
    mainCtx.drawImage(
        lowResCanvas,
        0, 0, lowResCanvas.width, lowResCanvas.height,
        0, 0, mainCtx.canvas.width, mainCtx.canvas.height
    );
}

// No exports needed, functions will be globally available
