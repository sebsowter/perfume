import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { Bottle } from "./Bottle";

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
          position: [0, 0, 8],
          fov: 35,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1,
        }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 5, 5]} intensity={3} />
        <Bottle />
        <Environment preset="studio" />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          //minPolarAngle={Math.PI / 2}
          //maxPolarAngle={Math.PI / 2}
        />
      </Canvas>
    </div>
  );
}
