import * as THREE from "three";

export interface CreateBottleBaseGeometryOptions {
  shape: THREE.Shape;
  height: number;

  bevelHeight?: number;
  bevelSize?: number;
  bevelSegments?: number;

  perimeterSegments?: number;
  shapeSamples?: number;
}

export function createBottleBaseGeometry({
  shape,
  height,

  bevelHeight = 0.7,
  bevelSize = 0.5,
  bevelSegments = 8,

  perimeterSegments = 256,
  shapeSamples = 4096,
}: CreateBottleBaseGeometryOptions) {
  const geometry = new THREE.BufferGeometry();

  const halfHeight = height / 2;

  const safeBevelHeight = Math.min(bevelHeight, height);

  const { profile, normals } = createProfileData(
    shape,
    perimeterSegments,
    shapeSamples,
  );

  const rings: {
    y: number;
    inset: number;
  }[] = [];

  /*
   * Bottom bevel.
   *
   * At the very bottom:
   *   inset = bevelSize
   *
   * At the top of the bevel:
   *   inset = 0
   *
   * The quarter-circle profile becomes tangent to the
   * vertical wall as it reaches the full-size profile.
   */
  for (let i = 0; i <= bevelSegments; i++) {
    const t = i / bevelSegments;

    const y = -halfHeight + t * safeBevelHeight;

    /*
     * Reverse quarter-circle.
     *
     * t = 0 -> bevelSize
     * t = 1 -> 0
     */
    const u = 1 - t;

    const inset = bevelSize * (1 - Math.sqrt(Math.max(0, 1 - u * u)));

    rings.push({
      y,
      inset,
    });
  }

  /*
   * Straight full-size section up to the flat top.
   */
  if (safeBevelHeight < height) {
    rings.push({
      y: halfHeight,
      inset: 0,
    });
  }

  const positions: number[] = [];
  const indices: number[] = [];

  addSideRings({
    rings,
    profile,
    normals,
    positions,
    indices,
  });

  /*
   * Flat bottom face using the smallest,
   * inset perimeter ring.
   */
  addCap({
    ringIndex: 0,
    profile,
    positions,
    indices,
    flip: true,
  });

  /*
   * Flat top face using the full-size profile.
   */
  addCap({
    ringIndex: rings.length - 1,
    profile,
    positions,
    indices,
    flip: false,
  });

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
 * Shared profile helpers.
 *
 * We can move this into profileGeometryUtils.ts once
 * the body/top/base generators are settled.
 */
export function createProfileData(
  shape: THREE.Shape,
  perimeterSegments: number,
  shapeSamples: number,
) {
  const sourcePoints = shape.getSpacedPoints(shapeSamples);

  /*
   * Remove duplicated closing point.
   */
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
   * Resample at equal arc-length intervals.
   */
  const profile: THREE.Vector2[] = [];

  for (let i = 0; i < perimeterSegments; i++) {
    profile.push(getPointAtDistance((i / perimeterSegments) * perimeter));
  }

  /*
   * Calculate outward normals.
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

  return {
    profile,
    normals,
  };
}

interface AddSideRingsOptions {
  rings: {
    y: number;
    inset: number;
  }[];

  profile: THREE.Vector2[];
  normals: THREE.Vector2[];

  positions: number[];
  indices: number[];
}

function addSideRings({
  rings,
  profile,
  normals,
  positions,
  indices,
}: AddSideRingsOptions) {
  const segmentCount = profile.length;

  /*
   * Vertices.
   */
  for (const ring of rings) {
    for (let i = 0; i < segmentCount; i++) {
      const point = profile[i];
      const normal = normals[i];

      positions.push(
        point.x - normal.x * ring.inset,
        ring.y,
        point.y - normal.y * ring.inset,
      );
    }
  }

  /*
   * Stitch rings.
   */
  for (let r = 0; r < rings.length - 1; r++) {
    const currentStart = r * segmentCount;

    const nextStart = (r + 1) * segmentCount;

    for (let i = 0; i < segmentCount; i++) {
      const next = (i + 1) % segmentCount;

      const a = currentStart + i;
      const b = currentStart + next;

      const c = nextStart + i;
      const d = nextStart + next;

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
}

interface AddCapOptions {
  ringIndex: number;

  profile: THREE.Vector2[];

  positions: number[];
  indices: number[];

  flip: boolean;
}

function addCap({
  ringIndex,
  profile,
  positions,
  indices,
  flip,
}: AddCapOptions) {
  const segmentCount = profile.length;

  const ringStart = ringIndex * segmentCount;

  /*
   * All vertices in a ring share the same Y.
   */
  const y = positions[ringStart * 3 + 1];

  const centerIndex = positions.length / 3;

  positions.push(0, y, 0);

  for (let i = 0; i < segmentCount; i++) {
    const next = (i + 1) % segmentCount;

    if (flip) {
      indices.push(centerIndex, ringStart + next, ringStart + i);
    } else {
      indices.push(centerIndex, ringStart + i, ringStart + next);
    }
  }
}
