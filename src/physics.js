import * as CANNON from 'cannon-es';

export class PhysicsManager {
    constructor() {
        this.world = new CANNON.World();
        this.lastTime = null;
        this.init();
    }

    init() {
        // A more realistic gravity for a small-scale world.
        this.world.gravity.set(0, -982, 0); // Approx 100x Earth gravity for a fast-paced feel
        this.world.broadphase = new CANNON.NaiveBroadphase();

        // Default contact material properties
        this.world.defaultContactMaterial.friction = 0.1;
        this.world.defaultContactMaterial.restitution = 0.2;

        // Improve solver accuracy
        this.world.solver.iterations = 10;
        this.world.solver.tolerance = 0.1;

        this.createContactMaterials();
    }

    createContactMaterials() {
        // Define materials
        const groundMaterial = new CANNON.Material('ground');
        const playerMaterial = new CANNON.Material('player');
        const ballMaterial = new CANNON.Material('ball');

        // Define contact properties
        const ground_player_cm = new CANNON.ContactMaterial(groundMaterial, playerMaterial, {
            friction: 0.3,
            restitution: 0.1,
        });

        const player_ball_cm = new CANNON.ContactMaterial(playerMaterial, ballMaterial, {
            friction: 0.1,
            restitution: 0.5,
        });

        const ground_ball_cm = new CANNON.ContactMaterial(groundMaterial, ballMaterial, {
            friction: 0.5,
            restitution: 0.7,
        });

        this.world.addContactMaterial(ground_player_cm);
        this.world.addContactMaterial(player_ball_cm);
        this.world.addContactMaterial(ground_ball_cm);

        // Store materials for later use
        this.materials = { groundMaterial, playerMaterial, ballMaterial };
    }

    getWorld() {
        return this.world;
    }

    update() {
        // Use a fixed time step for stability
        this.world.step(1 / 60, this.lastTime ? (Date.now() - this.lastTime) / 1000 : 0, 3);
        this.lastTime = Date.now();
    }
}
