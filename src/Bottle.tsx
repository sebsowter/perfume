import { useMemo } from "react";
import * as THREE from "three";

import { createBottleCapGeometry } from "./createBottleCapGeometry";
import { createBottleBodyGeometry } from "./createBottleBodyGeometry";
import { createBottleTopGeometry } from "./createBottleTopGeometry";
import { createBottleBaseGeometry } from "./createBottleBaseGeometry";
import { createSuperellipseProfile } from "./createSuperellipseProfile";

const bottle = {
  width: 68,
  depth: 23,
  bodyHeight: 81.5,
  overallHeight: 113.2,
  capWidth: 22,
  capHeight: 26.2,
};

const body = {
  mainHeight: 76,
  topHeight: 3,
  baseHeight: 2.5,
};

export function Bottle() {
  const { bodyGeometry, topGeometry, baseGeometry, capGeometry } =
    useMemo(() => {
      const bodyProfile = createSuperellipseProfile({
        width: bottle.width,
        depth: bottle.depth,
        exponent: 2.8,
        segments: 256,
      });

      const topProfile = createSuperellipseProfile({
        width: bottle.width - 1.0,
        depth: bottle.depth - 1.0,
        exponent: 2.8,
        segments: 256,
      });

      const baseProfile = createSuperellipseProfile({
        width: bottle.width - 1.0,
        depth: bottle.depth - 1.0,
        exponent: 2.8,
        segments: 256,
      });

      return {
        bodyGeometry: createBottleBodyGeometry({
          shape: bodyProfile.shape,
          height: body.mainHeight,

          ribCount: 70,
          ribDepth: 0.5,
          ribSharpness: 2,
          samplesPerRib: 10,

          bevelHeight: 1.5,
          bevelInset: 0.8,
          bevelSegments: 6,
        }),

        topGeometry: createBottleTopGeometry({
          shape: topProfile.shape,
          height: 3,

          bevelHeight: 0.7,
          bevelSize: 0.45,
          bevelSegments: 8,

          domeHeight: 0.2,
          domeSegments: 12,
        }),

        baseGeometry: createBottleBaseGeometry({
          shape: baseProfile.shape,
          height: 2.5,

          bevelHeight: 0.7,
          bevelSize: 0.45,
          bevelSegments: 8,
        }),

        capGeometry: createBottleCapGeometry({
          radius: bottle.capWidth / 2,
          height: bottle.capHeight,
          ridges: 70,
          ridgeDepth: 0.1,
        }),
      };
    }, []);

  const bodyBottom = -body.mainHeight / 2;
  const bodyTop = body.mainHeight / 2;

  const baseY = bodyBottom - body.baseHeight / 2;
  const topY = bodyTop + body.topHeight / 2;
  const capY = bodyTop + body.topHeight + 0.2 + bottle.capHeight / 2;

  return (
    <group>
      {/* Main ribbed body */}
      <mesh geometry={bodyGeometry} castShadow receiveShadow>
        <BottleBodyMaterial />
      </mesh>

      {/* Smooth top plate */}
      <mesh
        geometry={topGeometry}
        position={[0, topY, 0]}
        castShadow
        receiveShadow
      >
        <BottlePlateMaterial />
      </mesh>

      {/* Smooth base */}
      <mesh
        geometry={baseGeometry}
        position={[0, baseY, 0]}
        castShadow
        receiveShadow
      >
        <BottlePlateMaterial />
      </mesh>

      {/* Cap */}
      <mesh
        geometry={capGeometry}
        position={[0, capY, 0]}
        castShadow
        receiveShadow
      >
        <BottleCapMaterial />
      </mesh>
    </group>
  );
}

function BottleBodyMaterial() {
  return (
    <meshPhysicalMaterial
      color="#b88a32"
      metalness={1}
      roughness={0.24}
      envMapIntensity={1.35}
      clearcoat={0.02}
      clearcoatRoughness={0.15}
      side={THREE.DoubleSide}
    />
  );
}

function BottlePlateMaterial() {
  return (
    <meshPhysicalMaterial
      color="#b98b31"
      metalness={1}
      roughness={0.18}
      envMapIntensity={1.4}
      clearcoat={0.03}
      clearcoatRoughness={0.1}
      side={THREE.DoubleSide}
    />
  );
}

function BottleCapMaterial() {
  return (
    <meshPhysicalMaterial
      color="#b78a31"
      metalness={1}
      roughness={0.14}
      envMapIntensity={1.45}
      clearcoat={0.03}
      clearcoatRoughness={0.08}
      side={THREE.DoubleSide}
    />
  );
}
