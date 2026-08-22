// createBottleBodyGeometry.ts

import * as THREE from "three";

export interface BottleBodyBrandingFrameOptions {
  /**
   * Outer dimensions of the raised gold frame.
   */
  outerWidth: number;
  outerHeight: number;

  /**
   * Inner aperture dimensions.
   *
   * The turquoise insert will eventually sit within this area.
   */
  innerWidth: number;
  innerHeight: number;

  /**
   * Rounded corners of the outer edge.
   */
  outerCornerRadius?: number;

  /**
   * Rounded corners of the inner aperture.
   */
  innerCornerRadius?: number;

  /**
   * How far the frame rises outward from the
   * floor of the branding recess.
   */
  raise?: number;

  /**
   * Soft transition from the recessed body
   * up onto the outside of the gold frame.
   */
  outerTransition?: number;

  /**
   * Tight transition around the inner aperture.
   */
  innerTransition?: number;
}

export interface BottleBodyBrandingOptions {
  width: number;
  height: number;
  centerY: number;

  /**
   * Corner radius of the recessed branding region.
   */
  cornerRadius?: number;

  /**
   * Width of the transition from the normal body
   * surface down into the recessed branding region.
   */
  transition?: number;

  /**
   * Independent transition used only for fading the
   * ribs into the branding recess.
   *
   * Smaller values make the ribs terminate more tightly
   * around the branding area without changing the shape
   * of the recess itself.
   */
  ribTransition?: number;

  /**
   * How far the branding landing sits below
   * the nominal bottle surface.
   */
  recess?: number;

  /**
   * Optional raised gold frame inside the recess.
   */
  frame?: BottleBodyBrandingFrameOptions;
}

export interface CreateBottleBodyGeometryOptions {
  shape: THREE.Shape;
  height: number;

  ribCount?: number;
  ribDepth?: number;
  ribSharpness?: number;

  samplesPerRib?: number;
  shapeSamples?: number;

  /**
   * Vertical subdivision of the body.
   *
   * Needed for smooth branding/recess/frame transitions.
   */
  verticalSegments?: number;

  bevelHeight?: number;
  bevelInset?: number;

  branding?: BottleBodyBrandingOptions;
}

