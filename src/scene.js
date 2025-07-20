import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { PixelShader } from './shaders/PixelShader.js';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export class SceneManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.composer = new EffectComposer(this.renderer);

        this.gameContainer = document.getElementById('game-container');
        this.gameContainer.appendChild(this.renderer.domElement);

        this.init();
    }

    init() {
        this.renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);

        // Set camera position to look at the 2D plane
        this.camera.position.z = 500;
        this.camera.lookAt(0, 0, 0);

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 200);
        this.scene.add(directionalLight);

        // Background color
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue

        // Post-processing for pixel effect
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        const pixelPass = new ShaderPass(PixelShader);
        pixelPass.uniforms['resolution'].value = new THREE.Vector2(CANVAS_WIDTH, CANVAS_HEIGHT);
        pixelPass.uniforms['pixelSize'].value = 8.0; // Adjust for desired pixelation
        this.composer.addPass(pixelPass);
    }

    getScene() {
        return this.scene;
    }

    getCamera() {
        return this.camera;
    }

    getRenderer() {
        return this.renderer;
    }

    startRenderLoop(updateCallback) {
        const animate = () => {
            requestAnimationFrame(animate);

            if (updateCallback) {
                updateCallback();
            }

            this.composer.render();
        };
        animate();
    }
}
