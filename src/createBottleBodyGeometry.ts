import { BufferGeometry, ExtrudeGeometry, Shape, Vector2 } from "three";

export interface CreateBottleBodyGeometryOptions {
  /** Left-to-right size. */
  width: number;

  /** Vertical size. */
  height: number;

  /** Front-to-back size. */
  depth: number;

  /**
   * Flattens the left and right regions.
   *
   * 0 = ellipse
   * 1 = strongly flattened / box-like
   */
  flattenX?: number;

  /**
   * Flattens the front and back regions.
   *
   * 0 = ellipse
   * 1 = strongly flattened / box-like
   */
  flattenZ?: number;

  /** Number of points around the footprint. */
  segments?: number;

  /**
   * Optional rounding where the vertical walls meet
   * the flat top and bottom.
   */
  bevelSize?: number;
  bevelThickness?: number;
  bevelSegments?: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function signedPow(value: number, exponent: number): number {
  return Math.sign(value) * Math.pow(Math.abs(value), exponent);
}

export function createBottleBodyGeometry({
  width,
  height,
  depth,
  flattenX = 0.45,
  flattenZ = 0.7,
  segments = 64,
  bevelSize = 0.02,
  bevelThickness = 0.02,
  bevelSegments = 3,
}: CreateBottleBodyGeometryOptions): BufferGeometry {
  const radiusX = width / 2;
  const radiusZ = depth / 2;

  /*
   * A regular ellipse uses exponent 1.
   * Reducing the exponent moves the outline towards
   * a rounded rectangular or flask-like footprint.
   */
  const exponentX = 1 - clamp01(flattenX) * 0.72;
  const exponentZ = 1 - clamp01(flattenZ) * 0.72;

  const points: Vector2[] = [];

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;

    const x = radiusX * signedPow(Math.cos(angle), exponentX);

    const z = radiusZ * signedPow(Math.sin(angle), exponentZ);

    /*
     * Shape is created in its local XY plane.
     * Its local Y coordinate becomes world Z after rotation.
     */
    points.push(new Vector2(x, z));
  }

  const shape = new Shape(points);

  const bevelEnabled = bevelSize > 0 && bevelThickness > 0 && bevelSegments > 0;

  const geometry = new ExtrudeGeometry(shape, {
    depth: height,
    steps: 1,
    curveSegments: segments,
    bevelEnabled,
    bevelSize,
    bevelThickness,
    bevelSegments,
  });

  /*
   * ExtrudeGeometry initially:
   * - draws the footprint in XY
   * - extrudes along Z
   *
   * Rotate it so:
   * - footprint becomes XZ
   * - extrusion becomes vertical Y
   */
  geometry.rotateX(-Math.PI / 2);

  // Centre the completed geometry around the world origin.
  geometry.center();

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}
