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
   * Number of dense source samples per vertical model unit/mm.
   *
   * For an 81.5 mm body:
   *
   * samplesPerY: 2
   *
   * produces roughly 163 source segments before simplification.
   *
   * These source vertices are only used to construct the accurate
   * surface and normals. Redundant points are removed afterwards.
   */
  samplesPerY?: number;

  /**
   * Maximum positional error, in model units/mm, allowed when
   * removing a vertical point.
   *
   * Lower = retain more geometry.
   */
  simplifyPositionTolerance?: number;

  /**
   * Maximum normal deviation, in degrees, allowed when removing
   * a vertical point.
   *
   * This protects subtle curved/bevelled shading even where the
   * positional change is extremely small.
   */
  simplifyNormalTolerance?: number;

  bevelHeight?: number;
  bevelInset?: number;

  branding?: BottleBodyBrandingOptions;
}

interface DenseVertex {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  denseIndex: number;
}

interface SimplifiedVertex extends DenseVertex {
  index: number;
}

export function createBottleBodyGeometry({
  shape,
  height,

  ribCount = 70,
  ribDepth = 0.5,
  ribSharpness = 2,

  samplesPerRib = 10,
  shapeSamples = 4096,

  samplesPerY = 2,

  simplifyPositionTolerance = 0.002,
  simplifyNormalTolerance = 0.75,

  bevelHeight = 1.5,
  bevelInset = 0.8,

  branding,
}: CreateBottleBodyGeometryOptions) {
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
   * Keep perimeter resolution tied directly to the ribs.
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
   * Equal arc-length samples around the bottle profile.
   */
  const profile: THREE.Vector2[] = [];

  for (let i = 0; i < perimeterSegments; i++) {
    profile.push(getPointAtDistance(i * segmentLength));
  }

  /*
   * Outward normals of the undeformed superellipse profile.
   *
   * These are used to push the surface inward/outward.
   */
  const profileNormals: THREE.Vector2[] = [];

  for (let i = 0; i < perimeterSegments; i++) {
    const previous = profile[(i - 1 + perimeterSegments) % perimeterSegments];

    const current = profile[i];

    const next = profile[(i + 1) % perimeterSegments];

    const tangent = next.clone().sub(previous).normalize();

    const normal = new THREE.Vector2(tangent.y, -tangent.x).normalize();

    if (normal.dot(current) < 0) {
      normal.multiplyScalar(-1);
    }

    profileNormals.push(normal);
  }

  /*
   * --------------------------------------------------------
   * DENSE REGULAR Y GRID
   * --------------------------------------------------------
   *
   * Build the accurate body on a completely regular source mesh.
   *
   * This is important because normals are calculated BEFORE
   * simplification, while triangle density/aspect ratios are
   * still consistent over the whole bottle.
   */

  const denseVerticalSegments = Math.max(2, Math.ceil(height * samplesPerY));

  const denseRingCount = denseVerticalSegments + 1;

  const densePositions: number[] = [];
  const denseIndices: number[] = [];

  for (let ringIndex = 0; ringIndex < denseRingCount; ringIndex++) {
    const verticalT = ringIndex / denseVerticalSegments;

    const y = THREE.MathUtils.lerp(-halfHeight, halfHeight, verticalT);

    const bodyInset = getBodyInset({
      y,
      halfHeight,
      bevelHeight,
      bevelInset,
    });

    for (let i = 0; i < perimeterSegments; i++) {
      const current = profile[i];
      const profileNormal = profileNormals[i];

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
       * Positive inset moves inward.
       */
      const totalInset = bodyInset + groove + brandingRecess - frameRaise;

      const x = current.x - profileNormal.x * totalInset;

      const z = current.y - profileNormal.y * totalInset;

      densePositions.push(x, y, z);
    }
  }

  /*
   * Regular source-grid triangulation.
   *
   * This is used only to calculate accurate source normals.
   */
  for (let ringIndex = 0; ringIndex < denseRingCount - 1; ringIndex++) {
    const currentRingStart = ringIndex * perimeterSegments;

    const nextRingStart = (ringIndex + 1) * perimeterSegments;

    for (let i = 0; i < perimeterSegments; i++) {
      const next = (i + 1) % perimeterSegments;

      const a = currentRingStart + i;

      const b = currentRingStart + next;

      const c = nextRingStart + i;

      const d = nextRingStart + next;

      indicesPushQuad(denseIndices, a, b, c, d);
    }
  }

  /*
   * --------------------------------------------------------
   * SOURCE NORMALS
   * --------------------------------------------------------
   *
   * Calculate normals while the mesh is still perfectly regular.
   *
   * These normals are then carried into the simplified geometry.
   * The final irregular triangulation therefore cannot create
   * new shading seams.
   */

  const denseGeometry = new THREE.BufferGeometry();

  denseGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(densePositions, 3),
  );

  denseGeometry.setIndex(denseIndices);
  denseGeometry.computeVertexNormals();

  const denseNormalAttribute = denseGeometry.getAttribute(
    "normal",
  ) as THREE.BufferAttribute;

  /*
   * --------------------------------------------------------
   * BUILD VERTICAL COLUMNS
   * --------------------------------------------------------
   *
   * Each perimeter sample gets its own independent vertical
   * polyline.
   */

  const denseColumns: DenseVertex[][] = [];

  for (
    let perimeterIndex = 0;
    perimeterIndex < perimeterSegments;
    perimeterIndex++
  ) {
    const column: DenseVertex[] = [];

    for (let ringIndex = 0; ringIndex < denseRingCount; ringIndex++) {
      const denseIndex = ringIndex * perimeterSegments + perimeterIndex;

      const positionOffset = denseIndex * 3;

      column.push({
        denseIndex,

        position: new THREE.Vector3(
          densePositions[positionOffset],
          densePositions[positionOffset + 1],
          densePositions[positionOffset + 2],
        ),

        normal: new THREE.Vector3(
          denseNormalAttribute.getX(denseIndex),
          denseNormalAttribute.getY(denseIndex),
          denseNormalAttribute.getZ(denseIndex),
        ),
      });
    }

    denseColumns.push(column);
  }

  /*
   * --------------------------------------------------------
   * SIMPLIFY EACH VERTICAL COLUMN INDEPENDENTLY
   * --------------------------------------------------------
   *
   * The rear of the bottle can collapse to only the points
   * needed for the top/bottom roundovers and straight body.
   *
   * Columns crossing the plaque/recess/frame naturally retain
   * substantially more vertices.
   */

  const simplifiedDenseColumns = denseColumns.map((column) =>
    simplifyVerticalColumn({
      column,

      positionTolerance: simplifyPositionTolerance,

      normalToleranceRadians: THREE.MathUtils.degToRad(simplifyNormalTolerance),
    }),
  );

  /*
   * The dense temporary geometry is no longer needed.
   */
  denseGeometry.dispose();

  /*
   * --------------------------------------------------------
   * BUILD FINAL VERTEX BUFFERS
   * --------------------------------------------------------
   */

  const positions: number[] = [];
  const normals: number[] = [];

  const columns: SimplifiedVertex[][] = [];

  for (const sourceColumn of simplifiedDenseColumns) {
    const column: SimplifiedVertex[] = [];

    for (const vertex of sourceColumn) {
      const index = positions.length / 3;

      positions.push(vertex.position.x, vertex.position.y, vertex.position.z);

      normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);

      column.push({
        ...vertex,
        index,
      });
    }

    columns.push(column);
  }

  /*
   * --------------------------------------------------------
   * ZIPPER TRIANGULATION
   * --------------------------------------------------------
   *
   * Adjacent vertical columns no longer need matching Y
   * samples.
   *
   * Walk upward through both polylines, advancing whichever
   * one reaches its next Y position first.
   *
   * This produces a continuous surface with no T-junctions.
   */

  const indices: number[] = [];

  for (
    let perimeterIndex = 0;
    perimeterIndex < perimeterSegments;
    perimeterIndex++
  ) {
    const nextPerimeterIndex = (perimeterIndex + 1) % perimeterSegments;

    stitchColumns({
      a: columns[perimeterIndex],
      b: columns[nextPerimeterIndex],
      indices,
    });
  }

  /*
   * --------------------------------------------------------
   * FINAL GEOMETRY
   * --------------------------------------------------------
   */

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );

  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));

  geometry.setIndex(indices);

  /*
   * DO NOT call computeVertexNormals() here.
   *
   * The normals deliberately come from the dense regular
   * source mesh so the simplified topology cannot affect
   * the bottle's lighting.
   */

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/*
 * ----------------------------------------------------------
 * VERTICAL COLUMN SIMPLIFICATION
 * ----------------------------------------------------------
 *
 * Ramer-Douglas-Peucker-style recursive simplification,
 * adapted to our ordered Y parameter.
 *
 * A point may be removed only if BOTH:
 *
 * - its position is sufficiently close to interpolation
 *   between the segment endpoints
 *
 * - its original dense-mesh normal is sufficiently close
 *   to the interpolated endpoint normal
 */

