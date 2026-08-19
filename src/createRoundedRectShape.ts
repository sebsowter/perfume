// createRoundedRectShape.ts

import * as THREE from "three";

export interface CreateRoundedRectShapeOptions {
  width: number;
  depth: number;
  radius: number;
}

export function createRoundedRectShape({
  width,
  depth,
  radius,
}: CreateRoundedRectShapeOptions) {
  const shape = new THREE.Shape();

  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  const r = Math.min(radius, halfWidth, halfDepth);

  const left = -halfWidth;
  const right = halfWidth;
  const back = -halfDepth;
  const front = halfDepth;

  /*
   * Start on the front edge after the top-left corner.
   *
   * Walk clockwise around the profile.
   */

  shape.moveTo(left + r, front);

  // Front
  shape.lineTo(right - r, front);

  // Front-right corner
  shape.absarc(right - r, front - r, r, Math.PI / 2, 0, true);

  // Right end
  shape.lineTo(right, back + r);

  // Back-right corner
  shape.absarc(right - r, back + r, r, 0, -Math.PI / 2, true);

  // Back
  shape.lineTo(left + r, back);

  // Back-left corner
  shape.absarc(left + r, back + r, r, -Math.PI / 2, -Math.PI, true);

  // Left end
  shape.lineTo(left, front - r);

  // Front-left corner
  shape.absarc(left + r, front - r, r, Math.PI, Math.PI / 2, true);

  shape.closePath();

  return shape;
}