export function createBottleBodyGeometry({
  shape,
  height,

  ribCount = 70,
  ribDepth = 0.5,
  ribSharpness = 2,

  samplesPerRib = 10,
  shapeSamples = 4096,
  verticalSegments = 160,

  bevelHeight = 1.5,
  bevelInset = 0.8,

  branding,
}: CreateBottleBodyGeometryOptions) {
  const geometry = new THREE.BufferGeometry();

  const halfHeight = height / 2;

  /*
   * Sample source shape densely.
   */
  const sourcePoints = shape.getSpacedPoints(shapeSamples);

  if (
    sourcePoints.length > 1 &&
    sourcePoints[0].distanceTo(sourcePoints[sourcePoints.length - 1]) < 0.000001
  ) {
    sourcePoints.pop();
  }

  /*
   * Measure cumulative perimeter distance.
   */
  const cumulativeDistances: number[] = [0];

  let perimeter = 0;

  for (let i = 1; i < sourcePoints.length; i++) {
    perimeter += sourcePoints[i].distanceTo(sourcePoints[i - 1]);

    cumulativeDistances.push(perimeter);
  }

  perimeter += sourcePoints[sourcePoints.length - 1].distanceTo(
    sourcePoints[0],
  );

  /*
   * Tie perimeter resolution directly to the rib count.
   *
   * This keeps every rib equally spaced by real arc length
   * around the superellipse.
   */
  const perimeterSegments = ribCount * samplesPerRib;

  const segmentLength = perimeter / perimeterSegments;

  function getPointAtDistance(distance: number) {
    const d = ((distance % perimeter) + perimeter) % perimeter;

    let index = 0;

    while (
      index < cumulativeDistances.length - 1 &&
      cumulativeDistances[index + 1] <= d
    ) {
      index++;
    }

    const nextIndex = (index + 1) % sourcePoints.length;

    const a = sourcePoints[index];
    const b = sourcePoints[nextIndex];

    const startDistance = cumulativeDistances[index];

    const endDistance =
      nextIndex === 0 ? perimeter : cumulativeDistances[nextIndex];

    const sectionLength = endDistance - startDistance;

    const t = sectionLength > 0 ? (d - startDistance) / sectionLength : 0;

    return new THREE.Vector2(
      THREE.MathUtils.lerp(a.x, b.x, t),
      THREE.MathUtils.lerp(a.y, b.y, t),
    );
  }

  /*
   * Resample profile at equal arc-length intervals.
   */
  const profile: THREE.Vector2[] = [];

  for (let i = 0; i < perimeterSegments; i++) {
    profile.push(getPointAtDistance(i * segmentLength));
  }

  /*
   * Cache outward normals.
   */
  const normals: THREE.Vector2[] = [];

  for (let i = 0; i < perimeterSegments; i++) {
    const previous = profile[(i - 1 + perimeterSegments) % perimeterSegments];

    const current = profile[i];

    const next = profile[(i + 1) % perimeterSegments];

    const tangent = next.clone().sub(previous).normalize();

    const normal = new THREE.Vector2(tangent.y, -tangent.x).normalize();

    if (normal.dot(current) < 0) {
      normal.multiplyScalar(-1);
    }

    normals.push(normal);
  }

  const positions: number[] = [];
  const indices: number[] = [];

  /*
   * Generate evenly spaced vertical rings.
   */
  const ringCount = verticalSegments + 1;

  for (let ringIndex = 0; ringIndex < ringCount; ringIndex++) {
    const verticalT = ringIndex / verticalSegments;

    const y = -halfHeight + verticalT * height;

    /*
     * Existing top/bottom body roundover.
     */
    const bodyInset = getBodyInset({
      y,
      halfHeight,
      bevelHeight,
      bevelInset,
    });

    for (let i = 0; i < perimeterSegments; i++) {
      const current = profile[i];
      const normal = normals[i];

      /*
       * Rib profile.
       */
      const ribSample = i % samplesPerRib;

      const ribT = ribSample / samplesPerRib;

      const wave = (Math.cos(ribT * Math.PI * 2) + 1) / 2;

      const baseGroove = Math.pow(wave, ribSharpness) * ribDepth;

      /*
       * Our profile uses shape Y as world Z.
       *
       * Positive profile Y is the front face.
       */
      const isFront = current.y > 0;

      /*
       * BRANDING RECESS MASK
       *
       * Controls the actual recessed landing.
       */
      const brandingMask =
        branding && isFront
          ? getRoundedRectMask({
              x: current.x,
              y,

              width: branding.width,

              height: branding.height,

              centerX: 0,

              centerY: branding.centerY,

              cornerRadius: branding.cornerRadius ?? 1,

              transition: branding.transition ?? 0.8,
            })
          : 0;

      /*
       * RIB MASK
       *
       * Independent from brandingMask so the rib
       * termination can be tighter than the recess.
       */
      const ribMask =
        branding && isFront
          ? getRoundedRectMask({
              x: current.x,
              y,

              width: branding.width,

              height: branding.height,

              centerX: 0,

              centerY: branding.centerY,

              cornerRadius: branding.cornerRadius ?? 1,

              transition: branding.ribTransition ?? branding.transition ?? 0.8,
            })
          : 0;

      /*
       * Fade only the rib depth using the dedicated
       * rib mask.
       */
      const groove = baseGroove * (1 - ribMask);

      /*
       * Recess remains controlled by the broader
       * branding mask.
       */
      const brandingRecess = brandingMask * (branding?.recess ?? 0);

      /*
       * GOLD FRAME
       *
       * Defined by the difference between two independently
       * softened rounded rectangles.
       */
      let frameMask = 0;

      if (branding && branding.frame && isFront) {
        const frame = branding.frame;

        const outerMask = getRoundedRectMask({
          x: current.x,
          y,

          width: frame.outerWidth,

          height: frame.outerHeight,

          centerX: 0,

          centerY: branding.centerY,

          cornerRadius: frame.outerCornerRadius ?? 1,

          transition: frame.outerTransition ?? 0.6,
        });

        const innerMask = getRoundedRectMask({
          x: current.x,
          y,

          width: frame.innerWidth,

          height: frame.innerHeight,

          centerX: 0,

          centerY: branding.centerY,

          cornerRadius: frame.innerCornerRadius ?? 0.6,

          transition: frame.innerTransition ?? 0.15,
        });

        /*
         * Outer rounded rectangle minus inner aperture.
         *
         * Keep the frame constrained to the branding recess.
         */
        frameMask = THREE.MathUtils.clamp(
          outerMask * (1 - innerMask) * brandingMask,
          0,
          1,
        );
      }

      /*
       * Raise the gold frame outward from the
       * floor of the recess.
       */
      const frameRaise = frameMask * (branding?.frame?.raise ?? 0);

      /*
       * Final displacement from the underlying
       * superellipse profile.
       *
       * Positive values represent inward movement:
       *
       * bodyInset      -> inward
       * groove         -> inward
       * brandingRecess -> inward
       * frameRaise     -> outward
       */
      const totalInset = bodyInset + groove + brandingRecess - frameRaise;

      const x = current.x - normal.x * totalInset;

      const z = current.y - normal.y * totalInset;

      positions.push(x, y, z);
    }
  }

  /*
   * Stitch neighbouring vertical rings.
   */
  for (let ringIndex = 0; ringIndex < ringCount - 1; ringIndex++) {
    const currentRingStart = ringIndex * perimeterSegments;

    const nextRingStart = (ringIndex + 1) * perimeterSegments;

    for (let i = 0; i < perimeterSegments; i++) {
      const next = (i + 1) % perimeterSegments;

      const a = currentRingStart + i;

      const b = currentRingStart + next;

      const c = nextRingStart + i;

      const d = nextRingStart + next;

      indices.push(
        a,
        b,
        c,

        c,
        b,
        d,
      );
    }
  }

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );

  geometry.setIndex(indices);

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/*
 * Top/bottom roundover of the main ribbed body.
 */