function simplifyVerticalColumn({
  column,
  positionTolerance,
  normalToleranceRadians,
}: {
  column: DenseVertex[];
  positionTolerance: number;
  normalToleranceRadians: number;
}) {
  if (column.length <= 2) {
    return column;
  }

  const keep = new Array<boolean>(column.length).fill(false);

  keep[0] = true;
  keep[column.length - 1] = true;

  simplifySection(
    column,
    0,
    column.length - 1,
    keep,
    positionTolerance,
    normalToleranceRadians,
  );

  return column.filter((_, index) => keep[index]);
}

function simplifySection(
  column: DenseVertex[],
  startIndex: number,
  endIndex: number,
  keep: boolean[],
  positionTolerance: number,
  normalToleranceRadians: number,
) {
  if (endIndex - startIndex <= 1) {
    return;
  }

  const start = column[startIndex];

  const end = column[endIndex];

  const ySpan = end.position.y - start.position.y;

  if (Math.abs(ySpan) < 0.000001) {
    return;
  }

  let worstIndex = -1;
  let worstScore = 1;

  const expectedNormal = new THREE.Vector3();

  for (let i = startIndex + 1; i < endIndex; i++) {
    const current = column[i];

    const t = (current.position.y - start.position.y) / ySpan;

    /*
     * Position error.
     *
     * Y already defines our parameter, so only X/Z need
     * comparing against the interpolated surface.
     */
    const expectedX = THREE.MathUtils.lerp(start.position.x, end.position.x, t);

    const expectedZ = THREE.MathUtils.lerp(start.position.z, end.position.z, t);

    const positionError = Math.hypot(
      current.position.x - expectedX,

      current.position.z - expectedZ,
    );

    /*
     * Normal error.
     */
    expectedNormal.copy(start.normal).lerp(end.normal, t).normalize();

    const dot = THREE.MathUtils.clamp(
      current.normal.dot(expectedNormal),
      -1,
      1,
    );

    const normalError = Math.acos(dot);

    const positionScore =
      positionTolerance > 0
        ? positionError / positionTolerance
        : positionError > 0
          ? Infinity
          : 0;

    const normalScore =
      normalToleranceRadians > 0
        ? normalError / normalToleranceRadians
        : normalError > 0
          ? Infinity
          : 0;

    const score = Math.max(positionScore, normalScore);

    if (score > worstScore) {
      worstScore = score;
      worstIndex = i;
    }
  }

  /*
   * Everything between these endpoints can be represented
   * within tolerance.
   */
  if (worstIndex < 0) {
    return;
  }

  keep[worstIndex] = true;

  simplifySection(
    column,
    startIndex,
    worstIndex,
    keep,
    positionTolerance,
    normalToleranceRadians,
  );

  simplifySection(
    column,
    worstIndex,
    endIndex,
    keep,
    positionTolerance,
    normalToleranceRadians,
  );
}

