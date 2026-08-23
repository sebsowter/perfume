// createBottleBodyGeometry.ts

import * as THREE from "three";

export interface BottleBodyBrandingFrameOptions {
  outerWidth: number;
  outerHeight: number;

  innerWidth: number;
  innerHeight: number;

  outerCornerRadius?: number;
  innerCornerRadius?: number;

  raise?: number;

  outerTransition?: number;
  innerTransition?: number;
}

export interface BottleBodyBrandingOptions {
  width: number;
  height: number;
  centerY: number;

  cornerRadius?: number;

  /**
   * Transition of the recessed branding area itself.
   */
  transition?: number;

  /**
   * Independent transition used only for fading
   * the ribs into the branding recess.
   */
  ribTransition?: number;

  recess?: number;

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
   * Vertical detail resolution around the branding area.
   */
  brandingSegments?: number;

  /**
   * Vertical resolution of each top/bottom roundover.
   */
  bevelSegments?: number;

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

  brandingSegments = 40,
  bevelSegments = 8,

  bevelHeight = 1.5,
  bevelInset = 0.8,

  branding,
}: CreateBottleBodyGeometryOptions) {
  const geometry = new THREE.BufferGeometry();

  const halfHeight = height / 2;

  /*
   * --------------------------------------------------------
   * SOURCE PROFILE
   * --------------------------------------------------------
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
   * Keep perimeter resolution tied directly to ribs.
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
   * Equal arc-length samples around the profile.
   */
  const profile: THREE.Vector2[] = [];

  for (let i = 0; i < perimeterSegments; i++) {
    profile.push(getPointAtDistance(i * segmentLength));
  }

  /*
   * Cache outward profile normals.
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

  /*
   * --------------------------------------------------------
   * ADAPTIVE VERTICAL SAMPLING
   * --------------------------------------------------------
   */

  const yPositions = createAdaptiveYPositions({
    halfHeight,

    bevelHeight,
    bevelSegments,

    branding,
    brandingSegments,
  });

  const positions: number[] = [];
  const indices: number[] = [];

  /*
   * --------------------------------------------------------
   * GENERATE VERTICAL RINGS
   * --------------------------------------------------------
   */

  for (const y of yPositions) {
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
       * shape Y becomes world Z.
       *
       * Positive shape Y is the front.
       */
      const isFront = current.y > 0;

      /*
       * ----------------------------------------------------
       * BRANDING RECESS
       * ----------------------------------------------------
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
       * Independent rib termination mask.
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

      const groove = baseGroove * (1 - ribMask);

      const brandingRecess = brandingMask * (branding?.recess ?? 0);

      /*
       * ----------------------------------------------------
       * GOLD FRAME
       * ----------------------------------------------------
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

        frameMask = THREE.MathUtils.clamp(
          outerMask * (1 - innerMask) * brandingMask,
          0,
          1,
        );
      }

      const frameRaise = frameMask * (branding?.frame?.raise ?? 0);

      /*
       * Final displacement from the underlying profile.
       *
       * Positive values = inward.
       */
      const totalInset = bodyInset + groove + brandingRecess - frameRaise;

      const x = current.x - normal.x * totalInset;

      const z = current.y - normal.y * totalInset;

      positions.push(x, y, z);
    }
  }

  /*
   * --------------------------------------------------------
   * STITCH RINGS
   * --------------------------------------------------------
   *
   * IMPORTANT:
   *
   * Winding is deliberately counter-clockwise when
   * viewed from OUTSIDE the bottle.
   *
   * This means THREE.FrontSide renders the exterior.
   */

  const ringCount = yPositions.length;

  for (let ringIndex = 0; ringIndex < ringCount - 1; ringIndex++) {
    const currentRingStart = ringIndex * perimeterSegments;

    const nextRingStart = (ringIndex + 1) * perimeterSegments;

    for (let i = 0; i < perimeterSegments; i++) {
      const next = (i + 1) % perimeterSegments;

      const a = currentRingStart + i;

      const b = currentRingStart + next;

      const c = nextRingStart + i;

      const d = nextRingStart + next;

      /*
       * Flipped from the previous winding:
       *
       * old:
       * a, b, c
       * c, b, d
       *
       * new:
       * a, c, b
       * c, d, b
       */
      indices.push(
        a,
        c,
        b,

        c,
        d,
        b,
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
 * ----------------------------------------------------------
 * ADAPTIVE Y SAMPLING
 * ----------------------------------------------------------
 */

function createAdaptiveYPositions({
  halfHeight,

  bevelHeight,
  bevelSegments,

  branding,
  brandingSegments,
}: {
  halfHeight: number;

  bevelHeight: number;
  bevelSegments: number;

  branding?: BottleBodyBrandingOptions;
  brandingSegments: number;
}) {
  const values: number[] = [];

  const bottom = -halfHeight;

  const top = halfHeight;

  const bottomBevelEnd = Math.min(top, bottom + bevelHeight);

  const topBevelStart = Math.max(bottom, top - bevelHeight);

  /*
   * Bottom body roundover.
   */
  addRangeSamples({
    values,

    start: bottom,
    end: bottomBevelEnd,

    segments: bevelSegments,
  });

  /*
   * Branding/detail region.
   */
  if (branding) {
    const transitionMargin = Math.max(
      branding.transition ?? 0.8,

      branding.ribTransition ?? branding.transition ?? 0.8,

      branding.frame?.outerTransition ?? 0,

      branding.frame?.innerTransition ?? 0,
    );

    const brandingBottom =
      branding.centerY - branding.height / 2 - transitionMargin;

    const brandingTop =
      branding.centerY + branding.height / 2 + transitionMargin;

    const detailStart = THREE.MathUtils.clamp(
      brandingBottom,
      bottomBevelEnd,
      topBevelStart,
    );

    const detailEnd = THREE.MathUtils.clamp(
      brandingTop,
      bottomBevelEnd,
      topBevelStart,
    );

    /*
     * One ring marks the start of the detailed area.
     *
     * The large straight region before it can be
     * represented by a single quad strip.
     */
    addUniqueY(values, detailStart);

    /*
     * Dense geometry only through the branding area.
     */
    addRangeSamples({
      values,

      start: detailStart,
      end: detailEnd,

      segments: brandingSegments,
    });

    addUniqueY(values, detailEnd);
  }

  /*
   * Straight body terminates at start of top bevel.
   */
  addUniqueY(values, topBevelStart);

  /*
   * Top body roundover.
   */
  addRangeSamples({
    values,

    start: topBevelStart,
    end: top,

    segments: bevelSegments,
  });

  values.sort((a, b) => a - b);

  /*
   * Remove near-duplicates created where regions meet.
   */
  return values.filter(
    (value, index) =>
      index === 0 || Math.abs(value - values[index - 1]) > 0.000001,
  );
}

function addRangeSamples({
  values,

  start,
  end,

  segments,
}: {
  values: number[];

  start: number;
  end: number;

  segments: number;
}) {
  if (Math.abs(end - start) < 0.000001) {
    addUniqueY(values, start);

    return;
  }

  const safeSegments = Math.max(1, Math.floor(segments));

  for (let i = 0; i <= safeSegments; i++) {
    const t = i / safeSegments;

    addUniqueY(values, THREE.MathUtils.lerp(start, end, t));
  }
}

function addUniqueY(values: number[], value: number) {
  for (let i = 0; i < values.length; i++) {
    if (Math.abs(values[i] - value) < 0.000001) {
      return;
    }
  }

  values.push(value);
}

/*
 * ----------------------------------------------------------
 * BODY ROUNDOVER
 * ----------------------------------------------------------
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
 * ----------------------------------------------------------
 * ROUNDED RECT MASK
 * ----------------------------------------------------------
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
 */
function quarterCircleEase(t: number) {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);

  return 1 - Math.sqrt(Math.max(0, 1 - clamped * clamped));
}
