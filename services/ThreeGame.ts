



import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// --- GAME CONSTANTS ---
const WALK_SPEED = 6;
const RUN_SPEED = 10;
const JUMP_FORCE = 12;
const WALL_JUMP_FORCE = 10;
const GRAVITY = -35;
const MAX_JUMPS = 3;
const MOUSE_SENSITIVITY = 0.002;
const CAMERA_MIN_PHI = 0.3;
const CAMERA_MAX_PHI = Math.PI / 2.1;
const TOTAL_COLLECTIBLES = 80;
const COYOTE_TIME = 0.1; // seconds
const JUMP_BUFFER_TIME = 0.1; // seconds

// Player dimensions
const PLAYER_HEIGHT = 0.8; 
const PLAYER_RADIUS = 0.3;

const CITY_PALETTE = {
    buildings: [0x8ecae6, 0x219ebc, 0x126782, 0xffb703, 0xfb8500, 0xe76f51, 0xf4a261, 0xe9c46a],
    roofs: [0xd62828, 0xf77f00, 0x8f2d56, 0x227c9d],
    ground: 0x90a955,
    platform: 0x4f772d,
};

// --- TYPES ---
type PlayerControls = {
  forward: boolean; backward: boolean; left: boolean;
  right: boolean; jump: boolean; sprint: boolean;
};

type PlayerModel = {
    group: THREE.Group;
    body: THREE.Mesh;
    head: THREE.Group;
    tail: THREE.Group[]; // Array of tail segments
    ears: { left: THREE.Mesh; right: THREE.Mesh; };
    legs: { frontLeft: THREE.Mesh; frontRight: THREE.Mesh; backLeft: THREE.Mesh; backRight: THREE.Mesh; };
};


// --- MAIN GAME CLASS ---
export class ThreeGame {
    private canvas: HTMLCanvasElement;
    private renderer!: THREE.WebGLRenderer;
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private clock = new THREE.Clock();
    private composer!: EffectComposer;

    private player!: THREE.Group;
    private playerModel!: PlayerModel;
    private playerBoundingBox!: THREE.Box3;
    private playerVelocity = new THREE.Vector3();
    private onGround = false;
    private jumpCount = 0;
    
    // Advanced movement state
    private timeSinceGrounded = 0;
    private timeSinceJumpPressed = 0;
    private isTouchingWall = false;
    private wallNormal = new THREE.Vector3();

    private collidableObjects: THREE.Object3D[] = [];
    private collectibles: THREE.Group[] = [];
    private score = 0;

    private cameraSpherical = new THREE.Spherical(8, Math.PI / 2.5, Math.PI);
    private cameraLookAt = new THREE.Vector3();
    private cameraPosition = new THREE.Vector3();
    private lookAheadOffset = new THREE.Vector3();


    private isRunning = false;
    private playerControls: PlayerControls = { forward: false, backward: false, left: false, right: false, jump: false, sprint: false };
    private prevPlayerControls: PlayerControls = { ...this.playerControls };

    private animationState: {
        turnRate: number;
        phase: string;
        time: number;
    } = { turnRate: 0, phase: 'idle', time: 0 };
    private animationFrameId: number = -1;

    private sun!: THREE.DirectionalLight;
    private ambientLight!: THREE.AmbientLight;
    private sounds!: { jump: HTMLAudioElement; land: HTMLAudioElement; collect: HTMLAudioElement; wallSlide: HTMLAudioElement; };
    private particlePool: THREE.Mesh[] = [];
    private activeParticles: { mesh: THREE.Mesh; lifetime: number; velocity: THREE.Vector3 }[] = [];
    private audioInitialized = false;
    public onScoreUpdate: (score: number, total: number) => void = () => {};

    constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; }

    public init() {
        this.setupScene();
        this.setupLights();
        this.createCityscape();
        this.setupPlayer();
        this.setupCollectibles();
        this.setupEventListeners();
        this.createParticlePool();
        this.animate();
        this.onScoreUpdate(this.score, TOTAL_COLLECTIBLES);
    }
    
    private setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        
        const renderPass = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.6, 0.7);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderPass);
        this.composer.addPass(bloomPass);
    }

    private setupLights() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        this.scene.add(this.ambientLight);
        this.sun = new THREE.DirectionalLight(0xffeeb1, 3.5);
        this.sun.position.set(70, 100, 50);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.width = 4096; this.sun.shadow.mapSize.height = 4096;
        const d = 150;
        this.sun.shadow.camera.left = -d; this.sun.shadow.camera.right = d;
        this.sun.shadow.camera.top = d; this.sun.shadow.camera.bottom = -d;
        this.sun.shadow.bias = -0.0005;
        this.scene.add(this.sun);
    }
    
    private createCityscape() {
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(500, 500),
            new THREE.MeshStandardMaterial({ color: CITY_PALETTE.ground })
        );
        ground.receiveShadow = true;
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);
        
        const platformGeo = new THREE.BoxGeometry(15, 2, 15);
        const platformMat = new THREE.MeshStandardMaterial({ color: CITY_PALETTE.platform });
        const platform = new THREE.Mesh(platformGeo, platformMat);
        platform.position.y = 1; 
        platform.receiveShadow = true;
        platform.castShadow = true;
        this.scene.add(platform);
        this.collidableObjects.push(platform);
    
        const citySize = 12;
        const spacing = 14;
        for (let x = -citySize; x <= citySize; x++) {
            for (let z = -citySize; z <= citySize; z++) {
                if (Math.abs(x) < 2 && Math.abs(z) < 2) continue; // Leave space around central platform
                if (Math.random() > 0.65) continue; // Create some empty lots

                const building = this.createStylizedBuilding();
                building.position.set(
                    x * spacing + THREE.MathUtils.randFloatSpread(6),
                    0,
                    z * spacing + THREE.MathUtils.randFloatSpread(6)
                );
                building.rotation.y = [0, Math.PI / 2, Math.PI, Math.PI * 1.5][Math.floor(Math.random() * 4)]; // Grid aligned rotation
                this.scene.add(building);
                this.collidableObjects.push(building);
            }
        }
    }
    
    private pickRandom(arr: any[]) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

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
        const mainGeo = new THREE.BoxGeometry(mainWidth, mainHeight, mainDepth);
        mainGeo.translate(0, mainHeight / 2, 0);
        const mainMesh = new THREE.Mesh(mainGeo, mainMat);
        mainMesh.castShadow = true;
        mainMesh.receiveShadow = true;
        group.add(mainMesh);
        this.addWindows(mainMesh, mainWidth, mainHeight, mainDepth);

        if (Math.random() > 0.4) {
            const roofHeight = THREE.MathUtils.randFloat(2, 4);
            const roofGeo = new THREE.ConeGeometry(Math.max(mainWidth, mainDepth) * 0.75, roofHeight, 4);
            const roofMat = new THREE.MeshStandardMaterial({
                color: roofColor, metalness: 0.1, roughness: 0.8
            });
            const roof = new THREE.Mesh(roofGeo, roofMat);
            roof.position.y = mainHeight + roofHeight / 2;
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            group.add(roof);
        } else {
            const ledgeHeight = 0.5;
            const ledgeGeo = new THREE.BoxGeometry(mainWidth + 0.5, ledgeHeight, mainDepth + 0.5);
            const ledgeMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
            const ledge = new THREE.Mesh(ledgeGeo, ledgeMat);
            ledge.position.y = mainHeight + ledgeHeight / 2;
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
                group.add(clutter);
            }
        }
        return group;
    }

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
                        windowMesh.applyMatrix4(transform);
                        buildingMesh.add(windowMesh);
                    }
                }
            }
        }
    
        const frontTransform = new THREE.Matrix4().setPosition(0, -height/2, depth/2 + 0.01);
        addWindowsToFace(width, height, frontTransform);
    
        const backTransform = new THREE.Matrix4().makeRotationY(Math.PI).setPosition(0, -height/2, -depth/2 - 0.01);
        addWindowsToFace(width, height, backTransform);
    
        const leftTransform = new THREE.Matrix4().makeRotationY(-Math.PI / 2).setPosition(-width/2 - 0.01, -height/2, 0);
        addWindowsToFace(depth, height, leftTransform);
        
        const rightTransform = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(width/2 + 0.01, -height/2, 0);
        addWindowsToFace(depth, height, rightTransform);
    }
    
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

    private initAudio() {
        if(this.audioInitialized) return;
        this.sounds = {
            jump: new Audio('https://cdn.jsdelivr.net/gh/hparadiz/sound-assets/sound-effects/jump-3.wav'),
            land: new Audio('https://cdn.jsdelivr.net/gh/hparadiz/sound-assets/sound-effects/hit-1.wav'),
            collect: new Audio('https://cdn.jsdelivr.net/gh/hparadiz/sound-assets/sound-effects/coin-3.wav'),
            wallSlide: new Audio('https://cdn.jsdelivr.net/gh/hparadiz/sound-assets/sound-effects/scrape-2.wav'),
        };
        Object.values(this.sounds).forEach(sound => { sound.volume = 0.3; });
        this.sounds.wallSlide.loop = true;
        this.audioInitialized = true;
    }

    private setupCollectibles() {
        const fishGeo = new THREE.SphereGeometry(0.3, 8, 6);
        const fishMat = new THREE.MeshStandardMaterial({
            color: 0x0ea5e9, emissive: 0x0ea5e9, emissiveIntensity: 2, roughness: 0.2
        });

        for (let i = 0; i < TOTAL_COLLECTIBLES; i++) {
            const fish = new THREE.Mesh(fishGeo, fishMat);
            const collectibleGroup = new THREE.Group();
            collectibleGroup.add(fish);

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

    private setupEventListeners() {
        window.addEventListener('resize', this.onWindowResize);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('pointerlockerror', this.onPointerLockError);
    }
    
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
    
    private updateTimers(dt: number) {
        this.timeSinceGrounded += dt;
        this.timeSinceJumpPressed += dt;
        if (this.playerControls.jump && !this.prevPlayerControls.jump) {
            this.timeSinceJumpPressed = 0;
        }
    }

    private handlePlayerMovement(dt: number) {
        if (!this.isRunning) {
            this.playerVelocity.x = THREE.MathUtils.damp(this.playerVelocity.x, 0, 8, dt);
            this.playerVelocity.z = THREE.MathUtils.damp(this.playerVelocity.z, 0, 8, dt);
            return;
        }

        const cameraForward = new THREE.Vector3();
        this.camera.getWorldDirection(cameraForward);
        cameraForward.y = 0;
        cameraForward.normalize();
        
        const cameraRight = new THREE.Vector3().crossVectors(cameraForward, new THREE.Vector3(0, 1, 0)).normalize();

        const forwardInput = (this.playerControls.forward ? 1 : 0) - (this.playerControls.backward ? 1 : 0);
        const rightInput = (this.playerControls.right ? 1 : 0) - (this.playerControls.left ? 1 : 0);

        const moveDir = new THREE.Vector3()
            .addScaledVector(cameraForward, forwardInput)
            .addScaledVector(cameraRight, rightInput);
        
        const speed = this.playerControls.sprint ? RUN_SPEED : WALK_SPEED;
        
        if (moveDir.lengthSq() > 0.01) {
            moveDir.normalize();
            const targetVelX = moveDir.x * speed;
            const targetVelZ = moveDir.z * speed;
            this.playerVelocity.x = THREE.MathUtils.damp(this.playerVelocity.x, targetVelX, this.onGround ? 8 : 4, dt);
            this.playerVelocity.z = THREE.MathUtils.damp(this.playerVelocity.z, targetVelZ, this.onGround ? 8 : 4, dt);
            
            const targetAngle = Math.atan2(moveDir.x, moveDir.z);
            let angleDiff = THREE.MathUtils.radToDeg(targetAngle) - THREE.MathUtils.radToDeg(this.player.rotation.y);
            angleDiff = (angleDiff + 180) % 360 - 180;
            
            this.animationState.turnRate = THREE.MathUtils.damp(this.animationState.turnRate, THREE.MathUtils.degToRad(angleDiff) * 10, 10, dt);
            this.player.rotation.y += this.animationState.turnRate * dt;
        } else {
             this.playerVelocity.x = THREE.MathUtils.damp(this.playerVelocity.x, 0, this.onGround ? 10 : 2, dt);
             this.playerVelocity.z = THREE.MathUtils.damp(this.playerVelocity.z, 0, this.onGround ? 10 : 2, dt);
             this.animationState.turnRate = THREE.MathUtils.damp(this.animationState.turnRate, 0, 10, dt);
        }
        
        // Jump Logic
        if (this.timeSinceJumpPressed < JUMP_BUFFER_TIME) {
            if(this.timeSinceGrounded < COYOTE_TIME && this.jumpCount < MAX_JUMPS) {
                 this.performJump();
            } else if (this.isTouchingWall) {
                this.performWallJump();
            }
        }

        if (this.playerControls.sprint && this.onGround && moveDir.lengthSq() > 0.1) {
            this.emitSprintParticle();
        }
        if (this.isTouchingWall && !this.onGround && this.playerVelocity.y < 0) {
             this.emitWallSlideParticle();
        }
    }
    
    private performJump() {
        this.timeSinceJumpPressed = JUMP_BUFFER_TIME; // Consume jump press
        this.playerVelocity.y = JUMP_FORCE;
        this.jumpCount++;
        this.onGround = false;
        this.animationState.phase = 'jumping';
        this.animationState.time = 0;
        this.sounds?.jump.play();
    }
    
    private performWallJump() {
        this.timeSinceJumpPressed = JUMP_BUFFER_TIME; // Consume jump press
        this.playerVelocity.y = JUMP_FORCE * 0.9;
        this.playerVelocity.x = this.wallNormal.x * WALL_JUMP_FORCE;
        this.playerVelocity.z = this.wallNormal.z * WALL_JUMP_FORCE;
        this.jumpCount = 1; // Wall jump counts as first jump
        this.sounds?.jump.play();
        this.emitParticleBurst(this.player.position, 10, 0xaaaaaa);
    }

    private applyPhysicsAndCollisions(dt: number) {
        const wasOnGround = this.onGround;
        
        if (this.isTouchingWall && this.playerVelocity.y < 0 && !this.onGround) {
            this.playerVelocity.y += GRAVITY * dt * 0.2; // Wall slide friction
        } else {
            this.playerVelocity.y += GRAVITY * dt;
        }


        this.player.position.x += this.playerVelocity.x * dt;
        this.checkCollisions('x');
        this.player.position.z += this.playerVelocity.z * dt;
        this.checkCollisions('z');
        this.player.position.y += this.playerVelocity.y * dt;
        this.checkCollisions('y');
        
        if (this.onGround) {
            if (this.playerVelocity.y <= 0) {
              if (!wasOnGround) {
                  this.animationState.phase = 'landing';
                  this.animationState.time = 0;
                  this.sounds?.land.play();
                  this.emitParticleBurst(this.player.position, 5, 0xaaaaaa);
              }
              this.playerVelocity.y = 0;
              this.jumpCount = 0;
              this.timeSinceGrounded = 0;
            }
        }
    }
    
    private checkCollisions(axis: 'x' | 'y' | 'z') {
        this.updatePlayerBoundingBox();
        const playerBox = this.playerBoundingBox;
        let isNowOnGround = false;
        let didTouchWall = false;

        for (const object of this.collidableObjects) {
            const objectBox = new THREE.Box3().setFromObject(object);
            if (playerBox.intersectsBox(objectBox)) {
                const intersection = new THREE.Box3().copy(playerBox).intersect(objectBox);
                const size = new THREE.Vector3();
                intersection.getSize(size);

                if (axis === 'y') {
                    if (this.playerVelocity.y < 0 && playerBox.min.y < objectBox.max.y) {
                        this.player.position.y += size.y;
                        this.playerVelocity.y = 0;
                        isNowOnGround = true;
                    } else if (this.playerVelocity.y > 0 && playerBox.max.y > objectBox.min.y) {
                        this.player.position.y -= size.y;
                        this.playerVelocity.y = 0;
                    }
                } else { // x or z collision
                    if (axis === 'x') {
                        const direction = this.playerVelocity.x > 0 ? -1 : 1;
                        this.player.position.x += size.x * direction;
                        this.wallNormal.set(direction, 0, 0);
                    } else { // z
                        const direction = this.playerVelocity.z > 0 ? -1 : 1;
                        this.player.position.z += size.z * direction;
                        this.wallNormal.set(0, 0, direction);
                    }
                     this.playerVelocity[axis] = 0;
                     didTouchWall = true;
                }
            }
        }

        if (axis === 'y') { this.onGround = isNowOnGround; }
        if (axis === 'x' || axis === 'z') { this.isTouchingWall = didTouchWall; }
    }
    private updatePlayerBoundingBox() {
        const playerPosition = this.player.position.clone();
        playerPosition.y += PLAYER_HEIGHT / 2;
        this.playerBoundingBox.setFromCenterAndSize(
            playerPosition,
            new THREE.Vector3(PLAYER_RADIUS * 2, PLAYER_HEIGHT, PLAYER_RADIUS * 2)
        );
    }
    private updateCamera(dt: number) {
        const targetPosition = new THREE.Vector3().setFromSpherical(this.cameraSpherical).add(this.player.position);
        
        const raycaster = new THREE.Raycaster(this.player.position, targetPosition.clone().sub(this.player.position).normalize());
        const intersects = raycaster.intersectObjects(this.collidableObjects, true);
        if (intersects.length > 0 && intersects[0].distance < this.cameraSpherical.radius) {
            targetPosition.copy(intersects[0].point).addScaledVector(raycaster.ray.direction, -0.5);
        }

        this.cameraPosition.x = THREE.MathUtils.damp(this.cameraPosition.x, targetPosition.x, 4, dt);
        this.cameraPosition.y = THREE.MathUtils.damp(this.cameraPosition.y, targetPosition.y, 4, dt);
        this.cameraPosition.z = THREE.MathUtils.damp(this.cameraPosition.z, targetPosition.z, 4, dt);
        this.camera.position.copy(this.cameraPosition);
        
        // Look ahead
        const lookAheadTarget = new THREE.Vector3(this.playerVelocity.x, 0, this.playerVelocity.z).normalize().multiplyScalar(2);
        this.lookAheadOffset.lerp(lookAheadTarget, 5 * dt);

        const lookAtTarget = this.player.position.clone().add(new THREE.Vector3(0, PLAYER_HEIGHT, 0)).add(this.lookAheadOffset);
        this.cameraLookAt.lerp(lookAtTarget, 10 * dt);
        this.camera.lookAt(this.cameraLookAt);
    }
    private updatePlayerAnimations(dt: number) {
        this.animationState.time += dt;
        const speed = new THREE.Vector2(this.playerVelocity.x, this.playerVelocity.z).length();
        
        if (this.animationState.phase === 'landing' && this.animationState.time > 0.2) {
            this.animationState.phase = 'idle';
        }

        const wasWallSliding = this.animationState.phase === 'wall_sliding';

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
        
        if (wasWallSliding && this.animationState.phase !== 'wall_sliding') {
             this.sounds?.wallSlide.pause();
             this.sounds.wallSlide.currentTime = 0;
        }

        
        const sine = Math.sin(this.animationState.time * (this.playerControls.sprint ? 20 : 15));
        
        switch(this.animationState.phase) {
            case 'idle':
                this.playerModel.body.position.y = Math.sin(this.animationState.time) * 0.02;
                break;
            case 'running':
                this.playerModel.legs.frontLeft.rotation.x = sine * 0.5;
                this.playerModel.legs.frontRight.rotation.x = -sine * 0.5;
                this.playerModel.legs.backLeft.rotation.x = -sine * 0.5;
                this.playerModel.legs.backRight.rotation.x = sine * 0.5;
                break;
            case 'jumping': case 'falling':
                 this.playerModel.body.scale.y = THREE.MathUtils.lerp(this.playerModel.body.scale.y, 1.1, 15 * dt);
                 break;
            case 'landing':
                this.playerModel.body.scale.y = THREE.MathUtils.lerp(this.playerModel.body.scale.y, 0.7, 20 * dt);
                break;
        }

        if(this.animationState.phase !== 'jumping' && this.animationState.phase !== 'landing' && this.animationState.phase !== 'falling') {
            this.playerModel.body.scale.y = THREE.MathUtils.lerp(this.playerModel.body.scale.y, 1, 10 * dt);
        }
        
        // Procedural Tail and Ear Animation
        this.playerModel.tail.forEach((seg, i) => {
            const angle = Math.sin(this.animationState.time * 2 + i * 0.5) * (0.1 + speed * 0.02);
            seg.rotation.z = THREE.MathUtils.lerp(seg.rotation.z, angle - this.animationState.turnRate * 0.1, 5 * dt);
            seg.rotation.x = THREE.MathUtils.lerp(seg.rotation.x, -this.animationState.turnRate * 0.5, 5*dt);
        });
        
        this.playerModel.ears.left.rotation.y = Math.sin(this.animationState.time * 0.7) * 0.1;
        this.playerModel.ears.right.rotation.y = Math.sin(this.animationState.time * 0.7 + Math.PI/2) * -0.1;
    }
    
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
    
    private updateWorld(dt: number) {
        this.collectibles.forEach(c => c.children[0].rotation.y += dt * 2);
    }
    
    private createParticlePool() {
        const geo = new THREE.SphereGeometry(0.05, 4, 4);
        const mat = new THREE.MeshBasicMaterial();
        for (let i = 0; i < 100; i++) {
            const mesh = new THREE.Mesh(geo, mat);
            this.particlePool.push(mesh);
        }
    }

    private emitParticleBurst(position: THREE.Vector3, count: number, color: number) {
        for (let i = 0; i < count; i++) {
            if (this.particlePool.length === 0) return;
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


    private updateParticles(dt: number) {
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i];
            p.lifetime -= dt;
            p.velocity.y -= 5 * dt;
            p.mesh.position.addScaledVector(p.velocity, dt);
            p.mesh.scale.multiplyScalar(0.95);

            if (p.lifetime <= 0) {
                this.scene.remove(p.mesh);
                this.particlePool.push(p.mesh);
                this.activeParticles.splice(i, 1);
            }
        }
    }

    private animate = () => {
        this.animationFrameId = requestAnimationFrame(this.animate);
        const dt = Math.min(this.clock.getDelta(), 0.05);
        this.update(dt);
        this.composer.render();
    };

    private onWindowResize = () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    };

    private onMouseMove = (event: MouseEvent) => {
        if(!this.isRunning) return;
        this.cameraSpherical.theta -= event.movementX * MOUSE_SENSITIVITY;
        this.cameraSpherical.phi -= event.movementY * MOUSE_SENSITIVITY;
        this.cameraSpherical.phi = Math.max(CAMERA_MIN_PHI, Math.min(CAMERA_MAX_PHI, this.cameraSpherical.phi));
    };

    private onPointerLockError = () => {
        console.warn("Could not lock pointer: request denied or failed.");
    };

    public dispose() {
        cancelAnimationFrame(this.animationFrameId);
        window.removeEventListener('resize', this.onWindowResize);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('pointerlockerror', this.onPointerLockError);
        this.renderer.dispose();
    }
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
    public updateControls(controls: PlayerControls) { this.playerControls = controls; }
}