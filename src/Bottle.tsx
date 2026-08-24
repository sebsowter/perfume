import { forwardRef, useMemo } from "react";
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

  capWidth: 22,
  capHeight: 26.4,
};

const body = {
  /*
   * Spec:
   *
   * Main bottle section = 81.5 mm
   * Bottom detail       =  2.5 mm
   * Top/shoulder total  =  2.5 mm
   *
   * Our top geometry adds domeHeight ABOVE topHeight,
   * therefore:
   *
   * 2.3 + 0.2 = 2.5 mm
   */
  mainHeight: 81.5,

  topHeight: 2.3,
  domeHeight: 0.3,

  baseHeight: 2.5,
};

const plaque = {
  /*
   * Previously:
   *
   * mainHeight = 76
   * bodyBottom = -38
   * centerY    = -26
   *
   * Therefore plaque centre was 12 mm above
   * the bottom of the main ribbed body.
   *
   * Preserve that physical relationship now that
   * mainHeight is correctly 81.5 mm:
   *
   * -81.5 / 2 + 12 = -28.75
   */
  centerY: -28.75,

  surfaceOffset: -0.03,
  raise: 0.1,

  width: 39,
  height: 11,

  frameWidth: 0.5,
  frameHeight: 0.5,

  frameMarginX: 0.4,
  frameMarginY: 0.8,
};

const logo = {
  width: 27,
};

