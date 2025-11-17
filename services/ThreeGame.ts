


import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// =================================================================================================
// --- GAME CONSTANTS ------------------------------------------------------------------------------
// =================================================================================================
// These constants control the fundamental physics and feel of the game.
// Tweaking these values can dramatically change the gameplay experience.

const WALK_SPEED = 6;            // Standard movement speed.
const RUN_SPEED = 10;            // Speed when holding the sprint key.
const JUMP_FORCE = 12;           // The initial upward velocity of a jump.
const WALL_JUMP_FORCE = 10;      // The outward force when kicking off a wall.
const GRAVITY = -35;             // The constant downward acceleration.
const MAX_JUMPS = 3;             // Allows for a double jump after leaving the ground.
const MOUSE_SENSITIVITY = 0.002; // Controls how much the camera moves with the mouse.

// Camera constraints to prevent it from going upside down or too low.
const CAMERA_MIN_PHI = 0.3;      // Minimum vertical angle (radians).
const CAMERA_MAX_PHI = Math.PI / 2.1; // Maximum vertical angle (radians).

const TOTAL_COLLECTIBLES = 80;   // The total number of fish to collect to win.

// "Game feel" constants for more responsive controls.
const COYOTE_TIME = 0.1;       // How long you can still jump after running off a ledge (in seconds).
const JUMP_BUFFER_TIME = 0.1;  // How early you can press jump before landing and have it execute (in seconds).

// Player character's physical dimensions for collision detection.
const PLAYER_HEIGHT = 0.8;
const PLAYER_RADIUS = 0.3;

// A curated color palette for the procedurally generated city.
const CITY_PALETTE = {
    buildings: [0x8ecae6, 0x219ebc, 0x126782, 0xffb703, 0xfb8500, 0xe76f51, 0xf4a261, 0xe9c46a],
    roofs: [0xd62828, 0xf77f00, 0x8f2d56, 0x227c9d],
    ground: 0x90a955,
    platform: 0x4f772d,
};


// =================================================================================================
// --- TYPES ---------------------------------------------------------------------------------------
// =================================================================================================
// Custom type definitions for better code clarity and type safety.

// Represents the state of the player's keyboard inputs.
type PlayerControls = {
  forward: boolean; backward: boolean; left: boolean;
  right: boolean; jump: boolean; sprint: boolean;
};

// A structured representation of the player's 3D model components for easy access during animation.
type PlayerModel = {
    group: THREE.Group;
    body: THREE.Mesh;
    head: THREE.Group;
    tail: THREE.Group[]; // Array of tail segments for procedural animation.
    ears: { left: THREE.Mesh; right: THREE.Mesh; };
    legs: { frontLeft: THREE.Mesh; frontRight: THREE.Mesh; backLeft: THREE.Mesh; backRight: THREE.Mesh; };
};


// =================================================================================================
// --- MAIN GAME CLASS -----------------------------------------------------------------------------
// =================================================================================================
// This class encapsulates all the logic for the 3D game world, including rendering,
// physics, player control, and game state management.

export class ThreeGame {
    // --- Core Three.js Properties ---
    private canvas: HTMLCanvasElement;
    private renderer!: THREE.WebGLRenderer;
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private clock = new THREE.Clock(); // Used to measure time between frames (delta time).
    private composer!: EffectComposer; // Handles post-processing effects like bloom.

    // --- Player State ---
    private player!: THREE.Group; // The main container for the player model.
    private playerModel!: PlayerModel; // The detailed cat model.
    private playerBoundingBox!: THREE.Box3; // The invisible box used for collision detection.
    private playerVelocity = new THREE.Vector3(); // Current speed and direction of the player.
    private onGround = false; // Is the player currently standing on a surface?
    private jumpCount = 0; // Tracks jumps for double/triple jumping.
    
    // --- Advanced Movement State ---
    private timeSinceGrounded = 0; // Timer for coyote time.
    private timeSinceJumpPressed = 0; // Timer for jump buffering.
    private isTouchingWall = false; // Is the player currently colliding with a wall?
    private wallNormal = new THREE.Vector3(); // The direction away from the wall being touched.

    // --- World and Game State ---
    private collidableObjects: THREE.Object3D[] = []; // A list of all objects the player can collide with.
    private collectibles: THREE.Group[] = []; // A list of all fish in the world.
    private score = 0; // The player's current score.

    // --- Camera Control ---
    private cameraSpherical = new THREE.Spherical(8, Math.PI / 2.5, Math.PI); // Uses spherical coordinates for easy orbital control.
    private cameraLookAt = new THREE.Vector3(); // The point the camera is looking at (smoothed).
    private cameraPosition = new THREE.Vector3(); // The camera's actual position (smoothed).
    private lookAheadOffset = new THREE.Vector3(); // A small offset to make the camera look where the player is going.

    // --- Input and Control ---
    private isRunning = false; // Is the game currently active and accepting input?
    private playerControls: PlayerControls = { forward: false, backward: false, left: false, right: false, jump: false, sprint: false };
    private prevPlayerControls: PlayerControls = { ...this.playerControls }; // State of controls in the previous frame.

