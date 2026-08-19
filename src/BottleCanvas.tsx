import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { Bottle } from "./Bottle";
import { Shadow } from "./Shadow";

export function BottleCanvas() {
  return (
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
        shadows
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[150, 150, 150]} intensity={3} />
        <Shadow />
        <Bottle />
        <Environment preset="studio" />
        <OrbitControls enablePan enableZoom />
      </Canvas>
    </div>
  );
}