export const Bottle = forwardRef<THREE.Group>(function Bottle(_props, ref) {
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
      width: bottle.width - 1,
      depth: bottle.depth - 1,

      exponent: 2.8,
      segments: 256,
    });

    const baseProfile = createSuperellipseProfile({
      width: bottle.width - 1,
      depth: bottle.depth - 1,

      exponent: 2.8,
      segments: 256,
    });

    return {
      bodyGeometry: createBottleBodyGeometry({
        shape: bodyProfile.shape,
        height: body.mainHeight,

        ribCount: 80,
        ribDepth: 0.5,
        ribSharpness: 1.4,
        samplesPerRib: 8,

        brandingSegments: 40,
        bevelSegments: 8,

        bevelHeight: 1.5,
        bevelInset: 0.8,

        branding: {
          width: plaque.width + plaque.frameWidth * 2 + plaque.frameMarginX * 2,

          height:
            plaque.height + plaque.frameHeight * 2 + plaque.frameMarginY * 2,

          centerY: plaque.centerY,

          cornerRadius: 1.5,

          transition: 0.8,
          ribTransition: 0.35,

          recess: 0.15,

          frame: {
            outerWidth: plaque.width + plaque.frameWidth * 2,

            outerHeight: plaque.height + plaque.frameHeight * 2,

            innerWidth: plaque.width,

            innerHeight: plaque.height,

            outerCornerRadius: 0.8,
            innerCornerRadius: 0.5,

            raise: 0.3,

            outerTransition: 0.8,
            innerTransition: 0.15,
          },
        },
      }),

      /*
       * Total top/shoulder height must be 2.5 mm.
       *
       * createBottleTopGeometry adds domeHeight above
       * the supplied geometry height:
       *
       * 2.3 + 0.2 = 2.5 mm
       */
      topGeometry: createBottleTopGeometry({
        shape: topProfile.shape,

        height: body.topHeight,

        bevelHeight: 0.7,
        bevelSize: 0.45,
        bevelSegments: 8,

        domeHeight: body.domeHeight,

        domeSegments: 12,
      }),

      baseGeometry: createBottleBaseGeometry({
        shape: baseProfile.shape,

        height: body.baseHeight,

        bevelHeight: 0.7,
        bevelSize: 0.45,
        bevelSegments: 8,
      }),

      capGeometry: createBottleCapGeometry({
        radius: bottle.capWidth / 2,

        height: bottle.capHeight,

        ridges: 70,
        ridgeDepth: 0.1,
        samplesPerRidge: 8,

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

        bevelWidthX: 1,
        bevelWidthY: 0.8,

        bevelPower: 0.35,

        cornerRadius: 0.5,

        cornerSegments: 16,
        bevelSegments: 12,

        horizontalSegments: 32,
        verticalSegments: 8,

        faceSegmentsX: 32,
        faceSegmentsY: 12,

        surfaceOffset: plaque.surfaceOffset,
      }),

      logoGeometry: createBottleLogoGeometry({
        shape: bodyProfile.shape,

        sourceWidth: 1208,
        sourceHeight: 253,

        width: logo.width,
        centerY: plaque.centerY,

        surfaceOffset: plaque.surfaceOffset + plaque.raise + 0.02,

        segmentsX: 32,
        segmentsY: 1,
      }),
    };
  }, [svg.paths]);

  /*
   * --------------------------------------------------------
   * VERTICAL STACK
   * --------------------------------------------------------
   *
   * Main ribbed body is centred around local Y = 0.
   */

  const bodyBottom = -body.mainHeight / 2;

  const bodyTop = body.mainHeight / 2;

  /*
   * BASE
   *
   * Base top touches body bottom exactly.
   */
  const baseTop = bodyBottom;

  const baseBottom = baseTop - body.baseHeight;

  const baseY = (baseBottom + baseTop) / 2;

  /*
   * TOP / SHOULDER
   *
   * Flat bottom of top geometry touches
   * main body top exactly.
   */
  const topBottom = bodyTop;

  const topY = topBottom + body.topHeight / 2;

  /*
   * The top geometry reaches:
   *
   * bodyTop
   * + topHeight
   * + domeHeight
   *
   * = 2.5 mm above the main body.
   */
  const domeTop = bodyTop + body.topHeight + body.domeHeight;

  /*
   * CAP
   *
   * Bottom of cap touches the peak of the dome exactly.
   */
  const capBottom = domeTop;

  const capY = capBottom + bottle.capHeight / 2;

  const capTop = capBottom + bottle.capHeight;

  /*
   * Complete bottle bounds.
   */
  const bottleBottom = baseBottom;

  const bottleTop = capTop;

  /*
   * Centre the complete assembled bottle around Y = 0.
   */
  const bottleCenterY = (bottleBottom + bottleTop) / 2;

  return (
    <group position={[0, -bottleCenterY, 0]} ref={ref}>
      {/* Main ribbed body */}
      <mesh geometry={bodyGeometry}>
        <BottleBodyMaterial />
      </mesh>

      {/* Smooth top / shoulder */}
      <mesh geometry={topGeometry} position={[0, topY, 0]}>
        <BottlePlateMaterial />
      </mesh>

      {/* Smooth base */}
      <mesh geometry={baseGeometry} position={[0, baseY, 0]}>
        <BottlePlateMaterial />
      </mesh>

      {/* Cap */}
      <mesh geometry={capGeometry} position={[0, capY, 0]}>
        <BottleCapMaterial />
      </mesh>

      {/* Plaque */}
      <mesh geometry={plaqueGeometry}>
        <BottlePlaqueMaterial />
      </mesh>

      {/* Logo */}
      <mesh geometry={logoGeometry}>
        <BottleLogoMaterial />
      </mesh>

      {/* Monogram */}
      <mesh position={[0, bottleTop + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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
});

function BottleBodyMaterial() {
  return (
    <meshStandardMaterial
      color="#b88a32"
      metalness={1}
      roughness={0.24}
      envMapIntensity={1.15}
    />
  );
}

function BottlePlateMaterial() {
  return (
    <meshStandardMaterial
      color="#b98b31"
      metalness={1}
      roughness={0.19}
      envMapIntensity={1.2}
    />
  );
}

function BottleCapMaterial() {
  return (
    <meshStandardMaterial
      color="#b78a31"
      metalness={1}
      roughness={0.15}
      envMapIntensity={1.25}
    />
  );
}

function BottlePlaqueMaterial() {
  return (
    <meshPhysicalMaterial
      color="#295e60"
      metalness={0}
      roughness={0.38}
      envMapIntensity={1.05}
      clearcoat={0.65}
      clearcoatRoughness={0.15}
    />
  );
}

function BottleLogoMaterial() {
  const texture = useTexture("/perfume/Hotel_Portofino_Logo.png");

  return (
    <meshStandardMaterial
      map={texture}
      color="#c79a43"
      metalness={1}
      roughness={0.3}
      envMapIntensity={1.15}
      transparent
      alphaTest={0.1}
      depthWrite={false}
    />
  );
}
