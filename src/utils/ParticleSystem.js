export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.weatherParticles = [];
    }

    createImpactParticles(x, y, count = 5, color = '#A0522D') {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI - Math.PI;
            const speed = Math.random() * 2 + 1;
            
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed * 0.5,
                life: Math.random() * 30 + 30,
                size: Math.random() * 2 + 1,
                color
            });
        }
    }

    createWeatherParticle(weather, canvasWidth) {
        const effect = weather;
        if (effect.particles === 0) return;
        
        const x = Math.random() * canvasWidth;
        const y = -10;
        const vx = (Math.random() - 0.5) * effect.windForce;
        const vy = Math.random() * 2 + 1;
        
        this.weatherParticles.push({
            x, y, vx, vy,
            type: weather.name,
            life: Math.random() * 100 + 50,
            size: weather.name === 'برف' ? Math.random() * 3 + 2 : Math.random() * 2 + 1
        });
    }

    updateParticles() {
        // Update impact particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            p.life--;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update weather particles
        for (let i = this.weatherParticles.length - 1; i >= 0; i--) {
            const p = this.weatherParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            
            if (p.life <= 0 || p.y > 600) {
                this.weatherParticles.splice(i, 1);
            }
        }
    }

    drawParticles(ctx, pixelationScale) {
        // Draw impact particles
        this.particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.fillRect(
                p.x * pixelationScale - (p.size * pixelationScale / 2),
                p.y * pixelationScale - (p.size * pixelationScale / 2),
                p.size * pixelationScale,
                p.size * pixelationScale
            );
        });

        // Draw weather particles
        this.weatherParticles.forEach(p => {
            ctx.fillStyle = p.type === 'برف' ? '#FFFFFF' : '#87CEEB';
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.arc(
                p.x * pixelationScale, 
                p.y * pixelationScale, 
                p.size * pixelationScale, 
                0, Math.PI * 2
            );
            ctx.fill();
            ctx.globalAlpha = 1;
        });
    }

    clear() {
        this.particles = [];
        this.weatherParticles = [];
    }
}