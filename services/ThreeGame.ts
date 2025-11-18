
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { PlayerControls } from '../types';

// =================================================================================================
// --- CONFIGURATION -------------------------------------------------------------------------------
// =================================================================================================

const CONFIG = {
    PHYSICS: {
        GRAVITY: 110,
        MOVE_SPEED: 50,
        SPRINT_SPEED: 85,
        ACCEL: 400,             // Snappy
        AIR_CONTROL: 120,
        JUMP_FORCE: 50,
        VAR_JUMP_TIME: 0.25,
        FRICTION_GROUND: 25.0, 
        FRICTION_AIR: 1.0,     
        PLAYER_RADIUS: 1.1,
        PLAYER_HEIGHT: 2.2,     // Height of capsule
        STEP_HEIGHT: 1.2,       // Can step up curbs
        FIXED_STEP: 1 / 60, 
        SUBSTEPS: 5             
    },
    CAMERA: {
        FOV: 60,
        DISTANCE: 30,
        HEIGHT: 18,
        SMOOTH: 10.0,
        LOOK_SMOOTH: 15.0,
        COLLISION_OFFSET: 1.0
    },
    MAP: {
        SIZE: 24,               // Blocks
        BLOCK_SIZE: 30,
        STREET_WIDTH: 18
    }
};

const PALETTE = {
    skyTop: 0x4CA1FF,       // Bright Day
    skyBottom: 0xFFF5EE,    // Seashell
    sun: 0xFFFEFA,
    ambient: 0x909090,
    water: 0x0099DD,
    buildings: [0xFFFFFF, 0xF0F8FF, 0xFAEBD7, 0xFFEFD5, 0xE6E6FA], // White/Pastel washed
    roofs: [0xB22222, 0xA52A2A, 0x808080], // Red tiles
    cat: {
        fur: 0x222222, 
        socks: 0xFFFFFF,
        collar: 0xFF0000
    }
};

// =================================================================================================
// --- PROCEDURAL TEXTURES & SHADERS ---------------------------------------------------------------
// =================================================================================================

function createToonGradient(): THREE.Texture {
    const colors = new Uint8Array([
        80, 80, 90, 255,     // Deep Shadow
        180, 180, 190, 255,  // Soft Shadow
        255, 255, 255, 255   // Light
    ]);
    const texture = new THREE.DataTexture(colors, 3, 1, THREE.RGBAFormat);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
}

function createCobblestoneTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    // Base
    ctx.fillStyle = '#888888';
    ctx.fillRect(0,0,size,size);
    
    // Stones
    ctx.fillStyle = '#999999';
    for(let i=0; i<60; i++) {
        const x = Math.random()*size;
        const y = Math.random()*size;
        const w = 20 + Math.random()*30;
        const h = 15 + Math.random()*20;
        ctx.beginPath();
        ctx.roundRect(x,y,w,h, 5);
        ctx.fill();
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function createBuildingTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#FDF5E6';
    ctx.fillRect(0,0,size,size);
    
    // Bricks
    ctx.fillStyle = '#F0E68C';
    for(let y=0; y<size; y+=20) {
        const offset = (y/20)%2 === 0 ? 0 : 10;
        for(let x=-10; x<size; x+=40) {
            ctx.fillRect(x+offset, y, 35, 15);
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

const WaterShader = {
    uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(PALETTE.water) }
    },
    vertexShader: `
        varying vec2 vUv;
        uniform float time;
        void main() {
            vUv = uv;
            vec3 pos = position;
            pos.y += sin(pos.x * 0.05 + time) * 1.5;
            pos.y += cos(pos.z * 0.05 + time) * 1.5;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 color;
        uniform float time;
        varying vec2 vUv;
        void main() {
            float foam = sin(vUv.x * 20.0 + time*2.0) * sin(vUv.y * 20.0 + time) * 0.1;
            gl_FragColor = vec4(color + foam, 0.85);
        }
    `
};

function createFaceTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const draw = (state: string) => {
        ctx.clearRect(0, 0, 256, 128);
        
        if (state === 'normal' || state === 'happy') {
            // Eyes
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.ellipse(70, 64, 18, 35, 0, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(186, 64, 18, 35, 0, 0, Math.PI*2); ctx.fill();
            
            // Highlights
            ctx.fillStyle = '#FFF';
            ctx.beginPath(); ctx.arc(80, 50, 8, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(196, 50, 8, 0, Math.PI*2); ctx.fill();
            
            // Mouth
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(128, 85, 6, 0, Math.PI, false); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(128, 85); ctx.lineTo(128, 75); ctx.stroke();
        } else if (state === 'blink') {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(40, 70); ctx.quadraticCurveTo(70, 80, 100, 70); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(156, 70); ctx.quadraticCurveTo(186, 80, 216, 70); ctx.stroke();
        }
    };

    const tex = new THREE.CanvasTexture(canvas);
    draw('normal');
    return { texture: tex, set: (s: string) => { draw(s); tex.needsUpdate = true; } };
}

// =================================================================================================
// --- GAME ENGINE ---------------------------------------------------------------------------------
// =================================================================================================

export class ThreeGame {
    private canvas: HTMLCanvasElement;
    private renderer!: THREE.WebGLRenderer;
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private composer!: EffectComposer;
    private clock = new THREE.Clock();
    
    // Systems
    private particleSystem: { mesh: THREE.InstancedMesh, lives: Float32Array, vels: Float32Array, activeCount: number } | null = null;
    
    // State
    private running = false;
    private frameId = 0;
    private timeAcc = 0;
    
    // Physics
    private pPos = new THREE.Vector3(0, 5, 0);
    private pVel = new THREE.Vector3();
    private pOnGround = false;
    private pJumpTimer = 0;
    private pFacing = Math.PI;
    private pPlatformVelocity = new THREE.Vector3(); // Velocity of platform we are standing on
    
    // Visual Interpolation
    private prevPos = new THREE.Vector3();
    private prevRot = Math.PI;
    private animSquash = 1.0;

    // Entities
    private playerGroup!: THREE.Group;
    private playerParts: any = {};
    private colliders: THREE.Box3[] = [];
    private tramGroup!: THREE.Group;
    private waterMat!: THREE.ShaderMaterial;
    
    // Inputs
    private keys: PlayerControls = { forward: false, backward: false, left: false, right: false, jump: false, sprint: false };
    private camAngle = { x: 0.3, y: Math.PI };
    
    // Callbacks
    public onScoreUpdate = (s: number, t: number) => {};
    public onLivesUpdate = (l: number) => {};
    
    // Cache
    private gradientMap: THREE.Texture;
    private cobbleMap: THREE.Texture;
    private brickMap: THREE.Texture;
    
    private score = 0;
    private lives = 9;
    private collectibles: any[] = [];

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.gradientMap = createToonGradient();
        this.cobbleMap = createCobblestoneTexture();
        this.brickMap = createBuildingTexture();
        this.init();
    }

    private init() {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(PALETTE.skyTop);
        this.scene.fog = new THREE.FogExp2(PALETTE.skyTop, 0.006);

        this.camera = new THREE.PerspectiveCamera(CONFIG.CAMERA.FOV, window.innerWidth/window.innerHeight, 0.1, 1000);

        // Post Processing
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.composer.addPass(new OutputPass());

        // Lights
        const hemi = new THREE.HemisphereLight(PALETTE.skyTop, PALETTE.skyBottom, 0.8);
        this.scene.add(hemi);
        
        const sun = new THREE.DirectionalLight(PALETTE.sun, 1.8);
        sun.position.set(150, 300, 100);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -300; sun.shadow.camera.right = 300;
        sun.shadow.camera.top = 300; sun.shadow.camera.bottom = -300;
        sun.shadow.bias = -0.0004;
        this.scene.add(sun);

        this.buildWorld();
        this.buildPlayer();
        this.initParticles();
        
        window.addEventListener('resize', this.onResize);
        this.canvas.addEventListener('click', () => { if(this.running) this.canvas.requestPointerLock(); });
        document.addEventListener('mousemove', this.onMouseMove);

        this.clock.start();
        this.loop();
    }

    // =============================================================================================
    // --- WORLD GENERATION ------------------------------------------------------------------------
    // =============================================================================================

    private buildWorld() {
        const { SIZE, BLOCK_SIZE, STREET_WIDTH } = CONFIG.MAP;
        const fullSize = SIZE * (BLOCK_SIZE + STREET_WIDTH);

        // 1. Pavement (Ground)
        const groundGeo = new THREE.PlaneGeometry(fullSize + 400, fullSize + 400);
        const groundMat = new THREE.MeshToonMaterial({ 
            map: this.cobbleMap, 
            color: 0xBBBBBB,
            gradientMap: this.gradientMap 
        });
        this.cobbleMap.repeat.set(40, 40);
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI/2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.colliders.push(new THREE.Box3().setFromObject(ground));

        // 2. Sea
        this.waterMat = new THREE.ShaderMaterial(WaterShader);
        this.waterMat.transparent = true;
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500, 64, 64), this.waterMat);
        sea.rotation.x = -Math.PI/2;
        sea.position.y = -4;
        this.scene.add(sea);

        // 3. Instanced Props (Optimized)
        const propGeo = new THREE.CylinderGeometry(1, 1, 1.5, 8);
        const propMat = new THREE.MeshToonMaterial({ color: 0x8B4513, gradientMap: this.gradientMap });
        const iChairs = new THREE.InstancedMesh(propGeo, propMat, 2000);
        iChairs.castShadow = true; iChairs.receiveShadow = true;
        this.scene.add(iChairs);
        
        let idxChair = 0;
        const dummy = new THREE.Object3D();

        // 4. City Grid
        for(let x=-SIZE/2; x<SIZE/2; x++) {
            for(let z=-SIZE/2; z<SIZE/2; z++) {
                if(Math.abs(x) < 2 && Math.abs(z) < 2) continue; // Spawn

                const cx = x * (BLOCK_SIZE + STREET_WIDTH);
                const cz = z * (BLOCK_SIZE + STREET_WIDTH);
                const isMainStreet = Math.abs(z) <= 1;

                // Curb/Sidewalk
                const sidewalk = new THREE.Mesh(
                    new THREE.BoxGeometry(BLOCK_SIZE, 0.6, BLOCK_SIZE),
                    new THREE.MeshToonMaterial({ color: 0xDDDDDD, gradientMap: this.gradientMap })
                );
                sidewalk.position.set(cx, 0.3, cz);
                sidewalk.receiveShadow = true;
                this.scene.add(sidewalk);
                // Collision for step-up handled by offset logic, but add to physics
                this.colliders.push(new THREE.Box3().setFromObject(sidewalk));

                // Building
                const height = isMainStreet ? 30 + Math.random()*30 : 12 + Math.random()*15;
                const width = BLOCK_SIZE - 4;
                const color = PALETTE.buildings[Math.floor(Math.random() * PALETTE.buildings.length)];
                const roofColor = PALETTE.roofs[Math.floor(Math.random() * PALETTE.roofs.length)];
                
                // Main block
                const buildMat = new THREE.MeshToonMaterial({ color: color, map: this.brickMap, gradientMap: this.gradientMap });
                const b = new THREE.Mesh(new THREE.BoxGeometry(width, height, width), buildMat);
                b.position.set(cx, height/2 + 0.6, cz);
                b.castShadow = true; b.receiveShadow = true;
                this.scene.add(b);
                this.colliders.push(new THREE.Box3().setFromObject(b));

                // Roof
                const roof = new THREE.Mesh(new THREE.ConeGeometry(width*0.8, 6, 4), new THREE.MeshToonMaterial({ color: roofColor, gradientMap: this.gradientMap }));
                roof.position.set(cx, height + 3.6, cz);
                roof.rotation.y = Math.PI/4;
                this.scene.add(roof);

                // Simit (Collectible)
                if(Math.random() > 0.85) {
                    this.spawnSimit(cx, height + 2, cz);
                }

                // Chairs
                if(isMainStreet && idxChair < 1900) {
                    for(let k=0; k<4; k++) {
                        dummy.position.set(cx + (Math.random()-0.5)*BLOCK_SIZE, 0.75 + 0.6, cz + (Math.random()-0.5)*BLOCK_SIZE);
                        dummy.scale.setScalar(1);
                        dummy.updateMatrix();
                        iChairs.setMatrixAt(idxChair++, dummy.matrix);
                    }
                }
            }
        }

        this.buildTram();
    }

    private buildTram() {
        this.tramGroup = new THREE.Group();
        
        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(8, 7, 24), new THREE.MeshToonMaterial({ color: 0xD32F2F, gradientMap: this.gradientMap }));
        body.position.y = 4;
        body.castShadow = true;
        
        // Roof
        const roof = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.5, 26), new THREE.MeshToonMaterial({ color: 0xFFFFFF, gradientMap: this.gradientMap }));
        roof.position.y = 7.5;
        
        // Wheels
        const wGeo = new THREE.CylinderGeometry(1, 1, 8.2, 16);
        const wMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const w1 = new THREE.Mesh(wGeo, wMat); w1.rotation.z = Math.PI/2; w1.position.set(0, 1, 8);
        const w2 = new THREE.Mesh(wGeo, wMat); w2.rotation.z = Math.PI/2; w2.position.set(0, 1, -8);

        this.tramGroup.add(body, roof, w1, w2);
        this.scene.add(this.tramGroup);
    }

    private spawnSimit(x: number, y: number, z: number) {
        const geo = new THREE.TorusGeometry(1.2, 0.4, 8, 16);
        const mat = new THREE.MeshToonMaterial({ color: 0xFFA500, emissive: 0xCC6600, gradientMap: this.gradientMap });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        this.scene.add(mesh);
        this.collectibles.push({ mesh, active: true, baseY: y });
        this.onScoreUpdate(0, this.collectibles.length);
    }

    private initParticles() {
        const geo = new THREE.SphereGeometry(0.4, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.6 });
        this.particleSystem = {
            mesh: new THREE.InstancedMesh(geo, mat, 200),
            lives: new Float32Array(200),
            vels: new Float32Array(200 * 3),
            activeCount: 0
        };
        this.particleSystem.mesh.count = 0;
        this.scene.add(this.particleSystem.mesh);
    }

    private spawnDust(pos: THREE.Vector3, count: number) {
        if(!this.particleSystem) return;
        const { mesh, lives, vels } = this.particleSystem;
        const dummy = new THREE.Object3D();
        
        let spawned = 0;
        for(let i=0; i<200 && spawned<count; i++) {
            if(lives[i] <= 0) {
                lives[i] = 1.0; // Life
                dummy.position.copy(pos).add(new THREE.Vector3((Math.random()-0.5)*2, 0.5, (Math.random()-0.5)*2));
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
                
                vels[i*3] = (Math.random()-0.5) * 5;
                vels[i*3+1] = Math.random() * 5;
                vels[i*3+2] = (Math.random()-0.5) * 5;
                spawned++;
            }
        }
        mesh.count = 200;
        mesh.instanceMatrix.needsUpdate = true;
    }

    // =============================================================================================
    // --- PLAYER MODEL (CHIBI CAT) ----------------------------------------------------------------
    // =============================================================================================

    private buildPlayer() {
        this.playerGroup = new THREE.Group();
        const furMat = new THREE.MeshToonMaterial({ color: PALETTE.cat.fur, gradientMap: this.gradientMap });
        const sockMat = new THREE.MeshToonMaterial({ color: PALETTE.cat.socks, gradientMap: this.gradientMap });
        const scale = 2.5;

        const visuals = new THREE.Group();
        visuals.scale.setScalar(scale);

        // 1. Body (Round Capsule)
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 4, 8), furMat);
        body.rotation.x = Math.PI/2;
        body.position.y = 0.55;
        body.castShadow = true;
        visuals.add(body);

        // 2. Head (Oversized Sphere)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 32), furMat);
        head.scale.set(1.1, 0.9, 0.9);
        head.position.set(0, 1.1, 0.4);
        head.castShadow = true;
        visuals.add(head);

        // 3. Face (Canvas Texture)
        const fData = createFaceTexture();
        this.playerParts.face = fData;
        const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshBasicMaterial({ map: fData.texture, transparent: true }));
        facePlane.position.set(0, 0.1, 0.55);
        facePlane.rotation.x = -0.1;
        facePlane.renderOrder = 5;
        head.add(facePlane);

        // 4. Whiskers
        const wMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        const wGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0.4, 0.1, 0)]);
        for(let i=0; i<3; i++) {
            const wL = new THREE.Line(wGeo, wMat);
            wL.position.set(0.2, 0 - i*0.05, 0.45);
            wL.rotation.z = 0.2 + i*0.2;
            const wR = new THREE.Line(wGeo, wMat);
            wR.position.set(-0.2, 0 - i*0.05, 0.45);
            wR.rotation.z = Math.PI - (0.2 + i*0.2);
            head.add(wL, wR);
        }

        // 5. Ears
        const earGeo = new THREE.ConeGeometry(0.2, 0.4, 4);
        const earInGeo = new THREE.ConeGeometry(0.12, 0.3, 4);
        const earInMat = new THREE.MeshBasicMaterial({ color: 0xFFAAAA });
        
        const eL = new THREE.Mesh(earGeo, furMat); eL.position.set(0.35, 0.5, 0); eL.rotation.set(-0.2, 0, -0.4);
        const eLi = new THREE.Mesh(earInGeo, earInMat); eLi.position.set(0.35, 0.48, 0.05); eLi.rotation.set(-0.2, 0, -0.4);
        
        const eR = new THREE.Mesh(earGeo, furMat); eR.position.set(-0.35, 0.5, 0); eR.rotation.set(-0.2, 0, 0.4);
        const eRi = new THREE.Mesh(earInGeo, earInMat); eRi.position.set(-0.35, 0.48, 0.05); eRi.rotation.set(-0.2, 0, 0.4);
        head.add(eL, eLi, eR, eRi);

        // 6. Collar
        const collar = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 24), new THREE.MeshToonMaterial({ color: PALETTE.cat.collar }));
        collar.rotation.x = Math.PI/2;
        collar.position.set(0, -0.35, -0.1);
        head.add(collar);
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.8, roughness: 0.2 }));
        bell.position.set(0, -0.45, 0.25);
        head.add(bell);

        // 7. Legs (Socks)
        const legGeo = new THREE.CapsuleGeometry(0.14, 0.4, 4, 8);
        const fl = new THREE.Mesh(legGeo, sockMat);
        const fr = new THREE.Mesh(legGeo, sockMat);
        const bl = new THREE.Mesh(legGeo, sockMat);
        const br = new THREE.Mesh(legGeo, sockMat);
        visuals.add(fl, fr, bl, br);
        this.playerParts.limbs = { fl, fr, bl, br };

        // 8. Tail (Verlet-ish Chain)
        const tail = new THREE.Group();
        for(let i=0; i<7; i++) {
            const s = new THREE.Mesh(new THREE.SphereGeometry(0.12 - i*0.01), furMat);
            s.position.z = -i * 0.15;
            tail.add(s);
        }
        tail.position.set(0, 0.6, -0.4);
        visuals.add(tail);
        this.playerParts.tail = tail;

        this.playerParts.root = visuals;
        this.playerGroup.add(visuals);
        this.scene.add(this.playerGroup);

        // Shadow Blob
        const shadowTex = new THREE.TextureLoader().load('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAMAAACdt4HsAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAAZQTFRFAAAAAAAA5wsO0AAAAAJ0Uk5T/wDltzBKAAAAKElEQVR42mJgGAWjYBSMglEwCkbBSMEYBCMN08CjYBSMglEwCkYBDQAIMABmsAEx2fXQ6wAAAABJRU5ErkJggg==');
        const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, map: shadowTex }));
        shadow.rotation.x = -Math.PI/2;
        this.playerParts.shadow = shadow;
        this.scene.add(shadow);
    }

    // =============================================================================================
    // --- PHYSICS ENGINE V5 (PLATFORMER) ----------------------------------------------------------
    // =============================================================================================

    private loop = () => {
        this.frameId = requestAnimationFrame(this.loop);
        const dt = Math.min(this.clock.getDelta(), 0.1);
        this.timeAcc += dt;
        const step = CONFIG.PHYSICS.FIXED_STEP;

        // Water Animation
        if(this.waterMat) this.waterMat.uniforms.time.value += dt;

        while(this.timeAcc >= step) {
            if(this.running) {
                this.updatePhysicsFixed(step);
                this.updateEntities(step);
            } else {
                this.rotateAttractCam(step);
            }
            this.timeAcc -= step;
        }
        
        this.updateParticles(dt);
        this.render(dt);
    }

    private updatePhysicsFixed(dt: number) {
        // 1. Input
        const input = new THREE.Vector3();
        if(this.keys.forward) input.z -= 1;
        if(this.keys.backward) input.z += 1;
        if(this.keys.left) input.x -= 1;
        if(this.keys.right) input.x += 1;
        
        // Camera Relative Input
        if(input.lengthSq() > 0) {
            input.normalize();
            input.applyAxisAngle(new THREE.Vector3(0,1,0), this.camAngle.y);
            
            // Instant Turn
            this.pFacing = Math.atan2(input.x, input.z);

            // Acceleration
            const accel = this.pOnGround ? CONFIG.PHYSICS.ACCEL : CONFIG.PHYSICS.AIR_CONTROL;
            this.pVel.x += input.x * accel * dt;
            this.pVel.z += input.z * accel * dt;
        }

        // 2. Friction
        const friction = this.pOnGround ? CONFIG.PHYSICS.FRICTION_GROUND : CONFIG.PHYSICS.FRICTION_AIR;
        const currentSpeed = new THREE.Vector2(this.pVel.x, this.pVel.z).length();
        
        if(currentSpeed > 0) {
            const drop = currentSpeed * friction * dt;
            const newSpeed = Math.max(0, currentSpeed - drop);
            if(newSpeed !== currentSpeed) {
                this.pVel.x *= newSpeed / currentSpeed;
                this.pVel.z *= newSpeed / currentSpeed;
            }
        }

        // 3. Max Speed
        const maxS = this.keys.sprint ? CONFIG.PHYSICS.SPRINT_SPEED : CONFIG.PHYSICS.MOVE_SPEED;
        const hVel = new THREE.Vector2(this.pVel.x, this.pVel.z);
        if(hVel.length() > maxS) {
            hVel.normalize().multiplyScalar(maxS);
            this.pVel.x = hVel.x;
            this.pVel.z = hVel.y;
        }

        // 4. Jump
        if(this.keys.jump) {
            if(this.pOnGround) {
                this.pVel.y = CONFIG.PHYSICS.JUMP_FORCE;
                this.pOnGround = false;
                this.pJumpTimer = CONFIG.PHYSICS.VAR_JUMP_TIME;
                this.spawnDust(this.pPos, 10);
                this.animSquash = 0.6; // Squash
            } else if (this.pJumpTimer > 0) {
                this.pVel.y += CONFIG.PHYSICS.GRAVITY * 0.6 * dt; // Hold to jump higher
                this.pJumpTimer -= dt;
            }
        } else {
            this.pJumpTimer = 0;
        }

        // 5. Gravity
        this.pVel.y -= CONFIG.PHYSICS.GRAVITY * dt;

        // 6. Platform Moving
        if(this.pOnGround) {
            this.pPos.add(this.pPlatformVelocity.clone().multiplyScalar(dt));
        }

        // 7. Integration
        this.prevPos.copy(this.pPos);
        const subDt = dt / CONFIG.PHYSICS.SUBSTEPS;
        for(let i=0; i<CONFIG.PHYSICS.SUBSTEPS; i++) {
            this.pPos.x += this.pVel.x * subDt;
            this.pPos.z += this.pVel.z * subDt;
            this.pPos.y += this.pVel.y * subDt;
            this.resolveCollisions();
        }
        
        // Floor Clamp (Sea)
        if(this.pPos.y < -10) this.respawn();
    }

    private resolveCollisions() {
        const r = CONFIG.PHYSICS.PLAYER_RADIUS;
        const h = CONFIG.PHYSICS.PLAYER_HEIGHT;
        const stepMax = CONFIG.PHYSICS.STEP_HEIGHT;
        
        // Reset Ground flag for this substep
        let groundHit = false;
        this.pPlatformVelocity.set(0,0,0);

        // 1. Check Tram (Moving Platform)
        const tramBox = new THREE.Box3().setFromObject(this.tramGroup);
        // Expand box slightly for interaction
        tramBox.min.x -= 1; tramBox.max.x += 1; tramBox.min.z -= 1; tramBox.max.z += 1;
        
        if(tramBox.containsPoint(this.pPos)) {
             // Inside Tram body? Push out.
             // For now simple top collision
             if(this.pPos.y >= tramBox.max.y - 1 && this.pVel.y <= 0) {
                 this.pPos.y = tramBox.max.y;
                 this.pVel.y = 0;
                 groundHit = true;
                 // Moving platform logic
                 this.pPlatformVelocity.set(0, 0, Math.sin(this.clock.elapsedTime * 0.3) * 50); // Matches tram speed roughly
             } else {
                 // Push away horizontally
                 const dx = this.pPos.x - (tramBox.min.x + tramBox.max.x)/2;
                 if(Math.abs(dx) > 0) this.pPos.x += Math.sign(dx) * 0.1;
             }
        }

        // 2. Static Collisions
        // Center of Capsule
        const center = this.pPos.clone().setY(this.pPos.y + r); // Lower sphere
        const topCenter = this.pPos.clone().setY(this.pPos.y + h - r); // Upper sphere
        
        for(const box of this.colliders) {
            if(Math.abs(box.min.x - this.pPos.x) > 30) continue; // Broadphase

            // Simple Sphere vs Box for feet
            const closest = center.clone().clamp(box.min, box.max);
            const diff = center.clone().sub(closest);
            const distSq = diff.lengthSq();
            
            if(distSq < r*r && distSq > 0.00001) {
                const dist = Math.sqrt(distSq);
                const pen = r - dist;
                const norm = diff.divideScalar(dist);

                // Step Handling: If hitting a wall low enough, step up
                if(norm.y < 0.1 && (box.max.y - this.pPos.y) <= stepMax && this.pVel.y <= 0) {
                    this.pPos.y = box.max.y;
                    this.pVel.y = 0;
                    groundHit = true;
                    continue;
                }
                
                // Resolve
                this.pPos.add(norm.multiplyScalar(pen));
                
                // Friction/Slide against wall
                const vn = this.pVel.dot(norm);
                if(vn < 0) this.pVel.sub(norm.multiplyScalar(vn));

                if(norm.y > 0.7) {
                    groundHit = true;
                    this.pVel.y = 0;
                }
            }
        }
        
        // Ground Plane
        if(this.pPos.y <= 0) {
            this.pPos.y = 0;
            this.pVel.y = Math.max(0, this.pVel.y);
            groundHit = true;
        }

        if(groundHit) this.pOnGround = true;
        else this.pOnGround = false;
    }

    private updateEntities(dt: number) {
        // Tram Movement
        const t = this.clock.elapsedTime * 0.3;
        this.tramGroup.position.z = Math.sin(t) * 350;
        
        // Collectibles
        this.collectibles.forEach(c => {
            if(!c.active) return;
            c.mesh.rotation.y += dt * 3;
            if(c.mesh.position.distanceTo(this.pPos.clone().setY(c.mesh.position.y)) < 5) {
                c.active = false;
                c.mesh.visible = false;
                this.score++;
                this.onScoreUpdate(this.score, this.collectibles.length);
                this.playerParts.face.set('happy');
                setTimeout(() => this.playerParts.face.set('normal'), 1500);
            }
        });

        // Blink Logic
        if(Math.random() > 0.99) {
            this.playerParts.face.set('blink');
            setTimeout(() => this.playerParts.face.set('normal'), 150);
        }
    }

    private updateParticles(dt: number) {
        if(!this.particleSystem) return;
        const { mesh, lives, vels } = this.particleSystem;
        const dummy = new THREE.Object3D();
        let active = 0;

        for(let i=0; i<200; i++) {
            if(lives[i] > 0) {
                lives[i] -= dt * 2.0; // Fade out speed
                
                // Get Matrix
                mesh.getMatrixAt(i, dummy.matrix);
                dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                
                // Move
                dummy.position.x += vels[i*3] * dt;
                dummy.position.y += vels[i*3+1] * dt;
                dummy.position.z += vels[i*3+2] * dt;
                dummy.scale.setScalar(lives[i] * 0.8);
                
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
                active++;
            } else {
                dummy.scale.set(0,0,0);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            }
        }
        if(active > 0) mesh.instanceMatrix.needsUpdate = true;
    }

    private rotateAttractCam(dt: number) {
        const t = this.clock.elapsedTime * 0.15;
        this.camera.position.set(Math.sin(t)*120, 60, Math.cos(t)*120);
        this.camera.lookAt(0, 10, 0);
    }

    private respawn() {
        this.lives--;
        this.onLivesUpdate(this.lives);
        this.pPos.set(0, 25, 0);
        this.pVel.set(0,0,0);
        this.prevPos.copy(this.pPos);
    }

    private render(dt: number) {
        // 1. Visual Interpolation
        // Since we run logic at fixed 60hz but render at 144hz+, we smooth the visual position
        // to prevent stutter.
        const alpha = 0.3; // Simplified smoothing
        const renderPos = new THREE.Vector3().lerpVectors(this.playerGroup.position, this.pPos, 0.4);
        this.playerGroup.position.copy(renderPos);
        
        // Rotation Smoothing
        const targetRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), this.pFacing);
        this.playerGroup.quaternion.slerp(targetRot, 15 * dt);

        // Squash & Stretch
        this.animSquash = THREE.MathUtils.lerp(this.animSquash, 1.0, 8 * dt);
        const sy = this.animSquash;
        const sxz = 1 + (1-sy)*0.5;
        this.playerParts.root.scale.set(2.5*sxz, 2.5*sy, 2.5*sxz);

        // Procedural Animation (Legs)
        const speed = new THREE.Vector2(this.pVel.x, this.pVel.z).length();
        if(this.pOnGround && speed > 0.5) {
             if(this.particleSystem && Math.random() > 0.9) this.spawnDust(this.pPos, 1);
             
             const t = this.clock.elapsedTime * speed * 0.4;
             const lift = 0.5;
             const stride = 0.4;
             
             const limbs = this.playerParts.limbs;
             limbs.fl.position.y = Math.max(0, Math.sin(t)*lift);
             limbs.fl.position.z = Math.cos(t)*stride - 0.2;
             
             limbs.br.position.y = Math.max(0, Math.sin(t)*lift);
             limbs.br.position.z = Math.cos(t)*stride + 0.2;
             
             limbs.fr.position.y = Math.max(0, Math.sin(t + Math.PI)*lift);
             limbs.fr.position.z = Math.cos(t + Math.PI)*stride + 0.2;
             
             limbs.bl.position.y = Math.max(0, Math.sin(t + Math.PI)*lift);
             limbs.bl.position.z = Math.cos(t + Math.PI)*stride - 0.2;
             
             // Body Roll
             this.playerParts.root.rotation.z = -this.pVel.x * 0.005;
             // Tail Sway
             this.playerParts.tail.rotation.y = Math.sin(t)*0.6;
        } else {
             // Reset
             this.playerParts.root.rotation.z *= 0.9;
             // Tail Idle
             this.playerParts.tail.rotation.y = Math.sin(this.clock.elapsedTime)*0.2;
             // Legs Idle
             Object.values(this.playerParts.limbs as { [key: string]: THREE.Mesh }).forEach((l: THREE.Mesh) => {
                 l.position.y = THREE.MathUtils.lerp(l.position.y, 0, 10*dt);
             });
        }

        // Shadow
        this.playerParts.shadow.position.copy(renderPos);
        this.playerParts.shadow.position.y = 0.1;

        // Camera Logic (Spring Arm with Occlusion)
        const target = renderPos.clone().add(new THREE.Vector3(0, 4, 0));
        
        // Desired position based on angle
        const offset = new THREE.Vector3(0, CONFIG.CAMERA.HEIGHT, CONFIG.CAMERA.DISTANCE);
        offset.applyAxisAngle(new THREE.Vector3(0,1,0), this.camAngle.y);
        
        // Collision Check for Camera
        // Raycast from target -> desired position
        const dir = offset.clone().normalize();
        const maxDist = offset.length();
        const ray = new THREE.Raycaster(target, dir, 0, maxDist);
        
        // We need to raycast against building geometry.
        // For performance, we just clamp 'desired' dist if it hits a box.
        // Simple approach: Check all boxes? No, too slow.
        // Optimization: Only check boxes within distance.
        let finalDist = maxDist;
        
        // Only check large boxes near camera
        for(const b of this.colliders) {
             if(b.containsPoint(target)) continue; // Inside building? ignore
             const intersection = ray.ray.intersectBox(b, new THREE.Vector3());
             if(intersection) {
                 const d = intersection.distanceTo(target);
                 if(d < finalDist) finalDist = Math.max(d - CONFIG.CAMERA.COLLISION_OFFSET, 5);
             }
        }
        
        const finalPos = target.clone().add(dir.multiplyScalar(finalDist));
        this.camera.position.lerp(finalPos, CONFIG.CAMERA.SMOOTH * dt);
        this.camera.lookAt(target);
        
        this.composer.render();
    }

    public setRunning(r: boolean) {
        this.running = r;
        if(r) {
            this.reset();
            this.canvas.requestPointerLock();
        }
    }

    public reset() {
        this.lives = 9;
        this.score = 0;
        this.pPos.set(0, 10, 0);
        this.pVel.set(0,0,0);
        this.pOnGround = false;
        this.collectibles.forEach(c => {c.active=true; c.mesh.visible=true});
        this.onScoreUpdate(0, this.collectibles.length);
        this.onLivesUpdate(9);
    }

    public updateControls(c: PlayerControls) { this.keys = c; }
    
    private onMouseMove = (e: MouseEvent) => {
        if(this.running && document.pointerLockElement === this.canvas) {
            this.camAngle.y -= e.movementX * 0.002;
            this.camAngle.x -= e.movementY * 0.002;
        }
    }

    private onResize = () => {
        this.camera.aspect = window.innerWidth/window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    public dispose() {
        cancelAnimationFrame(this.frameId);
        this.renderer.dispose();
        window.removeEventListener('resize', this.onResize);
        document.removeEventListener('mousemove', this.onMouseMove);
    }
}
