import { Billboard, useTexture } from "@react-three/drei";

export function Shadow() {
  const texture = useTexture("/perfume/shadow.png");

  return (
    <>
      <Billboard>
        <mesh position={[5, -30, -100]}>
          <planeGeometry args={[300, 300]} />
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={0.6}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
      <Billboard>
        <mesh position={[5, -40, -100]}>
          <planeGeometry args={[150, 150]} />
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={0.85}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
    </>
  );
}
