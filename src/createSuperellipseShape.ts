// createSuperellipseShape.ts

import * as THREE from "three";

export interface CreateSuperellipseShapeOptions {
  width: number;
  depth: number;

  /**
   * Superellipse exponent.
   *
   * 2 = ellipse
   * ~2.8 = bottle shape
   * 4+ = increasingly rectangular
   */
  exponent?: number;

  /**
   * Number of points used to construct the shape.
   */
  segments?: number;
}

export function createSuperellipseShape({
  width,
  depth,
  exponent = 2.8,
  segments = 128,
}: CreateSuperellipseShapeOptions) {
  const shape = new THREE.Shape();

  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  const power = 2 / exponent;

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const x = halfWidth * Math.sign(cos) * Math.pow(Math.abs(cos), power);

    const y = halfDepth * Math.sign(sin) * Math.pow(Math.abs(sin), power);

    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }

  shape.closePath();

  return shape;
}
