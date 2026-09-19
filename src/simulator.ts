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
  private renderer?: THREE.WebGLRenderer;
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
  private raf = 0;
  private contextLostReported = false;

  /** True when the WebGL context could not be created (context-limit/unsupported). */
  public initFailed = false;
  /** Fired once when the renderer fails to init or the GL context is lost. */
  public onContextLost?: () => void;

  public robotModel?: THREE.Group;
  public groundMaterial?: THREE.MeshStandardMaterial;
  public sequencerVirtualPosition?: THREE.Vector2;

  // --- Lifecycle Methods ---
  constructor(container: HTMLElement) {
    this.clock = new THREE.Clock();

    // --- Scene ---
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x1a2a4f, 10, 25);

    // --- Camera ---
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    this.camera.position.set(0.8, 1, 1.5);
    this.camera.lookAt(0, 0, 0);

    // --- Renderer (defensive: a failed context must NOT throw repeatedly) ---
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(container.clientWidth, container.clientHeight);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.7;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(this.renderer.domElement);

      // Show the calm fallback ONCE if the browser drops the context later.
      this.renderer.domElement.addEventListener(
        'webglcontextlost',
        (ev) => {
          ev.preventDefault();
          this.reportContextLost();
        },
        false,
      );
    } catch {
      console.warn(
        '3D sim disabled: WebGL context could not be created (limit reached or unsupported).',
      );
      this.initFailed = true;
    }

    // If the renderer never came up, stop here — no scene/asset/loop work.
    // The caller inspects `initFailed` and renders a single calm message.
    if (this.initFailed || !this.renderer) {
      // Minimal stubs so later method calls stay null-safe.
      this.controls = new OrbitControls(this.camera, container);
      this.resizeObserver = new ResizeObserver(() => {});
      return;
    }

    // --- Skybox and Environment Lighting ---
    const hdrLoader = new HDRLoader();
    hdrLoader.load(
      'sim3d/Cyberpunk.hdr',
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.background = texture;
        this.scene.environment = texture;
      },
      undefined,
      () => console.warn('3D sim: skybox (Cyberpunk.hdr) failed to load — continuing without it.'),
    );

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(3, 5, 4);
    this.scene.add(directionalLight);

    // --- Controls ---
    this.controls = new OrbitControls(
      this.camera,
      this.renderer ? this.renderer.domElement : container,
    );
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
    const onTexError = (file: string) => () =>
      console.warn(`3D sim: texture '${file}' failed to load — continuing without it.`);
    const colorTexture = textureLoader.load(
      'sim3d/rubber_tiles_diff_2k.jpg',
      undefined,
      undefined,
      onTexError('rubber_tiles_diff_2k.jpg'),
    );
    const normalTexture = textureLoader.load(
      'sim3d/rubber_tiles_nor_gl_2k.jpg',
      undefined,
      undefined,
      onTexError('rubber_tiles_nor_gl_2k.jpg'),
    );
    const roughnessTexture = textureLoader.load(
      'sim3d/rubber_tiles_rough_2k.jpg',
      undefined,
      undefined,
      onTexError('rubber_tiles_rough_2k.jpg'),
    );

    for (const texture of [colorTexture, normalTexture, roughnessTexture]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(8, 8);
    }

    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    this.groundMaterial = new THREE.MeshStandardMaterial({
      map: colorTexture,
      normalMap: normalTexture,
      roughnessMap: roughnessTexture,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeometry, this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    this._preloadAssets();

    // --- Event Listeners ---
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.onCanvasResize(width, height);
      }
    });
    this.resizeObserver.observe(container);
    this.animate();
  }

  public createRobotku3DModel(): THREE.Group {
    const robot = new THREE.Group();
    robot.name = 'Robotku_Kit';

    // Materials
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xd5a575, roughness: 0.7, metalness: 0.1 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.4, metalness: 0.2 });
    const servoMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.3, transparent: true, opacity: 0.9 });
    const pcbMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4, metalness: 0.3 });
    const espMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.2, metalness: 0.8 });
    const powerbankMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6, metalness: 0.2 });
    const oledScreenMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.2, metalness: 0.5 });
    const cyanGlowMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 2.0 });
    const redLedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.5 });
    const blueCableMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, roughness: 0.3 });

    // Chassis Wooden Dowels (Width ~ 0.44, Length ~ 0.56, Height ~ 0.20)
    const dowelRadius = 0.012;
    const w = 0.44;
    const l = 0.56;
    const h = 0.20;

    // 4 Vertical corner dowels
    const vertGeom = new THREE.CylinderGeometry(dowelRadius, dowelRadius, h, 12);
    [-w / 2, w / 2].forEach((x) => {
      [-l / 2, l / 2].forEach((z) => {
        const post = new THREE.Mesh(vertGeom, woodMat);
        post.position.set(x, h / 2 + 0.08, z);
        robot.add(post);

        // Green corner brackets (Top & Bottom)
        const cornerGeom = new THREE.BoxGeometry(0.04, 0.04, 0.04);
        const topCorner = new THREE.Mesh(cornerGeom, greenMat);
        topCorner.position.set(x, h + 0.08, z);
        robot.add(topCorner);

        const btmCorner = new THREE.Mesh(cornerGeom, greenMat);
        btmCorner.position.set(x, 0.08, z);
        robot.add(btmCorner);
      });
    });

    // 4 Top horizontal dowels
    const topLongGeom = new THREE.CylinderGeometry(dowelRadius, dowelRadius, l, 12);
    [-w / 2, w / 2].forEach((x) => {
      const rail = new THREE.Mesh(topLongGeom, woodMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x, h + 0.08, 0);
      robot.add(rail);
    });

    const topCrossGeom = new THREE.CylinderGeometry(dowelRadius, dowelRadius, w, 12);
    [-l / 2, l / 2].forEach((z) => {
      const rail = new THREE.Mesh(topCrossGeom, woodMat);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, h + 0.08, z);
      robot.add(rail);
    });

    // 4 Bottom horizontal dowels
    [-w / 2, w / 2].forEach((x) => {
      const rail = new THREE.Mesh(topLongGeom, woodMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x, 0.08, 0);
      robot.add(rail);
    });

    [-l / 2, l / 2].forEach((z) => {
      const rail = new THREE.Mesh(topCrossGeom, woodMat);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 0.08, z);
      robot.add(rail);
    });

    // Center longitudinal rails
    [-0.08, 0.08].forEach((x) => {
      const midRail = new THREE.Mesh(topLongGeom, woodMat);
      midRail.rotation.x = Math.PI / 2;
      midRail.position.set(x, h + 0.06, 0);
      robot.add(midRail);
    });

    // Left and Right Wheels + Servos
    const wheelRadius = 0.12;
    const wheelThickness = 0.024;
    [-1, 1].forEach((side) => {
      const x = (w / 2 + 0.05) * side;
      const z = 0.02;

      // Servo bracket + Blue servo motor
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.08), greenMat);
      bracket.position.set((w / 2 - 0.02) * side, 0.12, z);
      robot.add(bracket);

      const servo = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.06), servoMat);
      servo.position.set((w / 2 + 0.02) * side, 0.12, z);
      robot.add(servo);

      // Wheel Group
      const wheelGroup = new THREE.Group();
      wheelGroup.name = side === -1 ? 'Wheel_L' : 'Wheel_R';
      wheelGroup.position.set(x, 0.12, z);

      // Outer rim
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 32), greenMat);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);

      // Hub
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, wheelThickness + 0.01, 16), greenMat);
      hub.rotation.z = Math.PI / 2;
      wheelGroup.add(hub);

      robot.add(wheelGroup);
    });

    // Power Bank (Center/Rear Deck)
    const pb = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.06, 0.26), powerbankMat);
    pb.position.set(0, 0.12, 0.10);
    robot.add(pb);

    // Power bank 4 green clips
    [-0.105, 0.105].forEach((x) => {
      [-0.08, 0.08].forEach((z) => {
        const clip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.04), greenMat);
        clip.position.set(x, 0.13, 0.10 + z);
        robot.add(clip);
      });
    });

    // Power bank battery LED gauge
    const pbLed = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.02), cyanGlowMat);
    pbLed.position.set(0, 0.151, 0.20);
    robot.add(pbLed);

    // Controller PCB (Center/Front Upper Deck)
    const pcbCradle = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.02, 0.22), greenMat);
    pcbCradle.position.set(0, h + 0.05, -0.12);
    robot.add(pcbCradle);

    const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.01, 0.20), pcbMat);
    pcb.position.set(0, h + 0.065, -0.12);
    robot.add(pcb);

    // ESP32 Shield
    const esp = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.015, 0.08), espMat);
    esp.position.set(0, h + 0.075, -0.14);
    robot.add(esp);

    // Red Power LED (Dash-LED1)
    const redLed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 12), redLedMat);
    redLed.name = 'Dash-LED1';
    redLed.position.set(0.06, h + 0.075, -0.06);
    robot.add(redLed);

    // Front OLED Screen (Dash-Display)
    const oledMount = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.02), greenMat);
    oledMount.position.set(0, h + 0.08, -l / 2 - 0.01);
    robot.add(oledMount);

    const oledScreen = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.005), oledScreenMat);
    oledScreen.name = 'Dash-Display';
    oledScreen.position.set(0, h + 0.08, -l / 2 - 0.02);
    robot.add(oledScreen);

    // Blue Translucent USB Cable (connecting Powerbank to PCB)
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.12, 0.23),
      new THREE.Vector3(0.08, 0.10, 0.25),
      new THREE.Vector3(0.12, 0.15, 0.10),
      new THREE.Vector3(0.10, h + 0.04, -0.02),
      new THREE.Vector3(0, h + 0.06, -0.02),
    ]);
    const cableGeom = new THREE.TubeGeometry(cableCurve, 24, 0.008, 8, false);
    const cableMesh = new THREE.Mesh(cableGeom, blueCableMat);
    robot.add(cableMesh);

    // Head / Sensor Node for yaw / pitch (Dash-Head)
    const headGroup = new THREE.Group();
    headGroup.name = 'Dash-Head';
    headGroup.position.set(0, h + 0.12, -l / 2);
    const headSensor = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.03, 16), espMat);
    headSensor.rotation.x = Math.PI / 2;
    headGroup.add(headSensor);
    robot.add(headGroup);

    return robot;
  }

  public async loadRobotModel(url?: string): Promise<void> {
    if (this.initFailed || !this.renderer) return;

    try {
      // Build authentic physical Robotku 3D Model
      this.robotModel = this.createRobotku3DModel();

      const masterScale = 0.45;
      this.robotModel.scale.set(masterScale, masterScale, masterScale);

      const box = new THREE.Box3().setFromObject(this.robotModel);
      const center = box.getCenter(new THREE.Vector3());
      this.robotModel.position.x -= center.x;
      this.robotModel.position.z -= center.z;
      this.robotModel.position.y -= box.min.y;

      this.scene.add(this.robotModel);

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

      this.mixer = new THREE.AnimationMixer(this.robotModel);
    } catch (error) {
      console.error('Error creating robot model:', error);
    }
  }

  /** Show the fallback exactly once when the GL context is lost. */
  private reportContextLost(): void {
    if (this.contextLostReported) return;
    this.contextLostReported = true;
    console.warn('3D sim: WebGL context lost — disabling the simulator (Run still works).');
    this.onContextLost?.();
  }

  public dispose(): void {
    // 1. Stop the render loop first so nothing touches a disposed renderer.
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;

    this.resizeObserver?.disconnect();
    this.controls?.dispose?.();

    // 2. Free every geometry / material / texture in the scene graph.
    this.scene?.traverse((o: any) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const k in m) {
          const v: any = m[k];
          if (v?.isTexture) v.dispose();
        }
        m.dispose?.();
      }
    });

    // 3. Drop the standalone icon textures we preloaded.
    this.iconTextures.forEach((t) => t.dispose());
    this.iconTextures.clear();

    // 4. Release the WebGL context so re-mounts (StrictMode/HMR) don't leak.
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
      this.renderer.domElement?.remove();
      this.renderer = undefined;
    }
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
    if (!this.displayMesh || !(this.displayMesh.material instanceof THREE.MeshStandardMaterial))
      return;

    const material = this.displayMesh.material;

    if (iconName === 'clear') {
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
      const colorMap = textureLoader.load(
        'sim3d/rocks_ground_09_diff_2k.jpg',
        undefined,
        undefined,
        () =>
          console.warn(
            "3D sim: texture 'rocks_ground_09_diff_2k.jpg' failed to load — continuing.",
          ),
      );

      colorMap.colorSpace = THREE.SRGBColorSpace;
      colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
      colorMap.repeat.set(2, 2);

      material = new THREE.MeshBasicMaterial({
        map: colorMap,
        color: 0xcccccc,
      });

      const radius = objData.radius || 0.5;
      geometry = new THREE.CylinderGeometry(radius, radius, 1, 32);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0.5;
      this.scene.add(mesh);
      this.levelObjects.push({ mesh, type: 'circle', virtualPosition, radius });
    } else if (objData.type === 'rectangle') {
      const colorMap = textureLoader.load(
        'sim3d/plastered_wall_05_diff_2k.jpg',
        undefined,
        undefined,
        () =>
          console.warn(
            "3D sim: texture 'plastered_wall_05_diff_2k.jpg' failed to load — continuing.",
          ),
      );

      colorMap.colorSpace = THREE.SRGBColorSpace;
      colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
      colorMap.repeat.set(2, 1);

      material = new THREE.MeshBasicMaterial({
        map: colorMap,
        color: 0xffffff,
        side: THREE.DoubleSide,
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

  public addFinishZone(checkpointData: {
    type?: 'circle' | 'rectangle';
    position: { x: number; y: number };
    radius?: number;
    width?: number;
    height?: number;
  }): void {
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
        roughness: 0.7,
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0.05;
      this.scene.add(mesh);

      const borderGeometry = new THREE.EdgesGeometry(geometry);
      const borderMaterial = new THREE.LineBasicMaterial({
        color: 0x00ff88,
        linewidth: 2,
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
        roughness: 0.7,
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0.05;
      this.scene.add(mesh);

      const ringGeometry = new THREE.RingGeometry(radius - 0.05, radius + 0.05, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
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
    this.levelObjects.forEach((obj) => this.scene.remove(obj.mesh));
    this.levelObjects = [];
  }

  public clearLevel(): void {
    this.levelObjects.forEach((obj) => this.scene.remove(obj.mesh));
    this.levelObjects = [];
  }

  public toggleCollisionHelpers(visible: boolean): void {
    if (this.collisionHelper) this.collisionHelper.visible = visible;
    if (this.turningHelper) this.turningHelper.visible = visible;
  }

  // --- Animation Loop ---
  private animate = (): void => {
    // Stop cleanly once disposed (renderer cleared) — avoids rendering a dead context.
    if (!this.renderer) return;
    this.raf = requestAnimationFrame(this.animate);
    const deltaTime = this.clock.getDelta();
    this.mixer?.update(deltaTime);

    if (this.sequencerVirtualPosition) {
      this.updateEnvironment(this.sequencerVirtualPosition);
    }

    if (this.finishZone && (this.finishZone.mesh as any).pulseAnimation) {
      (this.finishZone.mesh as any).pulseAnimation();
    }

    if (this.head) {
      this.head.rotation.x = THREE.MathUtils.lerp(
        this.head.rotation.x,
        this.targetHeadRotation.x,
        this.headLerpFactor,
      );
      this.head.rotation.y = THREE.MathUtils.lerp(
        this.head.rotation.y,
        this.targetHeadRotation.y,
        this.headLerpFactor,
      );
    }

    if (this.robotModel) {
      const targetPosition = new THREE.Vector3(0, 0.4, 0);
      this.controls.target.lerp(targetPosition, 0.1);
    }
    this.controls.update();
    this.renderer?.render(this.scene, this.camera);
  };

  // --- Internal Helpers & Event Handlers ---
  private updateEnvironment(robotVirtualPosition: THREE.Vector2): void {
    if (this.groundMaterial) {
      const textureScaleFactor = 8 / 20;
      const textureOffset = robotVirtualPosition.clone().multiplyScalar(textureScaleFactor);
      this.groundMaterial.map?.offset.set(textureOffset.x, -textureOffset.y);
      this.groundMaterial.normalMap?.offset.set(textureOffset.x, -textureOffset.y);
      this.groundMaterial.roughnessMap?.offset.set(textureOffset.x, -textureOffset.y);
    }

    this.levelObjects.forEach((obj) => {
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
    iconsToLoad.forEach((name) => {
      const texture = textureLoader.load(`icons/${name}.png`, undefined, undefined, () =>
        console.warn(`3D sim: icon 'icons/${name}.png' failed to load — skipping.`),
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      this.iconTextures.set(name, texture);
    });

    SOUND_MAPPING.forEach((sound) => {
      const audio = new Audio(sound.assetPath);
      audio.addEventListener(
        'error',
        () => console.warn(`3D sim: sound '${sound.assetPath}' failed to load — skipping.`),
        { once: true },
      );
      this.sounds.set(sound.id, audio);
    });
  }

  private onCanvasResize(width: number, height: number): void {
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(width, height);
  }

  private createCollisionHelpers(): void {
    if (!this.robotModel) return;

    const height = 0.02;
    const segments = 32;

    const collisionGeometry = new THREE.CylinderGeometry(
      ROBOT_LINEAR_RADIUS,
      ROBOT_LINEAR_RADIUS,
      height,
      segments,
    );
    const collisionMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.25,
    });
    this.collisionHelper = new THREE.Mesh(collisionGeometry, collisionMaterial);
    this.collisionHelper.position.y = height / 2;
    this.collisionHelper.visible = false;
    this.robotModel.add(this.collisionHelper);

    const turningGeometry = new THREE.CylinderGeometry(
      ROBOT_TURNING_RADIUS,
      ROBOT_TURNING_RADIUS,
      height,
      segments,
    );
    const turningMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.2,
    });
    this.turningHelper = new THREE.Mesh(turningGeometry, turningMaterial);
    this.turningHelper.position.y = height / 2;
    this.turningHelper.visible = false;
    this.robotModel.add(this.turningHelper);
  }
}
