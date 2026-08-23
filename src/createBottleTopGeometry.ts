import * as THREE from "three";
import { createProfileData } from "./createBottleBaseGeometry";

export interface CreateBottleTopGeometryOptions {
  shape: THREE.Shape;
  height: number;

  bevelHeight?: number;
  bevelSize?: number;
  bevelSegments?: number;

  domeHeight?: number;
  domeSegments?: number;

  perimeterSegments?: number;
  shapeSamples?: number;
}

export function createBottleTopGeometry({
  shape,
  height,

  bevelHeight = 0.7,
  bevelSize = 0.45,
  bevelSegments = 8,

  domeHeight = 0.25,
  domeSegments = 12,

  perimeterSegments = 256,
  shapeSamples = 4096,
}: CreateBottleTopGeometryOptions) {
  const geometry = new THREE.BufferGeometry();

  const halfHeight = height / 2;

  const { profile, normals } = createProfileData(
    shape,
    perimeterSegments,
    shapeSamples,
  );

  const positions: number[] = [];
  const indices: number[] = [];

  /*
   * SIDE / TOP EDGE BEVEL
   *
   * Bottom is completely flat and full-size.
   */
  const rings: {
    y: number;
    inset: number;
  }[] = [
    {
      y: -halfHeight,
      inset: 0,
    },
    {
      y: halfHeight - bevelHeight,
      inset: 0,
    },
  ];

  for (let i = 1; i <= bevelSegments; i++) {
    const t = i / bevelSegments;

    rings.push({
      y: halfHeight - bevelHeight + t * bevelHeight,

      inset: bevelSize * roundedEase(t),
    });
  }

  const sideRingCount = rings.length;

  /*
   * Build side/bevel rings.
   */
  for (const ring of rings) {
    for (let i = 0; i < perimeterSegments; i++) {
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
   * Stitch side/bevel rings.
   *
   * Wound so THREE.FrontSide faces outward.
   */
  for (let r = 0; r < sideRingCount - 1; r++) {
    const currentStart = r * perimeterSegments;

    const nextStart = (r + 1) * perimeterSegments;

    for (let i = 0; i < perimeterSegments; i++) {
      const next = (i + 1) % perimeterSegments;

      const a = currentStart + i;

      const b = currentStart + next;

      const c = nextStart + i;

      const d = nextStart + next;

      indices.push(
        a,
        c,
        b,

        c,
        d,
        b,
      );
    }
  }

  /*
   * FLAT BOTTOM
   *
   * Outward direction is -Y.
   */
  const bottomCenter = positions.length / 3;

  positions.push(0, -halfHeight, 0);

  for (let i = 0; i < perimeterSegments; i++) {
    const next = (i + 1) % perimeterSegments;

    indices.push(bottomCenter, i, next);
  }

  /*
   * SHALLOW DOMED TOP
   *
   * Start from the final bevel ring.
   */
  let previousRingStart = (sideRingCount - 1) * perimeterSegments;

  /*
   * The outer edge already has bevelSize inset.
   *
   * Move inward using scaled copies of the same
   * superellipse profile while increasing Y slightly.
   */
  for (let ring = 1; ring < domeSegments; ring++) {
    const t = ring / domeSegments;

    /*
     * 1 at outside -> approaches 0 toward centre.
     */
    const scale = Math.cos(t * Math.PI * 0.5);

    /*
     * Very shallow smooth crown.
     */
    const y = halfHeight + domeHeight * Math.sin(t * Math.PI * 0.5);

    const ringStart = positions.length / 3;

    for (let i = 0; i < perimeterSegments; i++) {
      const point = profile[i];

      const normal = normals[i];

      /*
       * First establish the bevelled outer profile,
       * then shrink that superellipse toward the centre.
       */
      const x = (point.x - normal.x * bevelSize) * scale;

      const z = (point.y - normal.y * bevelSize) * scale;

      positions.push(x, y, z);
    }

    /*
     * Stitch dome rings.
     *
     * Same outward winding as the side geometry.
     */
    for (let i = 0; i < perimeterSegments; i++) {
      const next = (i + 1) % perimeterSegments;

      const a = previousRingStart + i;

      const b = previousRingStart + next;

      const c = ringStart + i;

      const d = ringStart + next;

      indices.push(
        a,
        c,
        b,

        c,
        d,
        b,
      );
    }

    previousRingStart = ringStart;
  }

  /*
   * Dome centre.
   *
   * Outward direction is +Y.
   */
  const topCenter = positions.length / 3;

  positions.push(0, halfHeight + domeHeight, 0);

  for (let i = 0; i < perimeterSegments; i++) {
    const next = (i + 1) % perimeterSegments;

    indices.push(topCenter, previousRingStart + next, previousRingStart + i);
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
