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
   * How far the central plaque face sits proud
   * of its seating surface.
   */
  raise?: number;

  /**
   * Width of the bevel on the left/right sides.
   */
  bevelWidthX?: number;

  /**
   * Width of the bevel on the top/bottom sides.
   */
  bevelWidthY?: number;

  /**
   * Controls how quickly the bevel rises.
   *
   * < 1 = faster initial rise
   * 1   = neutral
   * > 1 = slower initial rise
   */
  bevelPower?: number;

  /**
   * True circular corner radius.
   */
  cornerRadius?: number;

  /**
   * Number of samples used through each outer corner.
   */
  cornerSegments?: number;

  /**
   * Number of rings through the bevel.
   */
  bevelSegments?: number;

  /**
   * Resolution of the straight sections of each rounded
   * rectangle perimeter.
   */
  horizontalSegments?: number;
  verticalSegments?: number;

  /**
   * Resolution of the flat central face.
   */
  faceSegmentsX?: number;
  faceSegmentsY?: number;

  /**
   * Dense sampling used to reconstruct the front
   * bottle profile.
   */
  shapeSamples?: number;

  /**
   * Additional offset away from the nominal bottle surface.
   */
  surfaceOffset?: number;
}

interface PlaqueRing {
  width: number;
  height: number;
  cornerRadius: number;
  offset: number;
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

  cornerRadius = 0.8,

  cornerSegments = 16,
  bevelSegments = 12,

  horizontalSegments = 24,
  verticalSegments = 6,

  faceSegmentsX = 32,
  faceSegmentsY = 12,

  shapeSamples = 4096,

