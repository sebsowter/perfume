import { useTexture } from "@react-three/drei";

export function Shadow() {
  const texture = useTexture("/perfume/shadow.png");

  return (
    <mesh position={[-4, -12, -18]} rotation={[0, 0.25, 0]}>
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </mesh>
  );
}
