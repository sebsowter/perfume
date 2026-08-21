// createBottleLogoGeometry.ts

import * as THREE from "three";

export interface CreateBottleLogoGeometryOptions {
  /**
   * Bottle cross-section.
   *
   * Uses the same superellipse shape as the body/plaque.
   */
  shape: THREE.Shape;

  /**
   * Shapes created from the supplied SVG paths.
   */
  shapes: THREE.Shape[];

  /**
   * Original SVG viewBox dimensions.
   *
   * Hotel Portofino:
   * 287.01 × 57.7
   */
  sourceWidth: number;
  sourceHeight: number;

  /**
   * Final physical width of the complete logo in mm.
   *
   * Height is derived automatically from the SVG
   * aspect ratio.
   */
  width: number;

  /**
   * Vertical centre of the logo on the bottle body.
   */
  centerY: number;

  /**
   * Distance from the nominal bottle surface to the
   * surface the lettering sits upon.
   *
   * For the plaque this will normally be:
   *
   * plaque.surfaceOffset + plaque.raise
   */
  surfaceOffset?: number;

  /**
   * Physical extrusion depth of the lettering.
   */
  depth?: number;

  /**
   * Tiny bevel around the lettering.
   */
  bevelSize?: number;
  bevelThickness?: number;
  bevelSegments?: number;

  /**
   * Dense sampling used to reconstruct the front
   * surface of the supplied bottle profile.
   */
  shapeSamples?: number;

  /**
   * Curve subdivision used by ExtrudeGeometry.
   */
  curveSegments?: number;
}

