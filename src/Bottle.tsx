import { useMemo } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

import { createBottleCapGeometry } from "./createBottleCapGeometry";
import { createBottleBodyGeometry } from "./createBottleBodyGeometry";
import { createBottleTopGeometry } from "./createBottleTopGeometry";
import { createBottleBaseGeometry } from "./createBottleBaseGeometry";
import { createSuperellipseProfile } from "./createSuperellipseProfile";
import { createBottlePlaqueGeometry } from "./createBottlePlaqueGeometry";
import { createBottleLogoGeometry } from "./createBottleLogoGeometry";

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

const plaque = {
  centerY: -25,
  surfaceOffset: -0.03,
  raise: 0.35,
  width: 39,
  height: 10,
  frameWidth: 0.65,
  frameHeight: 0.8,
  frameMarginX: 0.65,
  frameMarginY: 0.65,
};

const logo = {
  width: 26,
};

export function Bottle() {
  const svg = useLoader(SVGLoader, "/perfume/Hotel_Portofino_Logo.svg");
  const monogramTexture = useTexture("/perfume/VB_Monogram.png");

  const monogramWidth = 7;

  const image = monogramTexture.image as HTMLImageElement;

  const monogramHeight = monogramWidth * (image.height / image.width);

  const {
    bodyGeometry,
    topGeometry,
    baseGeometry,
    capGeometry,
    plaqueGeometry,
    logoGeometry,
  } = useMemo(() => {
    const shapes = svg.paths.flatMap((path) => SVGLoader.createShapes(path));

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

        ribCount: 80,
        ribDepth: 0.5,
        ribSharpness: 2,
        samplesPerRib: 10,

        verticalSegments: 160,

        bevelHeight: 1.5,
        bevelInset: 0.8,

        branding: {
          width: plaque.width + plaque.frameWidth * 2 + plaque.frameMarginX * 2,
          height:
            plaque.height + plaque.frameHeight * 2 + plaque.frameMarginY * 2,
          centerY: plaque.centerY,

          cornerRadius: 1,
          transition: 0.8,
          recess: 0.25,

          frame: {
            outerWidth: plaque.width + plaque.frameWidth * 2,
            outerHeight: plaque.height + plaque.frameHeight * 2,

            innerWidth: plaque.width,
            innerHeight: plaque.height,

            outerCornerRadius: 0.9,
            innerCornerRadius: 0.5,

            raise: 0.22,

            outerTransition: 0.6,
            innerTransition: 0.15,
          },
        },
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

        bottomBevelHeight: 0.5,
        bottomBevelSize: 0.15,
        bottomBevelSegments: 4,
      }),

      plaqueGeometry: createBottlePlaqueGeometry({
        shape: bodyProfile.shape,

        width: plaque.width,
        height: plaque.height,

        centerY: plaque.centerY,

        raise: plaque.raise,

        bevelWidthX: 1.6,
        bevelWidthY: 0.8,
        bevelPower: 0.75,

        cornerRadius: 0.5,

        surfaceOffset: plaque.surfaceOffset,

        segmentsX: 96,
        segmentsY: 32,
      }),

      logoGeometry: createBottleLogoGeometry({
        shape: bodyProfile.shape,
        shapes,

        sourceWidth: 287.01,
        sourceHeight: 57.7,

        width: logo.width,
        centerY: plaque.centerY,

        surfaceOffset: plaque.surfaceOffset + plaque.raise,

        depth: 0.02,

        bevelSize: 0.03,
        bevelThickness: 0.03,
        bevelSegments: 2,
      }),
    };
  }, [svg.paths]);

  const bodyBottom = -body.mainHeight / 2;
  const bodyTop = body.mainHeight / 2;

  const baseY = bodyBottom - body.baseHeight / 2;
  const topY = bodyTop + body.topHeight / 2;

  const domeHeight = 0.2;

  const capY = bodyTop + body.topHeight + domeHeight + bottle.capHeight / 2;

  /*
   * Calculate the actual vertical bounds of the complete bottle.
   */
  const bottleBottom = baseY - body.baseHeight / 2;

  const bottleTop = capY + bottle.capHeight / 2;

  const bottleCenterY = (bottleBottom + bottleTop) / 2;

  return (
    <group position={[0, -bottleCenterY, 0]}>
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

      {/* Plaque */}
      <mesh
        geometry={plaqueGeometry}
        position={[0, 0, 0]}
        castShadow
        receiveShadow
      >
        <BottlePlaqueMaterial />
      </mesh>

      <mesh geometry={logoGeometry} castShadow>
        <meshPhysicalMaterial
          color="#b98b31"
          metalness={1}
          roughness={0.16}
          envMapIntensity={1.4}
        />
      </mesh>

      <mesh position={[0, bottleTop + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[monogramWidth, monogramHeight]} />
        <meshBasicMaterial
          map={monogramTexture}
          transparent
          opacity={0.8}
          depthWrite={false}
        />
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

function BottlePlaqueMaterial() {
  return (
    <meshPhysicalMaterial
      color="#3f7f82"
      metalness={0}
      roughness={0.2}
      envMapIntensity={1.1}
      clearcoat={0.35}
      clearcoatRoughness={0.12}
      side={THREE.DoubleSide}
    />
  );
}