    // --- Animation and Effects ---
    private animationState: { turnRate: number; phase: string; time: number; } = { turnRate: 0, phase: 'idle', time: 0 };
    private animationFrameId: number = -1; // The ID of the current animation frame request.
    private sun!: THREE.DirectionalLight;
    private ambientLight!: THREE.AmbientLight;
    private sounds!: { jump: HTMLAudioElement; land: HTMLAudioElement; collect: HTMLAudioElement; wallSlide: HTMLAudioElement; };
    private particlePool: THREE.Mesh[] = []; // A pool of reusable particle objects for efficiency.
    private activeParticles: { mesh: THREE.Mesh; lifetime: number; velocity: THREE.Vector3 }[] = [];
    private audioInitialized = false;

    // --- Callbacks ---
    // A function passed in from the React component to update the UI with the score.
    public onScoreUpdate: (score: number, total: number) => void = () => {};

    constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; }

    /**
     * Initializes the entire game world. This is the main entry point after the class is created.
     */
    public init() {
        this.setupScene();
        this.setupLights();
        this.createCityscape();
        this.setupPlayer();
        this.setupCollectibles();
        this.setupEventListeners();
        this.createParticlePool();
        this.animate(); // Starts the game loop.
        this.onScoreUpdate(this.score, TOTAL_COLLECTIBLES);
    }
    
    /**
     * Sets up the core Three.js components: scene, camera, renderer, and post-processing composer.
     */
    private setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
        this.scene.fog = new THREE.Fog(0x87ceeb, 50, 200); // Fog for atmospheric perspective.

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio); // For crisp rendering on high-DPI screens.
        this.renderer.shadowMap.enabled = true; // Enable shadows.
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // For more realistic lighting.
        
        // Setup post-processing for a bloom (glow) effect.
        const renderPass = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.6, 0.7);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderPass);
        this.composer.addPass(bloomPass);
    }

    /**
     * Configures the lighting for the scene, including ambient light and a directional sun.
     */
    private setupLights() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        this.scene.add(this.ambientLight);

        this.sun = new THREE.DirectionalLight(0xffeeb1, 3.5); // Warm sun color.
        this.sun.position.set(70, 100, 50);
        this.sun.castShadow = true;
        // Configure shadow quality.
        this.sun.shadow.mapSize.width = 4096; this.sun.shadow.mapSize.height = 4096;
        const d = 150;
        this.sun.shadow.camera.left = -d; this.sun.shadow.camera.right = d;
        this.sun.shadow.camera.top = d; this.sun.shadow.camera.bottom = -d;
        this.sun.shadow.bias = -0.0005; // Fixes shadow artifacts.
        this.scene.add(this.sun);
    }
    
     /**
     * Procedurally generates the entire city, including the ground, starting platform, and all buildings.
     */
    private createCityscape() {
        // Create the ground plane.
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(500, 500),
            new THREE.MeshStandardMaterial({ color: CITY_PALETTE.ground })
        );
        ground.receiveShadow = true;
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);
        this.collidableObjects.push(ground); // Add ground to physics objects.
        
        // Create the central starting platform.
        const platformGeo = new THREE.BoxGeometry(15, 2, 15);
        const platformMat = new THREE.MeshStandardMaterial({ color: CITY_PALETTE.platform });
        const platform = new THREE.Mesh(platformGeo, platformMat);
        platform.position.y = 1; 
        platform.receiveShadow = true;
        platform.castShadow = true;
        this.scene.add(platform);
        this.collidableObjects.push(platform);
    
        // Generate a grid of buildings.
        const citySize = 12;
        const spacing = 14;
        for (let x = -citySize; x <= citySize; x++) {
            for (let z = -citySize; z <= citySize; z++) {
                if (Math.abs(x) < 2 && Math.abs(z) < 2) continue; // Leave space around the center.
                if (Math.random() > 0.65) continue; // Create some empty lots for variety.

                const buildingGroup = this.createStylizedBuilding();
                buildingGroup.position.set(
                    x * spacing + THREE.MathUtils.randFloatSpread(6),
                    0,
                    z * spacing + THREE.MathUtils.randFloatSpread(6)
                );
                buildingGroup.rotation.y = [0, Math.PI / 2, Math.PI, Math.PI * 1.5][Math.floor(Math.random() * 4)];
                this.scene.add(buildingGroup);

                // Decompose the building into its individual collidable parts for accurate physics.
                buildingGroup.updateWorldMatrix(true, true);
                buildingGroup.traverse((child) => {
                    if (child.userData.isCollidable) {
                        this.collidableObjects.push(child);
                    }
                });
            }
        }
    }
    
    // A small utility function to pick a random element from an array.
    private pickRandom(arr: any[]) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * Creates a single, stylized building with random features like roofs, ledges, and clutter.
     * @returns A THREE.Group containing all the meshes for one building.
     */
    private createStylizedBuilding(): THREE.Group {
        const group = new THREE.Group();
        const buildingColor = this.pickRandom(CITY_PALETTE.buildings);
        const roofColor = this.pickRandom(CITY_PALETTE.roofs);
        const mainHeight = THREE.MathUtils.randFloat(8, 30);
        const mainWidth = THREE.MathUtils.randFloat(6, 12);
        const mainDepth = THREE.MathUtils.randFloat(6, 12);
        const mainMat = new THREE.MeshStandardMaterial({
            color: buildingColor, metalness: 0.1, roughness: 0.8
        });
        // The main block of the building.
        const mainGeo = new THREE.BoxGeometry(mainWidth, mainHeight, mainDepth);
        mainGeo.translate(0, mainHeight / 2, 0); // Move origin to the base.
        const mainMesh = new THREE.Mesh(mainGeo, mainMat);
        mainMesh.castShadow = true;
        mainMesh.receiveShadow = true;
        mainMesh.userData.isCollidable = true; // Mark this part as solid for physics.
        group.add(mainMesh);
        this.addWindows(mainMesh, mainWidth, mainHeight, mainDepth);

        // Add random rooftop features.
        if (Math.random() > 0.4) { // Pitched roof
            const roofHeight = THREE.MathUtils.randFloat(2, 4);
            const roofGeo = new THREE.ConeGeometry(Math.max(mainWidth, mainDepth) * 0.75, roofHeight, 4); // 4 sides for a pyramid shape.
            const roofMat = new THREE.MeshStandardMaterial({
                color: roofColor, metalness: 0.1, roughness: 0.8
            });
            const roof = new THREE.Mesh(roofGeo, roofMat);
            roof.position.y = mainHeight + roofHeight / 2;
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            group.add(roof);
        } else { // Flat roof with ledge and clutter
            const ledgeHeight = 0.5;
            const ledgeGeo = new THREE.BoxGeometry(mainWidth + 0.5, ledgeHeight, mainDepth + 0.5);
            const ledgeMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
            const ledge = new THREE.Mesh(ledgeGeo, ledgeMat);
            ledge.position.y = mainHeight + ledgeHeight / 2;
            ledge.userData.isCollidable = true;
            group.add(ledge);

            if (Math.random() > 0.5) {
                const clutterHeight = THREE.MathUtils.randFloat(1, 3);
                const clutterWidth = THREE.MathUtils.randFloat(1, 4);
                const clutterGeo = new THREE.BoxGeometry(clutterWidth, clutterHeight, clutterWidth);
                const clutterMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
                const clutter = new THREE.Mesh(clutterGeo, clutterMat);
                clutter.position.set(
                    THREE.MathUtils.randFloatSpread(mainWidth * 0.7),
                    mainHeight + ledgeHeight + clutterHeight / 2,
                    THREE.MathUtils.randFloatSpread(mainDepth * 0.7)
                );
                clutter.castShadow = true;
                clutter.userData.isCollidable = true;
                group.add(clutter);
            }
        }
        return group;
    }

    /**
     * Adds simple window planes to the faces of a building mesh for visual detail.
     */
    private addWindows(buildingMesh: THREE.Mesh, width: number, height: number, depth: number) {
        const windowGeo = new THREE.PlaneGeometry(0.8, 1.2);
        const windowMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0, roughness: 0.5 });
    
        const addWindowsToFace = (faceWidth: number, faceHeight: number, transform: THREE.Matrix4) => {
            const cols = Math.floor((faceWidth - 2) / 2.2);
            const rows = Math.floor((faceHeight - 2) / 3);
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                     if (Math.random() > 0.35) {
                        const windowMesh = new THREE.Mesh(windowGeo, windowMat);
                        const x = -faceWidth/2 + 2 + c * 2.2;
                        const y = 2 + r * 3;
                        windowMesh.position.set(x, y, 0);
                        windowMesh.applyMatrix4(transform); // Apply transformation to position on the correct face.
                        buildingMesh.add(windowMesh);
                    }
                }
            }
        }
    
        // Create transformations for each face of the building.
        const frontTransform = new THREE.Matrix4().setPosition(0, -height/2, depth/2 + 0.01);
        addWindowsToFace(width, height, frontTransform);
    
        const backTransform = new THREE.Matrix4().makeRotationY(Math.PI).setPosition(0, -height/2, -depth/2 - 0.01);
        addWindowsToFace(width, height, backTransform);
    
        const leftTransform = new THREE.Matrix4().makeRotationY(-Math.PI / 2).setPosition(-width/2 - 0.01, -height/2, 0);
        addWindowsToFace(depth, height, leftTransform);
        
        const rightTransform = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(width/2 + 0.01, -height/2, 0);
        addWindowsToFace(depth, height, rightTransform);
    }
    
    /**
     * Creates the player object, including its 3D model and collision bounding box.
     */
    private setupPlayer() {
        this.player = new THREE.Group();
        this.player.position.set(0, 5, 0);
        this.playerModel = this.createDetailedCatModel();
        this.playerModel.group.position.y = PLAYER_HEIGHT;
        this.player.add(this.playerModel.group);
        this.scene.add(this.player);

        this.playerBoundingBox = new THREE.Box3();
        this.updatePlayerBoundingBox();
    }
    
     /**
     * Constructs the detailed 3D model for the cat character.
     * @returns A PlayerModel object containing references to all parts of the cat.
     */
    private createDetailedCatModel(): PlayerModel {
        const group = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.6 });

        const bodyGeo = new THREE.CapsuleGeometry(0.25, 0.8, 4, 12);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.z = Math.PI / 2;
        body.castShadow = true;
        group.add(body);

        const head = new THREE.Group();
        const headGeo = new THREE.SphereGeometry(0.22, 16, 12);
        const headMesh = new THREE.Mesh(headGeo, bodyMat);
        headMesh.position.x = 0.55;
        headMesh.castShadow = true;
        head.add(headMesh);
        group.add(head);

        const earGeo = new THREE.ConeGeometry(0.1, 0.2, 4);
        const leftEar = new THREE.Mesh(earGeo, bodyMat);
        leftEar.position.set(0.55, 0.15, 0.15);
        leftEar.rotation.x = Math.PI / 4;
        const rightEar = leftEar.clone();
        rightEar.position.z = -0.15;
        head.add(leftEar, rightEar);

        // Create a chain of tail segments for procedural animation.
        const tailSegments: THREE.Group[] = [];
        let parent: THREE.Group = group;
        for(let i=0; i<8; i++){
            const tailPivot = new THREE.Group();
            const tailGeo = new THREE.CylinderGeometry(0.06 - i * 0.005, 0.05 - i * 0.005, 0.15, 6);
            const tailSeg = new THREE.Mesh(tailGeo, bodyMat);
            tailSeg.position.y = 0.075;
            tailPivot.add(tailSeg)
            tailPivot.position.y = i === 0 ? 0 : 0.15;
            parent.add(tailPivot);
            parent = tailPivot;
            tailSegments.push(tailPivot);
        }
        // Position the base of the tail.
        group.children[group.children.length - 1].position.set(-0.5, 0.1, 0);
        group.children[group.children.length - 1].rotation.z = -Math.PI / 4;

        const legGeo = new THREE.CylinderGeometry(0.07, 0.05, 0.5, 8);
        const frontLeft = new THREE.Mesh(legGeo, bodyMat);
        frontLeft.position.set(0.3, -0.3, 0.2);
        const frontRight = frontLeft.clone();
        frontRight.position.z = -0.2;
        const backLeft = frontLeft.clone();
        backLeft.position.x = -0.3;
        const backRight = backLeft.clone();
        backRight.position.z = -0.2;
        [frontLeft, frontRight, backLeft, backRight].forEach(leg => leg.castShadow = true);
        group.add(frontLeft, frontRight, backLeft, backRight);
        
        return { group, body, head, tail: tailSegments, ears: {left: leftEar, right: rightEar}, legs: {frontLeft, frontRight, backLeft, backRight}};
    }

    /**
     * Initializes the Web Audio API and loads all sound effects. Called once when the game starts.
     * FIX: Replaced broken audio URLs with new, reliable ones to fix "no supported sources" error.
     */
    private initAudio() {
        if(this.audioInitialized) return;
        this.sounds = {
            jump: new Audio('https://gdm-catalog-fmapi-prod.imgix.net/Node_user_80/Sound_Effect_e77a970e-e284-4864-a82f-57ab718a3563.wav'),
            land: new Audio('https://gdm-catalog-fmapi-prod.imgix.net/Node_user_80/Sound_Effect_4e409395-5858-47a3-8640-520e55def739.wav'),
            collect: new Audio('https://gdm-catalog-fmapi-prod.imgix.net/Node_user_80/Sound_Effect_1e18d63a-237c-486b-a8f8-3f11818b29f7.wav'),
            wallSlide: new Audio('https://gdm-catalog-fmapi-prod.imgix.net/Node_user_80/Sound_Effect_f222b39f-155e-4513-88a4-0a37ad9235d2.wav'),
        };
        Object.values(this.sounds).forEach(sound => { sound.volume = 0.3; });
        this.sounds.wallSlide.loop = true;
        this.audioInitialized = true;
    }

    /**
     * Creates and places all the collectible fish throughout the city on random rooftops.
     */
    private setupCollectibles() {
        const fishGeo = new THREE.SphereGeometry(0.3, 8, 6);
        const fishMat = new THREE.MeshStandardMaterial({
            color: 0x0ea5e9, emissive: 0x0ea5e9, emissiveIntensity: 2, roughness: 0.2
        });

        for (let i = 0; i < TOTAL_COLLECTIBLES; i++) {
            const fish = new THREE.Mesh(fishGeo, fishMat);
            const collectibleGroup = new THREE.Group();
            collectibleGroup.add(fish);

            // Find a random building part to place the fish on top of.
            const building = this.collidableObjects[Math.floor(Math.random() * (this.collidableObjects.length -1)) + 1];
            if(!building) continue;
            const buildingBox = new THREE.Box3().setFromObject(building);
            const buildingSize = new THREE.Vector3();
            buildingBox.getSize(buildingSize);

            collectibleGroup.position.set(
                building.position.x + THREE.MathUtils.randFloatSpread(buildingSize.x * 0.8),
                buildingBox.max.y + 0.5,
                building.position.z + THREE.MathUtils.randFloatSpread(buildingSize.z * 0.8)
            );

            this.scene.add(collectibleGroup);
            this.collectibles.push(collectibleGroup);
        }
    }

    /**
     * Binds all necessary event listeners for window resizing and mouse movement.
     */
    private setupEventListeners() {
        window.addEventListener('resize', this.onWindowResize);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('pointerlockerror', this.onPointerLockError);
    }
    
    /**
     * The main update function, called every frame by `animate`.
     * It orchestrates all per-frame updates.
     * @param dt Delta time - the time in seconds since the last frame.
     */
    private update = (dt: number) => {
        this.updateTimers(dt);
        this.handlePlayerMovement(dt);
        this.applyPhysicsAndCollisions(dt);
        this.checkCollectibleCollisions();
        this.updateWorld(dt);
        this.updateCamera(dt);
        this.updatePlayerAnimations(dt);
        this.updateParticles(dt);
        this.prevPlayerControls = { ...this.playerControls };
    };
    
    /**
     * Updates timers used for coyote time and jump buffering.
     */
    private updateTimers(dt: number) {
        this.timeSinceGrounded += dt;
        this.timeSinceJumpPressed += dt;
        // Reset jump pressed timer on a new key press.
        if (this.playerControls.jump && !this.prevPlayerControls.jump) {
            this.timeSinceJumpPressed = 0;
        }
    }

    /**
     * Calculates player velocity based on keyboard input and camera direction.
     */
    private handlePlayerMovement(dt: number) {
        if (!this.isRunning) { // If the game is paused, gradually slow down.
            this.playerVelocity.x = THREE.MathUtils.damp(this.playerVelocity.x, 0, 8, dt);
            this.playerVelocity.z = THREE.MathUtils.damp(this.playerVelocity.z, 0, 8, dt);
            return;
        }

        // Get camera direction, ignoring vertical component.
        const cameraForward = new THREE.Vector3();
        this.camera.getWorldDirection(cameraForward);
        cameraForward.y = 0;
        cameraForward.normalize();
        
        // Calculate the right vector relative to the camera.
        const cameraRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), cameraForward).normalize();

        const forwardInput = (this.playerControls.forward ? 1 : 0) - (this.playerControls.backward ? 1 : 0);
        const rightInput = (this.playerControls.right ? 1 : 0) - (this.playerControls.left ? 1 : 0);

        // Combine inputs and camera vectors to get the final movement direction.
        const moveDir = new THREE.Vector3()
            .addScaledVector(cameraForward, forwardInput)
            .addScaledVector(cameraRight, rightInput);
        
        const speed = this.playerControls.sprint ? RUN_SPEED : WALK_SPEED;
        
        if (moveDir.lengthSq() > 0.01) { // If there is movement input...
            moveDir.normalize();
            const targetVelX = moveDir.x * speed;
            const targetVelZ = moveDir.z * speed;
            // Smoothly damp the current velocity towards the target velocity.
            this.playerVelocity.x = THREE.MathUtils.damp(this.playerVelocity.x, targetVelX, this.onGround ? 8 : 4, dt);
            this.playerVelocity.z = THREE.MathUtils.damp(this.playerVelocity.z, targetVelZ, this.onGround ? 8 : 4, dt);
            
            // Smoothly rotate the player model to face the movement direction.
            const targetAngle = Math.atan2(moveDir.x, moveDir.z);
            let angleDiff = THREE.MathUtils.radToDeg(targetAngle) - THREE.MathUtils.radToDeg(this.player.rotation.y);
            angleDiff = (angleDiff + 180) % 360 - 180; // Clamp to [-180, 180]
            
            this.animationState.turnRate = THREE.MathUtils.damp(this.animationState.turnRate, THREE.MathUtils.degToRad(angleDiff) * 10, 10, dt);
            this.player.rotation.y += this.animationState.turnRate * dt;
        } else { // If no movement input, gradually slow down.
             this.playerVelocity.x = THREE.MathUtils.damp(this.playerVelocity.x, 0, this.onGround ? 10 : 2, dt);
             this.playerVelocity.z = THREE.MathUtils.damp(this.playerVelocity.z, 0, this.onGround ? 10 : 2, dt);
             this.animationState.turnRate = THREE.MathUtils.damp(this.animationState.turnRate, 0, 10, dt);
        }
        
        // --- JUMP LOGIC ---
        // Check if the jump button was recently pressed.
        if (this.timeSinceJumpPressed < JUMP_BUFFER_TIME) {
            // Check for coyote time or if the player is on the ground.
            if(this.timeSinceGrounded < COYOTE_TIME && this.jumpCount < MAX_JUMPS) {
                 this.performJump();
            } else if (this.isTouchingWall) { // Check for wall jump.
                this.performWallJump();
            }
        }

        // --- PARTICLE EMISSION ---
        if (this.playerControls.sprint && this.onGround && moveDir.lengthSq() > 0.1) {
            this.emitSprintParticle();
        }
        if (this.isTouchingWall && !this.onGround && this.playerVelocity.y < 0) {
             this.emitWallSlideParticle();
        }
    }
    
    private performJump() {
        this.timeSinceJumpPressed = JUMP_BUFFER_TIME; // Consume the buffered jump press.
        this.playerVelocity.y = JUMP_FORCE;
        this.jumpCount++;
        this.onGround = false;
        this.animationState.phase = 'jumping';
        this.animationState.time = 0;
        this.sounds?.jump.play();
    }
    
    private performWallJump() {
        this.timeSinceJumpPressed = JUMP_BUFFER_TIME; // Consume jump press.
        this.playerVelocity.y = JUMP_FORCE * 0.9;
        this.playerVelocity.x = this.wallNormal.x * WALL_JUMP_FORCE;
        this.playerVelocity.z = this.wallNormal.z * WALL_JUMP_FORCE;
        this.jumpCount = 1; // Wall jump always resets to the first jump.
        this.sounds?.jump.play();
        this.emitParticleBurst(this.player.position, 10, 0xaaaaaa);
    }

    /**
     * Applies gravity and handles collisions with the world.
     */
    private applyPhysicsAndCollisions(dt: number) {
        const wasOnGround = this.onGround;
        
        // Apply gravity. Reduce gravity when sliding on a wall.
        if (this.isTouchingWall && this.playerVelocity.y < 0 && !this.onGround) {
            this.playerVelocity.y += GRAVITY * dt * 0.2; // Wall slide friction.
        } else {
            this.playerVelocity.y += GRAVITY * dt;
        }

        // Move and check collisions on each axis separately.
        this.player.position.x += this.playerVelocity.x * dt;
        this.checkCollisions('x');
        this.player.position.z += this.playerVelocity.z * dt;
        this.checkCollisions('z');
        this.player.position.y += this.playerVelocity.y * dt;
        this.checkCollisions('y');
        
        // Handle landing logic.
        if (this.onGround) {
            if (this.playerVelocity.y <= 0) {
              if (!wasOnGround) { // If we just landed this frame...
                  this.animationState.phase = 'landing';
                  this.animationState.time = 0;
                  this.sounds?.land.play();
                  this.emitParticleBurst(this.player.position, 5, 0xaaaaaa);
              }
              this.playerVelocity.y = 0;
              this.jumpCount = 0; // Reset jumps on landing.
              this.timeSinceGrounded = 0; // Reset coyote time timer.
            }
        }
    }
    
    /**
     * Checks for and resolves collisions between the player and the world on a given axis.
     * @param axis The axis ('x', 'y', or 'z') to check for collisions.
     */
    private checkCollisions(axis: 'x' | 'y' | 'z') {
        this.updatePlayerBoundingBox();
        const playerBox = this.playerBoundingBox;
    
        // --- VERTICAL COLLISION (Y-AXIS) ---
        if (axis === 'y') {
            this.onGround = false;
            let highestSurfaceY = -Infinity;
    
            // Check for ground collision only when moving down.
            if (this.playerVelocity.y <= 0) {
                for (const object of this.collidableObjects) {
                    const objectBox = new THREE.Box3().setFromObject(object);
                    if (playerBox.intersectsBox(objectBox)) {
                        // Check if we are coming from above and just penetrating the top surface.
                        if (playerBox.min.y < objectBox.max.y && playerBox.max.y > objectBox.max.y) {
                            // Keep track of the highest surface we are touching.
                            if (objectBox.max.y > highestSurfaceY) {
                                highestSurfaceY = objectBox.max.y;
                            }
                        }
                    }
                }
                // If we found a valid ground surface, snap the player to it.
                if (highestSurfaceY > -Infinity) {
                    this.player.position.y = highestSurfaceY;
                    this.playerVelocity.y = 0;
                    this.onGround = true;
                }
            } else { // Player is moving up (check for ceiling collision).
                for (const object of this.collidableObjects) {
                    const objectBox = new THREE.Box3().setFromObject(object);
                    if (playerBox.intersectsBox(objectBox) && playerBox.max.y > objectBox.min.y && playerBox.min.y < objectBox.min.y) {
                        this.player.position.y = objectBox.min.y - PLAYER_HEIGHT;
                        this.playerVelocity.y = 0;
                        return; // Exit after first ceiling hit.
                    }
                }
            }
            return;
        }
    
        // --- HORIZONTAL COLLISION (X and Z AXES) ---
        this.isTouchingWall = false;
        for (const object of this.collidableObjects) {
            const objectBox = new THREE.Box3().setFromObject(object);
            if (playerBox.intersectsBox(objectBox)) {
                const intersection = new THREE.Box3().copy(playerBox).intersect(objectBox);
                const size = new THREE.Vector3();
                intersection.getSize(size);
    
                // Ignore shallow intersections that are likely floor/ceiling collisions.
                if (size.y > size.x && size.y > size.z) continue;
    
                // Resolve the collision by pushing the player out of the object.
                if (axis === 'x') {
                    const direction = this.playerVelocity.x > 0 ? -1 : 1;
                    this.player.position.x += size.x * direction;
                    this.wallNormal.set(direction, 0, 0); // Store the normal for wall jumps.
                } else { // z
                    const direction = this.playerVelocity.z > 0 ? -1 : 1;
                    this.player.position.z += size.z * direction;
                    this.wallNormal.set(0, 0, direction);
                }
                this.playerVelocity[axis] = 0; // Stop movement into the wall.
                this.isTouchingWall = true;
                return; // Resolve one wall collision per axis per frame.
            }
        }
    }
    
    /**
     * Updates the player's bounding box to match its current position.
     */
    private updatePlayerBoundingBox() {
        const playerPosition = this.player.position.clone();
        playerPosition.y += PLAYER_HEIGHT / 2; // Center the box on the player.
        this.playerBoundingBox.setFromCenterAndSize(
            playerPosition,
            new THREE.Vector3(PLAYER_RADIUS * 2, PLAYER_HEIGHT, PLAYER_RADIUS * 2)
        );
    }

    /**
     * Updates the camera's position and orientation to smoothly follow the player.
     */
    private updateCamera(dt: number) {
        // Calculate the target camera position based on spherical coordinates.
        const targetPosition = new THREE.Vector3().setFromSpherical(this.cameraSpherical).add(this.player.position);
        
        // Raycast from the player to the camera to check for obstacles.
        const raycaster = new THREE.Raycaster(this.player.position, targetPosition.clone().sub(this.player.position).normalize());
        const intersects = raycaster.intersectObjects(this.collidableObjects, true);
        if (intersects.length > 0 && intersects[0].distance < this.cameraSpherical.radius) {
            // If there's an obstacle, move the camera in front of it.
            targetPosition.copy(intersects[0].point).addScaledVector(raycaster.ray.direction, -0.5);
        }

        // Smoothly damp the current camera position towards the target.
        this.cameraPosition.x = THREE.MathUtils.damp(this.cameraPosition.x, targetPosition.x, 4, dt);
        this.cameraPosition.y = THREE.MathUtils.damp(this.cameraPosition.y, targetPosition.y, 4, dt);
        this.cameraPosition.z = THREE.MathUtils.damp(this.cameraPosition.z, targetPosition.z, 4, dt);
        this.camera.position.copy(this.cameraPosition);
        
        // "Look ahead" logic: shift the camera's focus point in the direction of movement.
        const lookAheadTarget = new THREE.Vector3(this.playerVelocity.x, 0, this.playerVelocity.z).normalize().multiplyScalar(2);
        this.lookAheadOffset.lerp(lookAheadTarget, 5 * dt);

        const lookAtTarget = this.player.position.clone().add(new THREE.Vector3(0, PLAYER_HEIGHT, 0)).add(this.lookAheadOffset);
        this.cameraLookAt.lerp(lookAtTarget, 10 * dt); // Smoothly interpolate the look-at point.
        this.camera.lookAt(this.cameraLookAt);
    }

    /**
     * Updates the player model's animations based on its current state (running, jumping, etc.).
     */
    private updatePlayerAnimations(dt: number) {
        this.animationState.time += dt;
        const speed = new THREE.Vector2(this.playerVelocity.x, this.playerVelocity.z).length();
        
        if (this.animationState.phase === 'landing' && this.animationState.time > 0.2) {
            this.animationState.phase = 'idle';
        }

        const wasWallSliding = this.animationState.phase === 'wall_sliding';

        // --- State Machine ---
        // Determine the current animation phase based on player state.
        if (!this.onGround) {
            if(this.isTouchingWall && this.playerVelocity.y < 0) {
                this.animationState.phase = 'wall_sliding';
                if(!wasWallSliding) this.sounds?.wallSlide.play();
            } else if (this.playerVelocity.y > 0) {
                 this.animationState.phase = 'jumping';
            } else {
                 this.animationState.phase = 'falling';
            }
        } else if (this.onGround && this.animationState.phase !== 'landing') {
             if (speed > 1) {
                this.animationState.phase = 'running';
            } else {
                this.animationState.phase = 'idle';
            }
        }
        
        // Stop the wall slide sound when not sliding.
        if (wasWallSliding && this.animationState.phase !== 'wall_sliding') {
             this.sounds?.wallSlide.pause();
             if(this.sounds?.wallSlide) this.sounds.wallSlide.currentTime = 0;
        }

        // --- Apply Animations ---
        const sine = Math.sin(this.animationState.time * (this.playerControls.sprint ? 20 : 15));
        
        switch(this.animationState.phase) {
            case 'idle':
                this.playerModel.body.position.y = Math.sin(this.animationState.time) * 0.02; // Idle breathing.
                break;
            case 'running': // Simple procedural run cycle.
                this.playerModel.legs.frontLeft.rotation.x = sine * 0.5;
                this.playerModel.legs.frontRight.rotation.x = -sine * 0.5;
                this.playerModel.legs.backLeft.rotation.x = -sine * 0.5;
                this.playerModel.legs.backRight.rotation.x = sine * 0.5;
                break;
            case 'jumping': case 'falling': // Stretch effect.
                 this.playerModel.body.scale.y = THREE.MathUtils.lerp(this.playerModel.body.scale.y, 1.1, 15 * dt);
                 break;
            case 'landing': // Squash effect.
                this.playerModel.body.scale.y = THREE.MathUtils.lerp(this.playerModel.body.scale.y, 0.7, 20 * dt);
                break;
        }

        // Return to normal scale after squash/stretch.
        if(this.animationState.phase !== 'jumping' && this.animationState.phase !== 'landing' && this.animationState.phase !== 'falling') {
            this.playerModel.body.scale.y = THREE.MathUtils.lerp(this.playerModel.body.scale.y, 1, 10 * dt);
        }
        
        // --- Procedural Tail and Ear Animation ---
        // Animate the tail based on movement speed and turning rate.
        this.playerModel.tail.forEach((seg, i) => {
            const angle = Math.sin(this.animationState.time * 2 + i * 0.5) * (0.1 + speed * 0.02);
            seg.rotation.z = THREE.MathUtils.lerp(seg.rotation.z, angle - this.animationState.turnRate * 0.1, 5 * dt);
            seg.rotation.x = THREE.MathUtils.lerp(seg.rotation.x, -this.animationState.turnRate * 0.5, 5*dt);
        });
        
        // Subtle ear twitching.
        this.playerModel.ears.left.rotation.y = Math.sin(this.animationState.time * 0.7) * 0.1;
        this.playerModel.ears.right.rotation.y = Math.sin(this.animationState.time * 0.7 + Math.PI/2) * -0.1;
    }
    
    /**
     * Checks if the player is close enough to any collectibles and collects them.
     */
    private checkCollectibleCollisions() {
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const collectible = this.collectibles[i];
            if (this.player.position.distanceTo(collectible.position) < 1.5) {
                this.scene.remove(collectible);
                this.collectibles.splice(i, 1);
                this.score++;
                this.onScoreUpdate(this.score, TOTAL_COLLECTIBLES);
                this.sounds?.collect.play();
                this.emitParticleBurst(collectible.position, 15, 0x0ea5e9);
            }
        }
    }
    
    /**
     * Updates any dynamic elements in the world, like rotating collectibles.
     */
    private updateWorld(dt: number) {
        this.collectibles.forEach(c => c.children[0].rotation.y += dt * 2);
    }
    
    /**
     * Creates a pool of reusable particle meshes to avoid creating new objects every frame.
     */
    private createParticlePool() {
        const geo = new THREE.SphereGeometry(0.05, 4, 4);
        const mat = new THREE.MeshBasicMaterial(); // Basic material is cheap to render.
        for (let i = 0; i < 100; i++) {
            const mesh = new THREE.Mesh(geo, mat);
            this.particlePool.push(mesh);
        }
    }

    /**
     * Emits a burst of particles from a specific position.
     */
    private emitParticleBurst(position: THREE.Vector3, count: number, color: number) {
        for (let i = 0; i < count; i++) {
            if (this.particlePool.length === 0) return; // Stop if pool is empty.
            const mesh = this.particlePool.pop()!;
            (mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
            mesh.position.copy(position);
            mesh.scale.set(1, 1, 1);
            this.scene.add(mesh);

            const velocity = new THREE.Vector3(
                THREE.MathUtils.randFloatSpread(5),
                THREE.MathUtils.randFloat(2, 6),
                THREE.MathUtils.randFloatSpread(5)
            );
            this.activeParticles.push({ mesh, lifetime: Math.random() * 0.8 + 0.2, velocity });
        }
    }
    
    // Emits a single dust particle for sprinting.
    private emitSprintParticle() {
        if (this.particlePool.length === 0 || Math.random() > 0.5) return;
        const mesh = this.particlePool.pop()!;
        (mesh.material as THREE.MeshBasicMaterial).color.setHex(0xaaaaaa);
        mesh.position.copy(this.player.position);
        mesh.position.y -= PLAYER_HEIGHT * 0.4;
        this.scene.add(mesh);
        
        const velocity = new THREE.Vector3(
            -this.playerVelocity.x * 0.1,
            THREE.MathUtils.randFloat(0, 1),
            -this.playerVelocity.z * 0.1
        );
        this.activeParticles.push({ mesh, lifetime: 0.5, velocity });
    }
    
    // Emits a single dust particle for wall sliding.
    private emitWallSlideParticle() {
        if (this.particlePool.length === 0 || Math.random() > 0.5) return;
        const mesh = this.particlePool.pop()!;
        (mesh.material as THREE.MeshBasicMaterial).color.setHex(0x888888);
        
        const spawnOffset = new THREE.Vector3(this.wallNormal.x, 0, this.wallNormal.z).multiplyScalar(-PLAYER_RADIUS);
        mesh.position.copy(this.player.position).add(spawnOffset);
        mesh.position.y += Math.random() * PLAYER_HEIGHT;
        
        this.scene.add(mesh);
        
        const velocity = new THREE.Vector3(
            THREE.MathUtils.randFloatSpread(0.5),
            THREE.MathUtils.randFloat(-1, -3),
            THREE.MathUtils.randFloatSpread(0.5)
        );
        this.activeParticles.push({ mesh, lifetime: 0.4, velocity });
    }

    /**
     * Updates the position, scale, and lifetime of all active particles.
     */
    private updateParticles(dt: number) {
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i];
            p.lifetime -= dt;
            p.velocity.y -= 5 * dt; // Simple gravity for particles.
            p.mesh.position.addScaledVector(p.velocity, dt);
            p.mesh.scale.multiplyScalar(0.95); // Shrink over time.

            if (p.lifetime <= 0) {
                this.scene.remove(p.mesh);
                this.particlePool.push(p.mesh); // Return to pool.
                this.activeParticles.splice(i, 1);
            }
        }
    }

    /**
     * The main game loop, called by `requestAnimationFrame`.
     */
    private animate = () => {
        this.animationFrameId = requestAnimationFrame(this.animate);
        const dt = Math.min(this.clock.getDelta(), 0.05); // Get delta time and cap it to prevent physics bugs.
        this.update(dt);
        this.composer.render(); // Render the scene through the post-processing composer.
    };

    // --- EVENT HANDLERS & PUBLIC METHODS ---

    private onWindowResize = () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    };

    private onMouseMove = (event: MouseEvent) => {
        if(!this.isRunning) return;
        // Update spherical coordinates based on mouse movement.
        this.cameraSpherical.theta -= event.movementX * MOUSE_SENSITIVITY;
        this.cameraSpherical.phi -= event.movementY * MOUSE_SENSITIVITY;
        this.cameraSpherical.phi = Math.max(CAMERA_MIN_PHI, Math.min(CAMERA_MAX_PHI, this.cameraSpherical.phi));
    };

    private onPointerLockError = () => {
        console.warn("Could not lock pointer: request denied or failed.");
    };

    /**
     * Cleans up resources when the game is destroyed.
     */
    public dispose() {
        cancelAnimationFrame(this.animationFrameId);
        window.removeEventListener('resize', this.onWindowResize);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('pointerlockerror', this.onPointerLockError);
        this.renderer.dispose();
    }

    /**
     * Toggles the game's running state and handles pointer lock.
     */
    public setRunning(isRunning: boolean) {
        this.isRunning = isRunning;
        if(isRunning) {
            this.initAudio();
            this.canvas.requestPointerLock();
        } else {
            if (document.pointerLockElement === this.canvas) {
                document.exitPointerLock();
            }
            if(this.sounds?.wallSlide.played) this.sounds.wallSlide.pause();
        }
    }

    /**
     * Called by the React component to update the player's controls state.
     */
    public updateControls(controls: PlayerControls) { this.playerControls = controls; }
}