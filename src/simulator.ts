import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { SOUND_MAPPING } from './sound_profile';

export const ROBOT_LINEAR_RADIUS = 0.4;
export const ROBOT_TURNING_RADIUS = 0.48;

interface VirtualObject {
  mesh: THREE.Mesh;
  type: 'circle' | 'rectangle';
  virtualPosition: THREE.Vector2;
  radius?: number;
  width?: number;
  height?: number;
}

interface FinishZone {
  mesh: THREE.Mesh;
  virtualPosition: THREE.Vector2;
  type: 'circle' | 'rectangle';
  radius?: number;
  width?: number;
  height?: number;
}

export class Simulator {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private mixer?: THREE.AnimationMixer;
  private clock: THREE.Clock;
  private animations: Map<string, THREE.AnimationAction> = new Map();
  private head?: THREE.Object3D;
  private displayMesh?: THREE.Mesh;
  private leds: THREE.Mesh[] = [];
  private iconTextures: Map<string, THREE.Texture> = new Map();
  private sounds: Map<number, HTMLAudioElement> = new Map();
  private levelObjects: VirtualObject[] = [];
  private finishZone: FinishZone | null = null;
  private resizeObserver: ResizeObserver;
  private targetHeadRotation: THREE.Euler = new THREE.Euler();
  private readonly headLerpFactor = 0.02;
  private collisionHelper?: THREE.Mesh;
  private turningHelper?: THREE.Mesh;

  public robotModel?: THREE.Group;
  public groundMaterial?: THREE.MeshStandardMaterial;
  public sequencerVirtualPosition?: THREE.Vector2;

  // --- Lifecycle Methods ---
  constructor(container: HTMLElement) {
    // --- Scene ---
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x1a2a4f, 10, 25);

    // --- Camera ---
    this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(0.8, 1, 1.5);
    this.camera.lookAt(0, 0, 0);

    // --- Renderer ---
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.7;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // --- Skybox and Environment Lighting ---
    const hdrLoader = new HDRLoader();
    hdrLoader.load('Cyberpunk.hdr', (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.background = texture;
      this.scene.environment = texture;
    });

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(3, 5, 4);
    this.scene.add(directionalLight);

