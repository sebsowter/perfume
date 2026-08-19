import * as THREE from "three";

export interface CreateProfilePlateGeometryOptions {
  shape: THREE.Shape;

  height: number;

  /**
   * Inset from the source shape at the top face.
   */
  topInset?: number;

  /**
   * Inset from the source shape at the bottom face.
   */
  bottomInset?: number;

  /**
   * Height of the rounded transition at the top/bottom.
   */
  bevelHeight?: number;

  /**
   * Number of rings used for each bevel.
   */
  bevelSegments?: number;

  /**
   * Number of dense samples used to measure/resample
   * the input shape by arc length.
   */
  shapeSamples?: number;

  /**
   * Number of perimeter segments in the final geometry.
   */
  perimeterSegments?: number;

  /**
   * Whether to close the top and bottom faces.
   */
  capTop?: boolean;
  capBottom?: boolean;
}

export function createProfilePlateGeometry({
  shape,

  height,

  topInset = 0,
  bottomInset = 0,

  bevelHeight = 0.6,
  bevelSegments = 6,

  shapeSamples = 4096,
  perimeterSegments = 256,

  capTop = true,
  capBottom = true,
}: CreateProfilePlateGeometryOptions) {
  const geometry = new THREE.BufferGeometry();

  const halfHeight = height / 2;

  /*
   * Densely sample the source shape.
   */
  const sourcePoints = shape.getSpacedPoints(shapeSamples);

  if (
    sourcePoints.length > 1 &&
    sourcePoints[0].distanceTo(sourcePoints[sourcePoints.length - 1]) < 0.000001
  ) {
    sourcePoints.pop();
  }

  /*
   * Measure cumulative arc length.
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
   * Equal-distance perimeter samples.
   */
  const profile: THREE.Vector2[] = [];

  for (let i = 0; i < perimeterSegments; i++) {
    profile.push(getPointAtDistance((i / perimeterSegments) * perimeter));
  }

  /*
   * Compute outward normals once.
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
   * Build vertical rings.
   *
   * We deliberately allow different top/bottom inset values.
   */
  const rings: {
    y: number;
    inset: number;
  }[] = [];

  const safeBevelHeight = Math.min(bevelHeight, height / 2);

  /*
   * Bottom bevel.
   */
  for (let i = 0; i <= bevelSegments; i++) {
    const t = i / bevelSegments;

    rings.push({
      y: -halfHeight + t * safeBevelHeight,

      inset: bottomInset * (1 - roundedEase(t)),
    });
  }

  /*
   * Straight middle ring.
   */
  if (height > safeBevelHeight * 2) {
    rings.push({
      y: halfHeight - safeBevelHeight,
      inset: 0,
    });
  }

  /*
   * Top bevel.
   */
  for (let i = 1; i <= bevelSegments; i++) {
    const t = i / bevelSegments;

    rings.push({
      y: halfHeight - safeBevelHeight + t * safeBevelHeight,

      inset: topInset * roundedEase(t),
    });
  }

  const positions: number[] = [];
  const indices: number[] = [];

  /*
   * Generate perimeter rings.
   */
  for (const ring of rings) {
    for (let i = 0; i < perimeterSegments; i++) {
      const point = profile[i];
      const normal = normals[i];

      const x = point.x - normal.x * ring.inset;

      const z = point.y - normal.y * ring.inset;

      positions.push(x, ring.y, z);
    }
  }

  /*
   * Stitch neighbouring rings.
   */
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex++) {
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

  /*
   * Bottom cap.
   */
  if (capBottom) {
    const bottomCenterIndex = positions.length / 3;

    positions.push(0, -halfHeight, 0);

    for (let i = 0; i < perimeterSegments; i++) {
      const next = (i + 1) % perimeterSegments;

      indices.push(bottomCenterIndex, next, i);
    }
  }

  /*
   * Top cap.
   */
  if (capTop) {
    const topRingStart = (rings.length - 1) * perimeterSegments;

    const topCenterIndex = positions.length / 3;

    positions.push(0, halfHeight, 0);

    for (let i = 0; i < perimeterSegments; i++) {
      const next = (i + 1) % perimeterSegments;

      indices.push(topCenterIndex, topRingStart + i, topRingStart + next);
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

function roundedEase(t: number) {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);

  return 1 - Math.sqrt(Math.max(0, 1 - clamped * clamped));
}
