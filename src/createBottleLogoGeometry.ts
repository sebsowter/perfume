// createBottleLogoGeometry.ts

import * as THREE from "three";

export interface CreateBottleLogoGeometryOptions {
  shape: THREE.Shape;

  /**
   * Original artwork dimensions.
   *
   * Used only to preserve the logo's aspect ratio.
   */
  sourceWidth: number;
  sourceHeight: number;

  /**
   * Final rendered width in model units / mm.
   */
  width: number;

  /**
   * Vertical position relative to the bottle body centre.
   */
  centerY: number;

  /**
   * Distance outward from the nominal bottle surface.
   *
   * For the logo this should normally place it just
   * above the finished plaque surface.
   */
  surfaceOffset: number;

  /**
   * Horizontal subdivisions.
   *
   * These allow the logo surface to follow the
   * bottle's curvature.
   */
  segmentsX?: number;

  /**
   * Vertical subdivisions.
   *
   * The bottle profile does not change vertically,
   * so this can remain very low.
   */
  segmentsY?: number;

  /**
   * Dense sampling used to reconstruct the front
   * surface of the supplied bottle profile.
   */
  shapeSamples?: number;
}

export function createBottleLogoGeometry({
  shape,

  sourceWidth,
  sourceHeight,

  width,
  centerY,
  surfaceOffset,

  segmentsX = 32,
  segmentsY = 1,

  shapeSamples = 4096,
}: CreateBottleLogoGeometryOptions) {
  const geometry = new THREE.BufferGeometry();

  /*
   * Preserve artwork aspect ratio.
   */
  const height = width * (sourceHeight / sourceWidth);

  const halfWidth = width / 2;
  const halfHeight = height / 2;

  /*
   * Sample only the front half of the bottle profile.
   *
   * shape X -> world X
   * shape Y -> world Z
   */
  const sourcePoints = shape
    .getSpacedPoints(shapeSamples)
    .filter((point) => point.y >= 0);

  sourcePoints.sort((a, b) => a.x - b.x);

  /*
   * Find the bottle surface and outward normal
   * at an arbitrary X coordinate.
   */
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

    /*
     * Ensure the normal points toward
     * the front/outside of the bottle.
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
  const uvs: number[] = [];
  const indices: number[] = [];

  /*
   * Generate one lightweight rectangular grid.
   *
   * Every X column follows the curved bottle surface.
   */
  for (let iy = 0; iy <= segmentsY; iy++) {
    const v = iy / segmentsY;

    const localY = THREE.MathUtils.lerp(-halfHeight, halfHeight, v);

    for (let ix = 0; ix <= segmentsX; ix++) {
      const u = ix / segmentsX;

      const localX = THREE.MathUtils.lerp(-halfWidth, halfWidth, u);

      const { z: surfaceZ, normal } = getFrontSurfaceAtX(localX);

      const worldX = localX + normal.x * surfaceOffset;

      const worldY = centerY + localY;

      const worldZ = surfaceZ + normal.y * surfaceOffset;

      positions.push(worldX, worldY, worldZ);

      /*
       * Flip V because image textures and the
       * geometry's vertical coordinate run in
       * opposite directions.
       */
      uvs.push(u, v);
    }
  }

  /*
   * Stitch grid.
   *
   * Wound toward the front of the bottle so
   * THREE.FrontSide renders correctly.
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
        b,
        c,

        b,
        d,
        c,
      );
    }
  }

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );

  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

  geometry.setIndex(indices);

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}