    // --- Controls ---
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.3, 0);
    
    // --- Camera Constraints ---
    // 1. Prevent camera from going below ground
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    // 2. Prevent zooming too far in or out
    this.controls.minDistance = 1.0;
    this.controls.maxDistance = 6.0;

    // --- Ground ---
    const textureLoader = new THREE.TextureLoader();
    const colorTexture = textureLoader.load('rubber_tiles_diff_2k.jpg');
    const normalTexture = textureLoader.load('rubber_tiles_nor_gl_2k.jpg');
    const roughnessTexture = textureLoader.load('rubber_tiles_rough_2k.jpg');
    
    for (const texture of [colorTexture, normalTexture, roughnessTexture]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(8, 8);
    }

    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    this.groundMaterial = new THREE.MeshStandardMaterial({
        map: colorTexture,
        normalMap: normalTexture,
        roughnessMap: roughnessTexture,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    this._preloadAssets();
    
    // --- Event Listeners ---
    this.clock = new THREE.Clock();
    this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            this.onCanvasResize(width, height);
        }
    });
    this.resizeObserver.observe(container);    
    this.animate();
  }

  public async loadRobotModel(url: string): Promise<void> {
    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync(url);
      this.robotModel = gltf.scene;

      const masterScale = 0.4;
      this.robotModel.scale.set(masterScale, masterScale, masterScale);
      
      const box = new THREE.Box3().setFromObject(this.robotModel);
      const center = box.getCenter(new THREE.Vector3());
      this.robotModel.position.x -= center.x;
      this.robotModel.position.z -= center.z;
      this.robotModel.position.y -= box.min.y;
      
      this.scene.add(this.robotModel);
      console.log('Robot model loaded successfully.');

      this.createCollisionHelpers();

      this.robotModel.traverse((node) => {
        if (node.name === 'Dash-Head') { 
          this.head = node; 
          this.targetHeadRotation.copy(this.head.rotation);
        }
        if (node.name === 'Dash-Display' && node instanceof THREE.Mesh) {
          this.displayMesh = node;
          if (node.material instanceof THREE.Material) {
            this.displayMesh.material = node.material.clone();
          }
        }
        
        if (node.name.startsWith('Dash-LED') && node instanceof THREE.Mesh) {
          const ledNum = parseInt(node.name.replace('Dash-LED', ''), 10);
          if (!isNaN(ledNum)) {
            if (node.material instanceof THREE.Material) {
              node.material = node.material.clone();
            }
            this.leds[ledNum - 1] = node;
          }
        }
      });

      console.log(`Found Head: ${!!this.head}, Display: ${!!this.displayMesh}, LEDs: ${this.leds.length}`);

      this.mixer = new THREE.AnimationMixer(this.robotModel);
      gltf.animations.forEach((clip) => {
        const action = this.mixer!.clipAction(clip);
        this.animations.set(clip.name, action);
        console.log(`Found animation clip: ${clip.name}`);
      });
    } catch (error) {
      console.error('Error loading robot model:', error);
    }
  }

  public dispose(): void {
      this.resizeObserver.disconnect();
  }

  // --- Public Methods (Robot Part Control) ---
  public setHeadPosition(pitch: number, yaw: number): void {
    if (!this.head) return;
    
    const clampedPitch = Math.max(80, Math.min(100, pitch));
    const clampedYaw = Math.max(80, Math.min(100, yaw));

    this.targetHeadRotation.x = THREE.MathUtils.degToRad(clampedPitch - 90);
    this.targetHeadRotation.y = THREE.MathUtils.degToRad(clampedYaw - 90);
  }

  public setLedColor(ledId: number | 'all', color: THREE.Color): void {
    const applyColor = (ledMesh: THREE.Mesh) => {
        if (ledMesh && ledMesh.material instanceof THREE.MeshStandardMaterial) {
            ledMesh.material.emissive = color;
            ledMesh.material.emissiveIntensity = 2.0;
        }
    };

    if (ledId === 'all') {
        this.leds.forEach(applyColor);
    } else {
      const LED_NUMBERING_OFFSET = 9;
      const visualIndex = (ledId - 1 + LED_NUMBERING_OFFSET) % 12; // Adjust for 0-based index and offset

      if (this.leds[visualIndex]) {
          applyColor(this.leds[visualIndex]);
      }
    }
  }

  public displayIcon(iconName: string): void {
    if (!this.displayMesh || !(this.displayMesh.material instanceof THREE.MeshStandardMaterial)) return;
    
    const material = this.displayMesh.material;

    if (iconName === "clear") {
        material.emissiveMap = null;
        material.emissive.set(0x000000);
    } else {
        const texture = this.iconTextures.get(iconName);
        if (texture) {
            material.emissiveMap = texture;
            material.emissive.set(0xffffff);
            material.emissiveIntensity = 0.5;
        } else {
            material.emissiveMap = null;
            material.emissive.set(0x000000);
        }
    }
    material.needsUpdate = true;
  }

  public playSound(soundId: number): void {
    const sound = this.sounds.get(soundId);
    if (sound) {
        sound.currentTime = 0;
        sound.play();
    } else {
        console.warn(`Sound not found for ID: ${soundId}`);
    }
  }

  public playWheelAnimation(wheel: 'L' | 'R' | 'B', direction: 'Forward' | 'Backward') {
      const animName = `Wheel_${wheel}_${direction}`;
      const action = this.animations.get(animName);
      if (action) {
          action.reset().play();
      } else {
          console.warn(`Animation not found: ${animName}`);
      }
  }
  
  public stopWheelAnimation(wheel: 'L' | 'R' | 'B') {
      const forwardAction = this.animations.get(`Wheel_${wheel}_Forward`);
      const backwardAction = this.animations.get(`Wheel_${wheel}_Backward`);
      forwardAction?.stop();
      backwardAction?.stop();
  }

  // --- Public Method (Environment Control) ---
  public addLevelObject(objData: any): void {
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;
    
    const virtualPosition = new THREE.Vector2(objData.position.x, objData.position.y);
    const textureLoader = new THREE.TextureLoader();

    if (objData.type === 'circle') {
        const colorMap = textureLoader.load('rocks_ground_09_diff_2k.jpg');
        
        colorMap.colorSpace = THREE.SRGBColorSpace;
        colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
        colorMap.repeat.set(2, 2);
        
        material = new THREE.MeshBasicMaterial({ 
          map: colorMap,
          color: 0xcccccc
        });
        
        const radius = objData.radius || 0.5;
        geometry = new THREE.CylinderGeometry(radius, radius, 1, 32);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = 0.5;
        this.scene.add(mesh);
        this.levelObjects.push({ mesh, type: 'circle', virtualPosition, radius });

    } else if (objData.type === 'rectangle') {
        const colorMap = textureLoader.load('plastered_wall_05_diff_2k.jpg');
        
        colorMap.colorSpace = THREE.SRGBColorSpace;
        colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
        colorMap.repeat.set(2, 1);
        
        material = new THREE.MeshBasicMaterial({ 
          map: colorMap,
          color: 0xFFFFFF,
          side: THREE.DoubleSide
        });
        
        const width = objData.width || 1;
        const height = objData.height || 1;
        geometry = new THREE.BoxGeometry(width, 1, height);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = 0.5;
        this.scene.add(mesh);
        this.levelObjects.push({ mesh, type: 'rectangle', virtualPosition, width, height });
    }
  }

  public addFinishZone(checkpointData: { type?: 'circle' | 'rectangle'; position: { x: number; y: number }; radius?: number; width?: number; height?: number }): void {
    this.clearFinishZone();

    const virtualPosition = new THREE.Vector2(checkpointData.position.x, checkpointData.position.y);
    const type = checkpointData.type || 'circle';

    let geometry: THREE.BufferGeometry;
    let mesh: THREE.Mesh;

    if (type === 'rectangle') {
      const width = checkpointData.width || 1;
      const height = checkpointData.height || 1;
      
      geometry = new THREE.BoxGeometry(width, 0.1, height);
      const material = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.6,
        metalness: 0.3,
        roughness: 0.7
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0.05;
      this.scene.add(mesh);

      const borderGeometry = new THREE.EdgesGeometry(geometry);
      const borderMaterial = new THREE.LineBasicMaterial({ 
        color: 0x00ff88,
        linewidth: 2
      });
      const border = new THREE.LineSegments(borderGeometry, borderMaterial);
      border.position.y = 0.11;
      mesh.add(border);

      const pulseAnimation = () => {
        const time = Date.now() * 0.002;
        material.emissiveIntensity = 0.3 + Math.sin(time) * 0.2;
        material.opacity = 0.4 + Math.sin(time * 1.5) * 0.2;
      };
      (mesh as any).pulseAnimation = pulseAnimation;

      this.finishZone = { mesh, virtualPosition, type: 'rectangle', width, height };

    } else {
      const radius = checkpointData.radius || 0.6;
      
      geometry = new THREE.CylinderGeometry(radius, radius, 0.1, 32);
      const material = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.6,
        metalness: 0.3,
        roughness: 0.7
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0.05;
      this.scene.add(mesh);

      const ringGeometry = new THREE.RingGeometry(radius - 0.05, radius + 0.05, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.11;
      mesh.add(ring);

      const pulseAnimation = () => {
        const time = Date.now() * 0.002;
        material.emissiveIntensity = 0.3 + Math.sin(time) * 0.2;
        ringMaterial.opacity = 0.6 + Math.sin(time * 1.5) * 0.2;
      };
      (mesh as any).pulseAnimation = pulseAnimation;

      this.finishZone = { mesh, virtualPosition, type: 'circle', radius };
    }
  }

  public clearFinishZone(): void {
    if (this.finishZone) {
        this.scene.remove(this.finishZone.mesh);
      this.finishZone = null;
    }
  }

  public clearObstacles(): void {
      this.levelObjects.forEach(obj => this.scene.remove(obj.mesh));
      this.levelObjects = [];
  }

  public clearLevel(): void {
      this.levelObjects.forEach(obj => this.scene.remove(obj.mesh));
      this.levelObjects = [];
  }

  public toggleCollisionHelpers(visible: boolean): void {
    if (this.collisionHelper) this.collisionHelper.visible = visible;
    if (this.turningHelper) this.turningHelper.visible = visible;
  }

  // --- Animation Loop ---
  private animate = (): void => {
    requestAnimationFrame(this.animate);
    const deltaTime = this.clock.getDelta();
    this.mixer?.update(deltaTime);

    if (this.sequencerVirtualPosition) {
        this.updateEnvironment(this.sequencerVirtualPosition);
    }

    if (this.finishZone && (this.finishZone.mesh as any).pulseAnimation) {
      (this.finishZone.mesh as any).pulseAnimation();
    }

    if (this.head) {
      this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, this.targetHeadRotation.x, this.headLerpFactor);
      this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y, this.targetHeadRotation.y, this.headLerpFactor);
    }

    if (this.robotModel) {
      const targetPosition = new THREE.Vector3(0, 0.4, 0);
      this.controls.target.lerp(targetPosition, 0.1);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // --- Internal Helpers & Event Handlers ---
  private updateEnvironment(robotVirtualPosition: THREE.Vector2): void {
    if (this.groundMaterial) {
      const textureScaleFactor = 8 / 20;
      const textureOffset = robotVirtualPosition.clone().multiplyScalar(textureScaleFactor);
      this.groundMaterial.map?.offset.set(textureOffset.x, -textureOffset.y);
      this.groundMaterial.normalMap?.offset.set(textureOffset.x, -textureOffset.y);
      this.groundMaterial.roughnessMap?.offset.set(textureOffset.x, -textureOffset.y);
    }

    this.levelObjects.forEach(obj => {
      const relativePos = obj.virtualPosition.clone().sub(robotVirtualPosition);
      obj.mesh.position.x = relativePos.x;
      obj.mesh.position.z = relativePos.y;
    });

    if (this.finishZone) {
      const relativePos = this.finishZone.virtualPosition.clone().sub(robotVirtualPosition);
      this.finishZone.mesh.position.x = relativePos.x;
      this.finishZone.mesh.position.z = relativePos.y;
    }
  }

  private _preloadAssets(): void {
    const textureLoader = new THREE.TextureLoader();
    const iconsToLoad = ['happy', 'sad', 'confused', 'mad'];
    iconsToLoad.forEach(name => {
      const texture = textureLoader.load(`icons/${name}.png`);
      texture.colorSpace = THREE.SRGBColorSpace;
      this.iconTextures.set(name, texture);
    });

    SOUND_MAPPING.forEach(sound => {
      this.sounds.set(sound.id, new Audio(sound.assetPath));
    });
  }

  private onCanvasResize(width: number, height: number): void {
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private createCollisionHelpers(): void {
    if (!this.robotModel) return;

    const height = 0.02;
    const segments = 32;

    const collisionGeometry = new THREE.CylinderGeometry(ROBOT_LINEAR_RADIUS, ROBOT_LINEAR_RADIUS, height, segments);
    const collisionMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00, transparent: true, opacity: 0.25 });
    this.collisionHelper = new THREE.Mesh(collisionGeometry, collisionMaterial);
    this.collisionHelper.position.y = height / 2;
    this.collisionHelper.visible = false;
    this.robotModel.add(this.collisionHelper);

    const turningGeometry = new THREE.CylinderGeometry(ROBOT_TURNING_RADIUS, ROBOT_TURNING_RADIUS, height, segments);
    const turningMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00, transparent: true, opacity: 0.2 });
    this.turningHelper = new THREE.Mesh(turningGeometry, turningMaterial);
    this.turningHelper.position.y = height / 2;
    this.turningHelper.visible = false;
    this.robotModel.add(this.turningHelper);
  }
}