export function createBottleLogoGeometry({
  shape,
  shapes,

  sourceWidth,
  sourceHeight,

  width,
  centerY,

  surfaceOffset = 0,

  depth = 0.1,

  bevelSize = 0.03,
  bevelThickness = 0.03,
  bevelSegments = 2,

  shapeSamples = 4096,
  curveSegments = 8,
}: CreateBottleLogoGeometryOptions) {
  /*
   * Preserve the SVG's original aspect ratio.
   */
  const scale = width / sourceWidth;

  const finalHeight = sourceHeight * scale;

  /*
   * SVG coordinates:
   *
   * x -> right
   * y -> down
   *
   * Bottle coordinates:
   *
   * x -> right
   * y -> up
   *
   * So SVG Y needs to be flipped.
   */
  const transformedShapes = shapes.map((sourceShape) =>
    transformShape({
      shape: sourceShape,

      sourceWidth,
      sourceHeight,

      scale,
    }),
  );

  /*
   * Let Three.js generate the actual letter geometry.
   *
   * At this stage:
   *
   * X = horizontal logo position
   * Y = vertical logo position
   * Z = extrusion depth
   *
   * We then bend those vertices onto the bottle.
   */
  const geometry = new THREE.ExtrudeGeometry(transformedShapes, {
    depth,

    bevelEnabled: true,
    bevelSize,
    bevelThickness,
    bevelSegments,

    curveSegments,

    steps: 1,
  });

  /*
   * Build a dense representation of the front half
   * of the bottle profile.
   */
  const profilePoints = shape
    .getSpacedPoints(shapeSamples)
    .filter((point) => point.y >= 0);

  profilePoints.sort((a, b) => a.x - b.x);

  /*
   * Pre-calculate the vertical offset needed to place
   * the centred SVG at centerY.
   */
  const logoBottom = centerY - finalHeight / 2;

  const position = geometry.getAttribute("position") as THREE.BufferAttribute;

  /*
   * Bend every extruded SVG vertex onto the
   * superellipse surface.
   */
  for (let i = 0; i < position.count; i++) {
    const localX = position.getX(i);

    const localY = position.getY(i);

    const extrusionZ = position.getZ(i);

    const { z: bottleZ, normal } = getFrontSurfaceAtX(profilePoints, localX);

    /*
     * The transformed SVG is already centred around
     * zero vertically.
     *
     * Convert that to bottle world Y.
     */
    const worldY = logoBottom + finalHeight / 2 + localY;

    /*
     * ExtrusionGeometry builds forward along +Z.
     *
     * We reinterpret that depth as displacement along
     * the bottle's local outward profile normal.
     */
    const outwardOffset = surfaceOffset + extrusionZ;

    const worldX = localX + normal.x * outwardOffset;

    const worldZ = bottleZ + normal.y * outwardOffset;

    position.setXYZ(i, worldX, worldY, worldZ);
  }

  position.needsUpdate = true;

  /*
   * ExtrudeGeometry normals are no longer correct after
   * bending, so recalculate them from the final geometry.
   */
  geometry.computeVertexNormals();

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/*
 * Transform one SVG Shape into bottle/logo coordinates.
 *
 * The SVG artwork itself is not modified conceptually:
 *
 * - scale uniformly
 * - centre horizontally
 * - centre vertically
 * - flip SVG Y into Three.js Y
 *
 * Holes are transformed as well.
 */
function transformShape({
  shape,

  sourceWidth,
  sourceHeight,

  scale,
}: {
  shape: THREE.Shape;

  sourceWidth: number;
  sourceHeight: number;

  scale: number;
}) {
  const transformed = transformPath({
    path: shape,

    sourceWidth,
    sourceHeight,

    scale,
  });

  const result = new THREE.Shape();

  result.curves = transformed.curves;

  result.autoClose = transformed.autoClose;

  /*
   * Preserve counters inside letters such as:
   *
   * O
   * P
   * R
   * A
   * B
   */
  result.holes = shape.holes.map((hole) =>
    transformPath({
      path: hole,

      sourceWidth,
      sourceHeight,

      scale,
    }),
  );

  return result;
}

/*
 * Rather than attempting to manually transform every
 * possible Curve subclass, sample the supplied path and
 * rebuild it as a polygonal Path.
 *
 * At the tiny physical size of this lettering, dense
 * sampling is more than sufficient and keeps this utility
 * independent of SVG curve types.
 */
function transformPath({
  path,

  sourceWidth,
  sourceHeight,

  scale,
}: {
  path: THREE.Path;

  sourceWidth: number;
  sourceHeight: number;

  scale: number;
}) {
  const points = path.getSpacedPoints(256);

  const result = new THREE.Path();

  if (points.length === 0) {
    return result;
  }

  function transformPoint(point: THREE.Vector2) {
    /*
     * Centre around the SVG viewBox centre.
     */
    const x = (point.x - sourceWidth / 2) * scale;

    /*
     * SVG Y increases downward, hence the inversion.
     */
    const y = (sourceHeight / 2 - point.y) * scale;

    return new THREE.Vector2(x, y);
  }

  const first = transformPoint(points[0]);

  result.moveTo(first.x, first.y);

  for (let i = 1; i < points.length; i++) {
    const point = transformPoint(points[i]);

    result.lineTo(point.x, point.y);
  }

  result.closePath();

  return result;
}

/*
 * Interpolate the front surface of the bottle at X,
 * including its local outward normal.
 */
function getFrontSurfaceAtX(profilePoints: THREE.Vector2[], x: number) {
  const first = profilePoints[0];

  const last = profilePoints[profilePoints.length - 1];

  const clampedX = THREE.MathUtils.clamp(x, first.x, last.x);

  /*
   * Binary search for neighbouring profile points.
   */
  let low = 0;

  let high = profilePoints.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    if (profilePoints[mid].x < clampedX) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const upperIndex = THREE.MathUtils.clamp(low, 1, profilePoints.length - 1);

  const lowerIndex = upperIndex - 1;

  const a = profilePoints[lowerIndex];

  const b = profilePoints[upperIndex];

  const span = b.x - a.x;

  const t = Math.abs(span) > 0.000001 ? (clampedX - a.x) / span : 0;

  const z = THREE.MathUtils.lerp(a.y, b.y, t);

  /*
   * Tangent to the bottle profile.
   */
  const tangent = b.clone().sub(a).normalize();

  /*
   * Perpendicular gives us the profile normal.
   */
  const normal = new THREE.Vector2(tangent.y, -tangent.x).normalize();

  /*
   * Ensure the normal points toward the
   * front of the bottle.
   */
  if (normal.y < 0) {
    normal.multiplyScalar(-1);
  }

  return {
    z,
    normal,
  };
}
