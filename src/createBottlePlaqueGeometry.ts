// createBottlePlaqueGeometry.ts

import * as THREE from "three";

export interface CreateBottlePlaqueGeometryOptions {
  shape: THREE.Shape;

  width: number;
  height: number;

  /**
   * Vertical position relative to the bottle body centre.
   */
  centerY: number;

  /**
   * How far the centre/top surface of the plaque
   * sits proud of its seating surface.
   */
  raise?: number;

  /**
   * Width of the soft bevel on the left/right edges.
   */
  bevelWidthX?: number;

  /**
   * Width of the soft bevel on the top/bottom edges.
   */
  bevelWidthY?: number;

  /**
   * Controls how quickly the bevel rises.
   *
   * < 1 = rises quickly, then eases gradually
   * 1   = sine-style easing
   * > 1 = slower initial rise
   */
  bevelPower?: number;

  /**
   * Rounded rectangle corner radius.
   */
  cornerRadius?: number;

  /**
   * Horizontal and vertical mesh resolution.
   */
  segmentsX?: number;
  segmentsY?: number;

  /**
   * Dense sampling used to reconstruct the front
   * surface of the supplied bottle profile.
   */
  shapeSamples?: number;

  /**
   * Additional offset away from the bottle surface.
   *
   * This positions the whole plaque relative to the
   * recessed landing/frame without affecting the bevel.
   */
  surfaceOffset?: number;
}

