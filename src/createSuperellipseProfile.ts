// createSuperellipseProfile.ts

import * as THREE from "three";

export interface CreateSuperellipseProfileOptions {
  width: number;
  depth: number;
  exponent?: number;
  segments?: number;
}

export interface SuperellipseProfile {
  shape: THREE.Shape;
  getPoint: (angle: number) => THREE.Vector2;
}

export function createSuperellipseProfile({
  width,
  depth,
  exponent = 2.8,
  segments = 128,
}: CreateSuperellipseProfileOptions): SuperellipseProfile {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  const power = 2 / exponent;

  const getPoint = (angle: number) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return new THREE.Vector2(
      halfWidth * Math.sign(cos) * Math.pow(Math.abs(cos), power),
      halfDepth * Math.sign(sin) * Math.pow(Math.abs(sin), power),
    );
  };

  const shape = new THREE.Shape();

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const point = getPoint(angle);

    if (i === 0) {
      shape.moveTo(point.x, point.y);
    } else {
      shape.lineTo(point.x, point.y);
    }
  }

  shape.closePath();

  return {
    shape,
    getPoint,
  };
}
