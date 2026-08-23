import { useEffect, useRef } from "react";
import * as THREE from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function BottleViewer() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const orbit = {
      startAzimuth: 15,
      startPolar: 70,
      horizontalRange: 40,
      verticalRange: 20,
    };

    const container = containerRef.current;

    if (!container) return;

    let disposed = false;

    const scene = new THREE.Scene();

    const startAzimuth = THREE.MathUtils.degToRad(orbit.startAzimuth);
    const startPolar = THREE.MathUtils.degToRad(orbit.startPolar);

    const camera = new THREE.PerspectiveCamera(
      35,
      container.clientWidth / container.clientHeight,
      1,
      2000,
    );

    camera.position.setFromSphericalCoords(300, startPolar, startAzimuth);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    container.appendChild(renderer.domElement);

    /*
     * Lighting.
     */
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(-100, 120, 150);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(100, 20, 80);
    scene.add(fillLight);

    /*
     * Orbit controls.
     */
    const controls = new OrbitControls(camera, renderer.domElement);

    controls.enablePan = false;
    controls.enableZoom = false;

    controls.minAzimuthAngle = THREE.MathUtils.degToRad(
      orbit.startAzimuth - orbit.horizontalRange,
    );

    controls.maxAzimuthAngle = THREE.MathUtils.degToRad(
      orbit.startAzimuth + orbit.horizontalRange,
    );

    controls.minPolarAngle = THREE.MathUtils.degToRad(
      orbit.startPolar - orbit.verticalRange,
    );

    controls.maxPolarAngle = THREE.MathUtils.degToRad(
      orbit.startPolar + orbit.verticalRange,
    );

    controls.target.set(0, 0, 0);
    controls.update();

    /*
     * Loaders.
     */
    const gltfLoader = new GLTFLoader();
    const rgbeLoader = new RGBELoader();
    const textureLoader = new THREE.TextureLoader();

    let bottle: THREE.Object3D | null = null;
    let shadow: THREE.Mesh | null = null;
    let shadowTexture: THREE.Texture | null = null;
    let shadowGeometry: THREE.PlaneGeometry | null = null;
    let shadowMaterial: THREE.MeshBasicMaterial | null = null;
    let environmentTexture: THREE.DataTexture | null = null;

    /*
     * Load everything before adding the bottle/shadow
     * to the scene.
     */
    const loadAssets = async () => {
      try {
        const [gltf, hdrTexture, loadedShadowTexture] = await Promise.all([
          gltfLoader.loadAsync("/perfume/hotel-portofino.glb"),
          rgbeLoader.loadAsync("/perfume/studio_small_03_1k.hdr"),
          textureLoader.loadAsync("/perfume/shadow.png"),
        ]);

        if (disposed) {
          hdrTexture.dispose();
          loadedShadowTexture.dispose();
          return;
        }

        /*
         * Environment.
         */
        hdrTexture.mapping = THREE.EquirectangularReflectionMapping;

        environmentTexture = hdrTexture;
        scene.environment = environmentTexture;

        /*
         * Bottle.
         */
        bottle = gltf.scene;

        /*
         * Fake shadow.
         */
        loadedShadowTexture.colorSpace = THREE.SRGBColorSpace;
        shadowTexture = loadedShadowTexture;

        shadowGeometry = new THREE.PlaneGeometry(200, 200);

        shadowMaterial = new THREE.MeshBasicMaterial({
          map: shadowTexture,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        });

        shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);

        shadow.position.set(-4, -18, -18);
        shadow.rotation.set(0, 0.25, 0);

        /*
         * Add both together only once everything is ready.
         */
        scene.add(shadow);
        scene.add(bottle);
      } catch (error) {
        console.error("Failed to load BottleViewer assets", error);
      }
    };

    void loadAssets();

    /*
     * Resize.
     */
    const handleResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    /*
     * Render loop.
     */
    let animationFrame = 0;

    const animate = () => {
      animationFrame = requestAnimationFrame(animate);

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    /*
     * Cleanup.
     */
    return () => {
      disposed = true;

      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleResize);

      controls.dispose();

      if (bottle) {
        bottle.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;

          object.geometry.dispose();

          const material = object.material;

          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else {
            material.dispose();
          }
        });

        scene.remove(bottle);
      }

      if (shadow) {
        scene.remove(shadow);
      }

      shadowGeometry?.dispose();
      shadowMaterial?.dispose();
      shadowTexture?.dispose();
      environmentTexture?.dispose();

      renderer.dispose();

      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: "min(100vw, 100vh, 1200px)",
        height: "min(100vw, 100vh, 1200px)",
        transform: "translate(-50%, -50%)",
      }}
    />
  );
}