export function createBottlePlaqueGeometry({
  shape,

  width,
  height,
  centerY,

  raise = 0.35,

  bevelWidthX = 1.4,
  bevelWidthY = 0.8,

  bevelPower = 0.55,

  cornerRadius = 0.5,

  segmentsX = 96,
  segmentsY = 32,

  shapeSamples = 4096,

  surfaceOffset = 0,
}: CreateBottlePlaqueGeometryOptions) {
  const geometry = new THREE.BufferGeometry();

  const halfWidth = width / 2;
  const halfHeight = height / 2;

  /*
   * Sample the bottle profile densely.
   *
   * We only need the front half:
   *
   * shape X -> world X
   * shape Y -> world Z
   */
  const sourcePoints = shape
    .getSpacedPoints(shapeSamples)
    .filter((point) => point.y >= 0);

  /*
   * Sort by X so we can efficiently interpolate
   * the front surface at arbitrary horizontal positions.
   */
  sourcePoints.sort((a, b) => a.x - b.x);

  /*
   * Find the underlying bottle surface and its
   * outward normal at a particular X position.
   */
  function getFrontSurfaceAtX(x: number) {
    const clampedX = THREE.MathUtils.clamp(
      x,
      sourcePoints[0].x,
      sourcePoints[sourcePoints.length - 1].x,
    );

    /*
     * Binary search for the two neighbouring
     * profile samples.
     */
    let low = 0;
    let high = sourcePoints.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);

      if (sourcePoints[mid].x < clampedX) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const upperIndex = THREE.MathUtils.clamp(low, 1, sourcePoints.length - 1);

    const lowerIndex = upperIndex - 1;

    const a = sourcePoints[lowerIndex];

    const b = sourcePoints[upperIndex];

    const span = b.x - a.x;

    const t = Math.abs(span) > 0.000001 ? (clampedX - a.x) / span : 0;

    const z = THREE.MathUtils.lerp(a.y, b.y, t);

    /*
     * Tangent along the front profile.
     */
    const tangent = b.clone().sub(a).normalize();

    /*
     * Perpendicular gives us the local surface normal.
     */
    const normal = new THREE.Vector2(tangent.y, -tangent.x).normalize();

    /*
     * Ensure it points toward the front/outside.
     */
    if (normal.y < 0) {
      normal.multiplyScalar(-1);
    }

    return {
      z,
      normal,
    };
  }

  const positions: number[] = [];
  const indices: number[] = [];

  /*
   * Generate a rectangular grid.
   *
   * Every grid point is projected onto the curved
   * superellipse surface and then displaced outward
   * according to the plaque's bevel.
   */
  for (let iy = 0; iy <= segmentsY; iy++) {
    const ty = iy / segmentsY;

    const localY = -halfHeight + ty * height;

    const worldY = centerY + localY;

    for (let ix = 0; ix <= segmentsX; ix++) {
      const tx = ix / segmentsX;

      const x = -halfWidth + tx * width;

      const { z: surfaceZ, normal } = getFrontSurfaceAtX(x);

      /*
       * Calculate progress through the bevel.
       *
       * This uses two nested rounded rectangles:
       *
       * outer = physical plaque boundary
       * inner = point where full plaque height begins
       *
       * Because X and Y are inset independently,
       * the side bevel can be wider than the
       * top/bottom bevel.
       */
      const bevelT = getBevelProgress({
        x,
        y: localY,

        halfWidth,
        halfHeight,

        cornerRadius,

        bevelWidthX,
        bevelWidthY,
      });

      /*
       * Fast initial rise followed by a long,
       * soft transition toward the main surface.
       *
       * Lower bevelPower values make the initial
       * rise steeper.
       */
      const shapedT = Math.pow(Math.sin(bevelT * Math.PI * 0.5), bevelPower);

      const plaqueRaise = raise * shapedT;

      const totalOffset = surfaceOffset + plaqueRaise;

      /*
       * Move outward along the local superellipse normal.
       *
       * This means the plaque follows the bottle curvature
       * rather than becoming a flat rectangular plate.
       */
      const worldX = x + normal.x * totalOffset;

      const worldZ = surfaceZ + normal.y * totalOffset;

      positions.push(worldX, worldY, worldZ);
    }
  }

  /*
   * Stitch the rectangular grid.
   */
  const rowSize = segmentsX + 1;

  for (let iy = 0; iy < segmentsY; iy++) {
    for (let ix = 0; ix < segmentsX; ix++) {
      const a = iy * rowSize + ix;

      const b = a + 1;

      const c = (iy + 1) * rowSize + ix;

      const d = c + 1;

      indices.push(
        a,
        c,
        b,

        b,
        c,
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
 * Calculate how far a point has progressed through
 * the plaque bevel.
 *
 * 0 = physical outer edge
 * 1 = full-height central surface
 *
 * We use two nested rounded rectangles rather than
 * independent linear X/Y distances. This preserves
 * a continuous bevel around the rounded corners.
 */
function getBevelProgress({
  x,
  y,

  halfWidth,
  halfHeight,

  cornerRadius,

  bevelWidthX,
  bevelWidthY,
}: {
  x: number;
  y: number;

  halfWidth: number;
  halfHeight: number;

  cornerRadius: number;

  bevelWidthX: number;
  bevelWidthY: number;
}) {
  /*
   * Distance from the outer physical boundary.
   */
  const outerDistance = roundedRectSignedDistance({
    x,
    y,

    halfWidth,
    halfHeight,

    cornerRadius,
  });

  /*
   * Outside the plaque entirely.
   *
   * Our generated grid should only just touch this
   * condition at the rounded corners.
   */
  if (outerDistance > 0) {
    return 0;
  }

  /*
   * Inner rounded rectangle.
   *
   * This represents where the bevel has completely
   * finished and the main plaque surface begins.
   */
  const innerHalfWidth = Math.max(0, halfWidth - bevelWidthX);

  const innerHalfHeight = Math.max(0, halfHeight - bevelWidthY);

  /*
   * Reduce the inner corner radius as the bevel
   * moves inward.
   *
   * Using the smaller bevel width keeps the corner
   * transition stable when X and Y bevel widths differ.
   */
  const innerCornerRadius = Math.max(
    0,
    cornerRadius - Math.min(bevelWidthX, bevelWidthY),
  );

  const innerDistance = roundedRectSignedDistance({
    x,
    y,

    halfWidth: innerHalfWidth,

    halfHeight: innerHalfHeight,

    cornerRadius: innerCornerRadius,
  });

  /*
   * Inside the inner rectangle we're fully onto
   * the raised central surface.
   */
  if (innerDistance <= 0) {
    return 1;
  }

  /*
   * Interpolate continuously between the outer
   * and inner rounded rectangles.
   */
  const outerDepth = Math.max(0.000001, -outerDistance);

  return THREE.MathUtils.clamp(outerDepth / (outerDepth + innerDistance), 0, 1);
}

/*
 * Signed distance to a rounded rectangle.
 *
 * < 0 = inside
 *   0 = boundary
 * > 0 = outside
 */
function roundedRectSignedDistance({
  x,
  y,

  halfWidth,
  halfHeight,

  cornerRadius,
}: {
  x: number;
  y: number;

  halfWidth: number;
  halfHeight: number;

  cornerRadius: number;
}) {
  const radius = Math.min(cornerRadius, halfWidth, halfHeight);

  const qx = Math.abs(x) - (halfWidth - radius);

  const qy = Math.abs(y) - (halfHeight - radius);

  const outsideX = Math.max(qx, 0);

  const outsideY = Math.max(qy, 0);

  const outsideDistance = Math.sqrt(outsideX * outsideX + outsideY * outsideY);

  const insideDistance = Math.min(Math.max(qx, qy), 0);

  return outsideDistance + insideDistance - radius;
}