  surfaceOffset = 0,
}: CreateBottlePlaqueGeometryOptions) {
  const geometry = new THREE.BufferGeometry();

  /*
   * Sample front half of bottle profile.
   *
   * shape X -> world X
   * shape Y -> world Z
   */
  const sourcePoints = shape
    .getSpacedPoints(shapeSamples)
    .filter((point) => point.y >= 0);

  sourcePoints.sort((a, b) => a.x - b.x);

  function getFrontSurfaceAtX(x: number) {
    const clampedX = THREE.MathUtils.clamp(
      x,
      sourcePoints[0].x,
      sourcePoints[sourcePoints.length - 1].x,
    );

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

    const tangent = b.clone().sub(a).normalize();

    const normal = new THREE.Vector2(tangent.y, -tangent.x).normalize();

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

  function addWrappedVertex(localX: number, localY: number, offset: number) {
    const { z: surfaceZ, normal } = getFrontSurfaceAtX(localX);

    const worldX = localX + normal.x * offset;

    const worldY = centerY + localY;

    const worldZ = surfaceZ + normal.y * offset;

    const index = positions.length / 3;

    positions.push(worldX, worldY, worldZ);

    return index;
  }

  /*
   * Build nested rounded-rectangle bevel rings.
   */
  const rings: PlaqueRing[] = [];

  const safeCornerRadius = THREE.MathUtils.clamp(
    cornerRadius,
    0,
    Math.min(width / 2, height / 2),
  );

  for (let i = 0; i <= bevelSegments; i++) {
    const t = i / bevelSegments;

    const ringWidth = width - bevelWidthX * 2 * t;

    const ringHeight = height - bevelWidthY * 2 * t;

    /*
     * Preserve genuine circular corners as the
     * rounded rectangle contracts inward.
     */
    const ringCornerRadius = Math.max(
      0,
      safeCornerRadius - Math.min(bevelWidthX, bevelWidthY) * t,
    );

    const shapedT = Math.pow(Math.sin(t * Math.PI * 0.5), bevelPower);

    rings.push({
      width: ringWidth,
      height: ringHeight,
      cornerRadius: ringCornerRadius,

      offset: surfaceOffset + raise * shapedT,
    });
  }

  /*
   * Generate matching perimeter profiles.
   *
   * Every ring has the exact same point count/order,
   * so they can be stitched one-to-one.
   */
  const ringProfiles = rings.map((ring) =>
    createRoundedRectPerimeter({
      width: ring.width,

      height: ring.height,

      cornerRadius: ring.cornerRadius,

      cornerSegments,

      horizontalSegments,
      verticalSegments,
    }),
  );

  const pointsPerRing = ringProfiles[0].length;

  /*
   * Store vertex indices for each ring.
   */
  const ringIndices: number[][] = [];

  for (let ringIndex = 0; ringIndex < ringProfiles.length; ringIndex++) {
    const ring = rings[ringIndex];

    const profile = ringProfiles[ringIndex];

    const currentIndices: number[] = [];

    for (let i = 0; i < profile.length; i++) {
      const point = profile[i];

      currentIndices.push(addWrappedVertex(point.x, point.y, ring.offset));
    }

    ringIndices.push(currentIndices);
  }

  /*
   * Stitch bevel rings.
   */
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex++) {
    const current = ringIndices[ringIndex];

    const next = ringIndices[ringIndex + 1];

    for (let i = 0; i < pointsPerRing; i++) {
      const j = (i + 1) % pointsPerRing;

      indices.push(
        current[i],
        next[i],
        current[j],

        current[j],
        next[i],
        next[j],
      );
    }
  }

  /*
   * -------------------------------------------------
   * CENTRAL FACE
   * -------------------------------------------------
   *
   * Instead of a triangle fan, build a structured
   * 9-patch fill using shared vertices.
   *
   * The final bevel ring is reused directly as the
   * outer boundary of the face.
   */
  const innerRing = rings[rings.length - 1];

  const innerBoundary = ringIndices[ringIndices.length - 1];

  const innerHalfWidth = innerRing.width / 2;

  const innerHalfHeight = innerRing.height / 2;

  const innerRadius = innerRing.cornerRadius;

  const straightHalfWidth = Math.max(0, innerHalfWidth - innerRadius);

  const straightHalfHeight = Math.max(0, innerHalfHeight - innerRadius);

  /*
   * Create the central rectangular grid.
   *
   * This sits inside the four rounded corners.
   */
  const centerGrid: number[][] = [];

  for (let iy = 0; iy <= faceSegmentsY; iy++) {
    const ty = iy / faceSegmentsY;

    const y = THREE.MathUtils.lerp(-straightHalfHeight, straightHalfHeight, ty);

    const row: number[] = [];

    for (let ix = 0; ix <= faceSegmentsX; ix++) {
      const tx = ix / faceSegmentsX;

      const x = THREE.MathUtils.lerp(-straightHalfWidth, straightHalfWidth, tx);

      row.push(addWrappedVertex(x, y, innerRing.offset));
    }

    centerGrid.push(row);
  }

  /*
   * Fill central rectangular region.
   */
  for (let iy = 0; iy < faceSegmentsY; iy++) {
    for (let ix = 0; ix < faceSegmentsX; ix++) {
      const a = centerGrid[iy][ix];

      const b = centerGrid[iy][ix + 1];

      const c = centerGrid[iy + 1][ix];

      const d = centerGrid[iy + 1][ix + 1];

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

  /*
   * The rounded perimeter profile is generated in
   * this order:
   *
   * top
   * top-right
   * right
   * bottom-right
   * bottom
   * bottom-left
   * left
   * top-left
   *
   * Each section has a known fixed point count.
   */
  const topStart = 0;

  const topRightStart = topStart + horizontalSegments;

  const rightStart = topRightStart + cornerSegments;

  const bottomRightStart = rightStart + verticalSegments;

  const bottomStart = bottomRightStart + cornerSegments;

  const bottomLeftStart = bottomStart + horizontalSegments;

  const leftStart = bottomLeftStart + cornerSegments;

  const topLeftStart = leftStart + verticalSegments;

  /*
   * -------------------------------------------------
   * TOP STRIP
   * -------------------------------------------------
   */
  connectEdgeToGrid({
    boundary: innerBoundary,

    boundaryStart: topStart,

    boundaryCount: horizontalSegments,

    gridEdge: centerGrid[faceSegmentsY],

    indices,

    reverseBoundary: false,
  });

  /*
   * -------------------------------------------------
   * BOTTOM STRIP
   * -------------------------------------------------
   */
  connectEdgeToGrid({
    boundary: innerBoundary,

    boundaryStart: bottomStart,

    boundaryCount: horizontalSegments,

    gridEdge: centerGrid[0],

    indices,

    reverseBoundary: true,
  });

  /*
   * -------------------------------------------------
   * LEFT / RIGHT STRIPS
   * -------------------------------------------------
   */

  const leftGridEdge = centerGrid.map((row) => row[0]);

  const rightGridEdge = centerGrid.map((row) => row[faceSegmentsX]);

  connectEdgeToGrid({
    boundary: innerBoundary,

    boundaryStart: rightStart,

    boundaryCount: verticalSegments,

    gridEdge: rightGridEdge,

    indices,

    reverseBoundary: false,
  });

  connectEdgeToGrid({
    boundary: innerBoundary,

    boundaryStart: leftStart,

    boundaryCount: verticalSegments,

    gridEdge: leftGridEdge,

    indices,

    reverseBoundary: true,
  });

  /*
   * -------------------------------------------------
   * FOUR CORNER PATCHES
   * -------------------------------------------------
   *
   * Each patch runs from the true circular outer corner
   * to the corresponding corner of the central rectangle.
   *
   * This avoids a triangle fan across the whole plaque.
   * Only each small corner patch converges locally,
   * where the geometry is tiny and naturally radial.
   */

  const topRightCenter = centerGrid[faceSegmentsY][faceSegmentsX];

  const bottomRightCenter = centerGrid[0][faceSegmentsX];

  const bottomLeftCenter = centerGrid[0][0];

  const topLeftCenter = centerGrid[faceSegmentsY][0];

  connectCornerPatch({
    boundary: innerBoundary,

    start: topRightStart,

    count: cornerSegments,

    centerIndex: topRightCenter,

    indices,
  });

  connectCornerPatch({
    boundary: innerBoundary,

    start: bottomRightStart,

    count: cornerSegments,

    centerIndex: bottomRightCenter,

    indices,
  });

  connectCornerPatch({
    boundary: innerBoundary,

    start: bottomLeftStart,

    count: cornerSegments,

    centerIndex: bottomLeftCenter,

    indices,
  });

  connectCornerPatch({
    boundary: innerBoundary,

    start: topLeftStart,

    count: cornerSegments,

    centerIndex: topLeftCenter,

    indices,
  });

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );

  geometry.setIndex(indices);

  /*
   * One connected indexed mesh:
   *
   * bevel + face + corners all participate in the
   * same normal calculation.
   */
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

interface CreateRoundedRectPerimeterOptions {
  width: number;
  height: number;
  cornerRadius: number;

  cornerSegments: number;
  horizontalSegments: number;
  verticalSegments: number;
}

/*
 * Explicit rounded rectangle with true circular corners.
 */
function createRoundedRectPerimeter({
  width,
  height,
  cornerRadius,

  cornerSegments,
  horizontalSegments,
  verticalSegments,
}: CreateRoundedRectPerimeterOptions) {
  const points: THREE.Vector2[] = [];

  const halfWidth = width / 2;

  const halfHeight = height / 2;

  const radius = THREE.MathUtils.clamp(
    cornerRadius,
    0,
    Math.min(halfWidth, halfHeight),
  );

  const left = -halfWidth;

  const right = halfWidth;

  const bottom = -halfHeight;

  const top = halfHeight;

  const leftInner = left + radius;

  const rightInner = right - radius;

  const bottomInner = bottom + radius;

  const topInner = top - radius;

  /*
   * Top edge: left -> right
   */
  addLinePoints({
    points,

    x1: leftInner,
    y1: top,

    x2: rightInner,
    y2: top,

    segments: horizontalSegments,
  });

  /*
   * Top-right corner.
   */
  addArcPoints({
    points,

    centerX: rightInner,

    centerY: topInner,

    radius,

    startAngle: Math.PI / 2,

    endAngle: 0,

    segments: cornerSegments,
  });

  /*
   * Right edge: top -> bottom
   */
  addLinePoints({
    points,

    x1: right,
    y1: topInner,

    x2: right,
    y2: bottomInner,

    segments: verticalSegments,
  });

  /*
   * Bottom-right corner.
   */
  addArcPoints({
    points,

    centerX: rightInner,

    centerY: bottomInner,

    radius,

    startAngle: 0,

    endAngle: -Math.PI / 2,

    segments: cornerSegments,
  });

  /*
   * Bottom edge: right -> left
   */
  addLinePoints({
    points,

    x1: rightInner,
    y1: bottom,

    x2: leftInner,
    y2: bottom,

    segments: horizontalSegments,
  });

  /*
   * Bottom-left corner.
   */
  addArcPoints({
    points,

    centerX: leftInner,

    centerY: bottomInner,

    radius,

    startAngle: -Math.PI / 2,

    endAngle: -Math.PI,

    segments: cornerSegments,
  });

  /*
   * Left edge: bottom -> top
   */
  addLinePoints({
    points,

    x1: left,
    y1: bottomInner,

    x2: left,
    y2: topInner,

    segments: verticalSegments,
  });

  /*
   * Top-left corner.
   */
  addArcPoints({
    points,

    centerX: leftInner,

    centerY: topInner,

    radius,

    startAngle: Math.PI,

    endAngle: Math.PI / 2,

    segments: cornerSegments,
  });

  return points;
}

function addLinePoints({
  points,

  x1,
  y1,

  x2,
  y2,

  segments,
}: {
  points: THREE.Vector2[];

  x1: number;
  y1: number;

  x2: number;
  y2: number;

  segments: number;
}) {
  const safeSegments = Math.max(1, Math.floor(segments));

  /*
   * Exclude final point so adjacent section
   * owns the shared boundary vertex.
   */
  for (let i = 0; i < safeSegments; i++) {
    const t = i / safeSegments;

    points.push(
      new THREE.Vector2(
        THREE.MathUtils.lerp(x1, x2, t),
        THREE.MathUtils.lerp(y1, y2, t),
      ),
    );
  }
}

function addArcPoints({
  points,

  centerX,
  centerY,

  radius,

  startAngle,
  endAngle,

  segments,
}: {
  points: THREE.Vector2[];

  centerX: number;
  centerY: number;

  radius: number;

  startAngle: number;
  endAngle: number;

  segments: number;
}) {
  const safeSegments = Math.max(1, Math.floor(segments));

  /*
   * Again, exclude final point so sections meet cleanly
   * without duplicate perimeter vertices.
   */
  for (let i = 0; i < safeSegments; i++) {
    const t = i / safeSegments;

    const angle = THREE.MathUtils.lerp(startAngle, endAngle, t);

    points.push(
      new THREE.Vector2(
        centerX + Math.cos(angle) * radius,

        centerY + Math.sin(angle) * radius,
      ),
    );
  }
}

/*
 * Connect a straight rounded-rect boundary section
 * to one edge of the central grid.
 *
 * Both sides may have different subdivision counts,
 * so we walk them proportionally.
 */
function connectEdgeToGrid({
  boundary,
  boundaryStart,
  boundaryCount,

  gridEdge,

  indices,

  reverseBoundary,
}: {
  boundary: number[];

  boundaryStart: number;
  boundaryCount: number;

  gridEdge: number[];

  indices: number[];

  reverseBoundary: boolean;
}) {
  const boundaryVertices: number[] = [];

  for (let i = 0; i <= boundaryCount; i++) {
    let index = boundaryStart + i;

    index %= boundary.length;

    boundaryVertices.push(boundary[index]);
  }

  if (reverseBoundary) {
    boundaryVertices.reverse();
  }

  /*
   * Bridge two polylines using proportional advancement.
   */
  let bi = 0;
  let gi = 0;

  while (bi < boundaryVertices.length - 1 || gi < gridEdge.length - 1) {
    const nextBProgress = (bi + 1) / Math.max(1, boundaryVertices.length - 1);
    const nextGProgress = (gi + 1) / Math.max(1, gridEdge.length - 1);

    if (
      bi < boundaryVertices.length - 1 &&
      (gi >= gridEdge.length - 1 || nextBProgress <= nextGProgress)
    ) {
      indices.push(
        boundaryVertices[bi],
        gridEdge[gi],
        boundaryVertices[bi + 1],
      );

      bi++;
    } else {
      indices.push(boundaryVertices[bi], gridEdge[gi], gridEdge[gi + 1]);

      gi++;
    }
  }
}

/*
 * Small local fan for one rounded corner.
 *
 * This is very different from the old whole-face pyramid:
 * only the tiny quarter-circle corner patch converges.
 */
function connectCornerPatch({
  boundary,
  start,
  count,
  centerIndex,
  indices,
}: {
  boundary: number[];
  start: number;
  count: number;
  centerIndex: number;
  indices: number[];
}) {
  for (let i = 0; i < count; i++) {
    const a = boundary[(start + i) % boundary.length];

    const b = boundary[(start + i + 1) % boundary.length];

    indices.push(a, centerIndex, b);
  }
}