/*
 * ----------------------------------------------------------
 * ZIPPER STITCH TWO VERTICAL COLUMNS
 * ----------------------------------------------------------
 */

function stitchColumns({
  a,
  b,
  indices,
}: {
  a: SimplifiedVertex[];
  b: SimplifiedVertex[];
  indices: number[];
}) {
  if (a.length < 2 || b.length < 2) {
    return;
  }

  let ai = 0;
  let bi = 0;

  const epsilon = 0.000001;

  while (ai < a.length - 1 || bi < b.length - 1) {
    const currentA = a[ai];

    const currentB = b[bi];

    const nextA = ai < a.length - 1 ? a[ai + 1] : null;

    const nextB = bi < b.length - 1 ? b[bi + 1] : null;

    /*
     * Both columns still have another point.
     */
    if (nextA && nextB) {
      const nextAY = nextA.position.y;

      const nextBY = nextB.position.y;

      /*
       * Same Y level.
       *
       * Generate the same two triangles we would have
       * produced in the original regular quad grid.
       */
      if (Math.abs(nextAY - nextBY) <= epsilon) {
        indices.push(
          currentA.index,
          nextA.index,
          currentB.index,

          nextA.index,
          nextB.index,
          currentB.index,
        );

        ai++;
        bi++;

        continue;
      }

      /*
       * Column A reaches its next vertex first.
       */
      if (nextAY < nextBY) {
        indices.push(currentA.index, nextA.index, currentB.index);

        ai++;

        continue;
      }

      /*
       * Column B reaches its next vertex first.
       */
      indices.push(currentA.index, nextB.index, currentB.index);

      bi++;

      continue;
    }

    /*
     * Only column A has points remaining.
     */
    if (nextA) {
      indices.push(currentA.index, nextA.index, currentB.index);

      ai++;

      continue;
    }

    /*
     * Only column B has points remaining.
     */
    if (nextB) {
      indices.push(currentA.index, nextB.index, currentB.index);

      bi++;
    }
  }
}

/*
 * Regular source-grid quad.
 *
 * Counter-clockwise when viewed from outside.
 */
function indicesPushQuad(
  indices: number[],
  a: number,
  b: number,
  c: number,
  d: number,
) {
  indices.push(
    a,
    c,
    b,

    c,
    d,
    b,
  );
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
