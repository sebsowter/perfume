# VBB Fragrance Bottle

Interactive 3D fragrance bottle. The delivery asset is built using Three.js and includes the bottle model, environment map and shadow asset required to reproduce the final presentation.

## Assets

- [3D Model (GLB)](https://sebsowter.github.io/perfume/hotel-portofino.glb)
- [Shadow (PNG)](https://sebsowter.github.io/perfume/shadow.png)
- [Environment Map (HDR)](https://sebsowter.github.io/perfume/studio_small_03_1k.hdr)

## Preview

A working reference implementation can be viewed here:

https://sebsowter.github.io/perfume/

The **Delivery Asset** view represents the intended implementation, with restricted rotation and the supplied shadow.

The **Master Asset** view provides unrestricted rotation, zoom and pan for inspecting the model from all angles.

## Implementation

The implementation below can be used directly as a reference, or the repository can be cloned to run the complete example locally.

The asset paths in `loadAssets()` can be replaced with the corresponding paths used by the final site.

```ts
import * as THREE from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class BottleViewer {
  private container: HTMLElement;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;

  private bottle: THREE.Object3D | null = null;

  private shadow: THREE.Mesh | null = null;
  private shadowTexture: THREE.Texture | null = null;
  private shadowGeometry: THREE.PlaneGeometry | null = null;
  private shadowMaterial: THREE.MeshBasicMaterial | null = null;

  private environmentTexture: THREE.DataTexture | null = null;

  private animationFrame = 0;
  private disposed = false;

  private readonly orbit = {
    startAzimuth: 15,
    startPolar: 70,
    horizontalRange: 30,
    verticalRange: 15,
  };

  private readonly shadowConfig = {
    baseX: -4,
    baseY: -18,
    baseZ: -18,
    rotationY: 0.1,
    horizontalOffset: 6,
    verticalOffset: -10,
  };

  private readonly startAzimuth: number;
  private readonly startPolar: number;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();

    this.startAzimuth = THREE.MathUtils.degToRad(this.orbit.startAzimuth);

    this.startPolar = THREE.MathUtils.degToRad(this.orbit.startPolar);

    this.camera = new THREE.PerspectiveCamera(
      35,
      container.clientWidth / container.clientHeight,
      1,
      2000,
    );

    this.camera.position.setFromSphericalCoords(
      350,
      this.startPolar,
      this.startAzimuth,
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.renderer.setSize(container.clientWidth, container.clientHeight);

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;

    container.appendChild(this.renderer.domElement);

    this.createLighting();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.createControls();

    this.handleResize();
    window.addEventListener("resize", this.handleResize);

    void this.loadAssets();

    this.animate();
  }

  private createLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(-100, 120, 150);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(100, 20, 80);
    this.scene.add(fillLight);
  }

  private createControls() {
    this.controls.enablePan = false;
    this.controls.enableZoom = false;

    this.controls.minAzimuthAngle = THREE.MathUtils.degToRad(
      this.orbit.startAzimuth - this.orbit.horizontalRange,
    );

    this.controls.maxAzimuthAngle = THREE.MathUtils.degToRad(
      this.orbit.startAzimuth + this.orbit.horizontalRange,
    );

    this.controls.minPolarAngle = THREE.MathUtils.degToRad(
      this.orbit.startPolar - this.orbit.verticalRange,
    );

    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(
      this.orbit.startPolar + this.orbit.verticalRange,
    );

    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private async loadAssets() {
    const gltfLoader = new GLTFLoader();
    const rgbeLoader = new RGBELoader();
    const textureLoader = new THREE.TextureLoader();

    try {
      const [gltf, hdrTexture, shadowTexture] = await Promise.all([
        gltfLoader.loadAsync("/perfume/hotel-portofino.glb"),
        rgbeLoader.loadAsync("/perfume/studio_small_03_1k.hdr"),
        textureLoader.loadAsync("/perfume/shadow.png"),
      ]);

      if (this.disposed) {
        hdrTexture.dispose();
        shadowTexture.dispose();
        return;
      }

      hdrTexture.mapping = THREE.EquirectangularReflectionMapping;

      this.environmentTexture = hdrTexture;
      this.scene.environment = this.environmentTexture;
      this.scene.environmentRotation.y = Math.PI * 0.25;

      this.bottle = gltf.scene;

      shadowTexture.colorSpace = THREE.SRGBColorSpace;
      this.shadowTexture = shadowTexture;

      this.shadowGeometry = new THREE.PlaneGeometry(200, 200);

      this.shadowMaterial = new THREE.MeshBasicMaterial({
        map: this.shadowTexture,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      });

      this.shadow = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial);

      this.shadow.position.set(
        this.shadowConfig.baseX,
        this.shadowConfig.baseY,
        this.shadowConfig.baseZ,
      );

      this.shadow.rotation.set(0, this.shadowConfig.rotationY, 0);

      this.scene.add(this.shadow);
      this.scene.add(this.bottle);
    } catch (error) {
      console.error("Failed to load BottleViewer assets", error);
    }
  }

  private handleResize = () => {
    const canvasWidth = 800;
    const canvasHeight = 1200;

    const scale = Math.min(
      window.innerWidth / canvasWidth,
      window.innerHeight / canvasHeight,
      1,
    );

    const width = canvasWidth * scale;
    const height = canvasHeight * scale;

    this.container.style.width = `${width}px`;
    this.container.style.height = `${height}px`;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  };

  private updateShadow() {
    if (!this.shadow) return;

    const azimuth = this.controls.getAzimuthalAngle();
    const polar = this.controls.getPolarAngle();

    const azimuthDelta =
      (azimuth - this.startAzimuth) /
      THREE.MathUtils.degToRad(this.orbit.horizontalRange);

    const polarDelta =
      (polar - this.startPolar) /
      THREE.MathUtils.degToRad(this.orbit.verticalRange);

    const shadowX =
      this.shadowConfig.baseX -
      azimuthDelta * this.shadowConfig.horizontalOffset;

    const shadowY =
      this.shadowConfig.baseY - polarDelta * this.shadowConfig.verticalOffset;

    this.shadow.position.set(shadowX, shadowY, this.shadowConfig.baseZ);
  }

  private animate = () => {
    if (this.disposed) return;

    this.animationFrame = requestAnimationFrame(this.animate);

    this.controls.update();
    this.updateShadow();

    this.renderer.render(this.scene, this.camera);
  };

  public dispose() {
    this.disposed = true;

    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.handleResize);

    this.controls.dispose();

    if (this.bottle) {
      this.bottle.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;

        object.geometry.dispose();

        const material = object.material;

        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          material.dispose();
        }
      });

      this.scene.remove(this.bottle);
    }

    if (this.shadow) {
      this.scene.remove(this.shadow);
    }

    this.shadowGeometry?.dispose();
    this.shadowMaterial?.dispose();
    this.shadowTexture?.dispose();
    this.environmentTexture?.dispose();

    this.renderer.dispose();

    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
```
