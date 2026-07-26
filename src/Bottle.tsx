import { useMemo } from "react";

import { createBottleBodyGeometry } from "./createBottleBodyGeometry";

export function Bottle() {
  const bodyHeight = 2;
  const capRadius = 0.3;
  const capHeight = 0.6;

  const geometry = useMemo(
    () =>
      createBottleBodyGeometry({
        width: 1.8,
        height: bodyHeight,
        depth: 0.7,

        flattenX: 0.35,
        flattenZ: 0.75,

        segments: 512,

        bevelSize: 0.1,
        bevelThickness: 0.1,
        bevelSegments: 16,
      }),
    [],
  );

  return (
    <group position={[0, -0.25, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#d8bd72"
          metalness={1}
          roughness={0.1}
          envMapIntensity={1.8}
          clearcoat={0.1}
          clearcoatRoughness={0.06}
        />
      </mesh>

      {/* <mesh
        position={[0, bodyHeight / 2 + neckHeight / 2, 0]}
        //rotation={[Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[neckRadius, neckRadius, neckHeight, 24]} />
        <meshPhysicalMaterial
          color="#c9c9c9"
          metalness={0.92}
          roughness={0.16}
          clearcoat={0.25}
          clearcoatRoughness={0.18}
        />
      </mesh> */}

      <mesh
        position={[0, bodyHeight / 2 + 0.1 + capHeight / 2, 0]}
        //rotation={[Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[capRadius, capRadius, capHeight, 32]} />
        <meshPhysicalMaterial
          color="#d8bd72"
          metalness={1}
          roughness={0.1}
          envMapIntensity={1.8}
          clearcoat={0.1}
          clearcoatRoughness={0.06}
        />
      </mesh>
    </group>
  );
}
