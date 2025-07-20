import * as CANNON from 'cannon';

export class PhysicsManager {
    constructor() {
        this.world = new CANNON.World();
        this.init();
    }

    init() {
        // Set gravity similar to the original game
        this.world.gravity.set(0, -9.82 * 2, 0); // Cannon.js uses meters/s^2, original was abstract. This value may need tuning. Let's start with a scaled gravity.
        this.world.broadphase = new CANNON.NaiveBroadphase();

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

    update(timeStep = 1 / 60) {
        this.world.step(timeStep);
    }
}
