function drawSimplifiedSun(targetCtx, sunWorldX, sunWorldY, sunWorldRadius, PIXELATION_SCALE_FACTOR) {
    const scale = PIXELATION_SCALE_FACTOR;
    const sunX = sunWorldX * scale;
    const sunY = sunWorldY * scale;
    const sunRadius = sunWorldRadius * scale;

    targetCtx.fillStyle = 'yellow';
    targetCtx.beginPath();
    targetCtx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    targetCtx.fill();
}

function drawSimplifiedCloud(targetCtx, x, y, width, height, PIXELATION_SCALE_FACTOR) {
    const scale = PIXELATION_SCALE_FACTOR;
    const cloudX = x * scale;
    const cloudY = y * scale;
    const cloudWidth = width * scale;
    const cloudHeight = height * scale;

    targetCtx.fillStyle = 'white';
    targetCtx.fillRect(cloudX, cloudY, cloudWidth, cloudHeight);
}

function drawSimplifiedNet(targetCtx, x, y, width, height, PIXELATION_SCALE_FACTOR) {
    const scale = PIXELATION_SCALE_FACTOR;
    const netX = x * scale;
    const netY = y * scale;
    const netWidth = width * scale;
    const netHeight = height * scale;

    targetCtx.strokeStyle = 'white';
    targetCtx.lineWidth = 1;
    targetCtx.beginPath();
    for (let i = 0; i < netWidth; i += 5) {
        targetCtx.moveTo(netX + i, netY);
        targetCtx.lineTo(netX + i, netY + netHeight);
    }
    for (let i = 0; i < netHeight; i += 5) {
        targetCtx.moveTo(netX, netY + i);
        targetCtx.lineTo(netX + netWidth, netY + i);
    }
    targetCtx.stroke();
}

function drawSimplifiedSoccerBall(targetCtx, body, PIXELATION_SCALE_FACTOR) {
    const scale = PIXELATION_SCALE_FACTOR;
    const ballX = body.position.x * scale;
    const ballY = body.position.y * scale;
    const ballRadius = body.circleRadius * scale;

    targetCtx.fillStyle = 'white';
    targetCtx.beginPath();
    targetCtx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.fillStyle = 'black';
    for (let i = 0; i < 6; i++) {
        const angle = body.angle + (i * Math.PI / 3);
        const x = ballX + Math.cos(angle) * ballRadius * 0.5;
        const y = ballY + Math.sin(angle) * ballRadius * 0.5;
        targetCtx.beginPath();
        targetCtx.arc(x, y, ballRadius * 0.2, 0, Math.PI * 2);
        targetCtx.fill();
    }
}

// No exports needed, functions will be globally available