function getBodyInset({
  y,
  halfHeight,
  bevelHeight,
  bevelInset,
}: {
  y: number;
  halfHeight: number;
  bevelHeight: number;
  bevelInset: number;
}) {
  /*
   * Bottom roundover.
   */
  if (y < -halfHeight + bevelHeight) {
    const t = (y + halfHeight) / bevelHeight;

    return bevelInset * quarterCircleEase(1 - t);
  }

  /*
   * Top roundover.
   */
  if (y > halfHeight - bevelHeight) {
    const t = (y - (halfHeight - bevelHeight)) / bevelHeight;

    return bevelInset * quarterCircleEase(t);
  }

  return 0;
}

/*
 * Rounded rectangle mask.
 *
 * Returns:
 *
 * 1 = inside
 * 0 = outside
 *
 * with a smooth transition across the edge.
 */
function getRoundedRectMask({
  x,
  y,

  width,
  height,

  centerX,
  centerY,

  cornerRadius,
  transition,
}: {
  x: number;
  y: number;

  width: number;
  height: number;

  centerX: number;
  centerY: number;

  cornerRadius: number;
  transition: number;
}) {
  const halfWidth = width / 2;

  const halfHeight = height / 2;

  const radius = Math.min(cornerRadius, halfWidth, halfHeight);

  const localX = x - centerX;

  const localY = y - centerY;

  /*
   * Standard rounded-rectangle signed distance.
   *
   * Negative = inside.
   * Positive = outside.
   */
  const qx = Math.abs(localX) - (halfWidth - radius);

  const qy = Math.abs(localY) - (halfHeight - radius);

  const outsideX = Math.max(qx, 0);

  const outsideY = Math.max(qy, 0);

  const outsideDistance = Math.sqrt(outsideX * outsideX + outsideY * outsideY);

  const insideDistance = Math.min(Math.max(qx, qy), 0);

  const distance = outsideDistance + insideDistance - radius;

  if (transition <= 0) {
    return distance <= 0 ? 1 : 0;
  }

  return 1 - smoothstep(-transition, transition, distance);
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);

  return t * t * (3 - 2 * t);
}

/*
 * Quarter-circle-like easing.
 *
 * 0 -> 0
 * 1 -> 1
 */
function quarterCircleEase(t: number) {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);

  return 1 - Math.sqrt(Math.max(0, 1 - clamped * clamped));
}
