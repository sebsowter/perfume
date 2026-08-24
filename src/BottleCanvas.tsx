import { useRef } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";

import { Bottle } from "./Bottle";
//import { Shadow } from "./Shadow";
import { exportGLB } from "./exportGLB";

export function BottleCanvas() {
  const bottleRef = useRef<THREE.Group>(null);

  const handleExport = async () => {
    if (!bottleRef.current) return;

    await exportGLB(bottleRef.current, "hotel-portofino.glb");
  };

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          maxHeight: "100vh",
          width: "min(800px, 66.6667vh, 100vw)",
          aspectRatio: "2 / 3",
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

          {/* <Shadow /> */}

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
