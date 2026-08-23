import { useRef } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";

import { Bottle } from "./Bottle";
import { Shadow } from "./Shadow";
import { exportGLB } from "./exportGlb";

export function BottleCanvas() {
  const bottleRef = useRef<THREE.Group>(null);

  const handleExport = async () => {
    console.log("EXPORT CLICK");

    if (!bottleRef.current) {
      console.warn("Bottle ref is not available");
      return;
    }

    console.log("bottleRef.current", bottleRef.current);

    await exportGLB(bottleRef.current, "hotel-portofino.glb");
  };

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "min(100vw, 1200px)",
          maxHeight: "100vh",
          aspectRatio: "1 / 1",
          transform: "translate(-50%, -50%)",
        }}
      >
        <Canvas
          camera={{
            position: [0, 0, 350],
            fov: 35,
            near: 1,
            far: 2000,
          }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1,
          }}
        >
          <ambientLight intensity={1.2} />

          <directionalLight position={[0, 0, 150]} intensity={3} />

          <Shadow />

          <Bottle ref={bottleRef} />

          <Environment preset="studio" />

          <OrbitControls enablePan enableZoom />
        </Canvas>
      </div>

      <button
        onClick={handleExport}
        style={{
          position: "absolute",
          bottom: "1rem",
          right: "1rem",
        }}
      >
        Export GLB
      </button>
    </>
  );
}
