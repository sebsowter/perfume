// createPillShape.ts

import * as THREE from "three";

export function createPillShape(width: number, depth: number) {
  const shape = new THREE.Shape();

  const radius = depth / 2;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  const left = -halfWidth + radius;
  const right = halfWidth - radius;

  shape.moveTo(left, halfDepth);

  shape.lineTo(right, halfDepth);

  shape.absarc(right, 0, radius, Math.PI / 2, -Math.PI / 2, true);

  shape.lineTo(left, -halfDepth);

  shape.absarc(left, 0, radius, -Math.PI / 2, Math.PI / 2, true);

  shape.closePath();

  return shape;
}
