import * as THREE from "three";

export interface BottleCapGeometryOptions {
  radius: number;
  height: number;

  ridges: number;
  ridgeDepth: number;

  /**
   * Resolution of each individual ridge.
   * Higher = smoother rounded fluting.
   */
  samplesPerRidge?: number;

  /**
   * Allows subtle shaping of the sinusoidal ridge profile.
   *
   * 1 = pure sine wave.
   * > 1 = broader raised areas / narrower recesses.
   */
  ridgeRoundness?: number;

  /**
   * Vertical size of the rounded top edge.
   */
  bevelHeight?: number;

  /**
   * How far the top edge rolls inward.
   */
  bevelSize?: number;

  /**
   * Number of rings making up the top bevel.
   */
  bevelSegments?: number;
}

export function createBottleCapGeometry({
  radius,
  height,

  ridges,
  ridgeDepth,

  samplesPerRidge = 16,
  ridgeRoundness = 1.5,

  bevelHeight = 0.8,
  bevelSize = 1,
  bevelSegments = 8,
}: BottleCapGeometryOptions) {
  const geometry = new THREE.BufferGeometry();

  const halfHeight = height / 2;

  const radialSegments = ridges * samplesPerRidge;

  const safeBevelHeight = Math.min(bevelHeight, height);

  /*
   * Horizontal rings.
   *
   * The main body is ribbed at full radius.
   * The top rings progressively:
   *
   * - move inward
   * - lose their rib depth
   *
   * so the ridges naturally blend into the smooth top bevel.
   */
  const rings: {
    y: number;
    inset: number;
    ridgeAmount: number;
  }[] = [];

  /*
   * Bottom of cap.
   */
  rings.push({
    y: -halfHeight,
    inset: 0,
    ridgeAmount: 1,
  });

  /*
   * Straight ribbed wall up to the start of the top bevel.
   */
  rings.push({
    y: halfHeight - safeBevelHeight,
    inset: 0,
    ridgeAmount: 1,
  });

  /*
   * Rounded top bevel.
   */
  for (let i = 1; i <= bevelSegments; i++) {
    const t = i / bevelSegments;

    /*
     * Quarter-circle style easing.
     *
     * Gives a soft manufactured roundover rather than
     * a straight chamfer.
     */
    const bevelT = 1 - Math.sqrt(Math.max(0, 1 - t * t));

    rings.push({
      y: halfHeight - safeBevelHeight + t * safeBevelHeight,

      inset: bevelSize * bevelT,

      /*
       * Fade the fluting away through the bevel.
       */
      ridgeAmount: 1 - bevelT,
    });
  }

  const positions: number[] = [];
  const indices: number[] = [];

  /*
   * Generate perimeter vertices for every ring.
   */
  for (const ring of rings) {
    for (let i = 0; i < radialSegments; i++) {
      const u = i / radialSegments;

      const angle = u * Math.PI * 2;

      /*
       * Exact ridge position.
       *
       * Because radialSegments is derived from:
       *
       * ridges * samplesPerRidge
       *
       * every ridge has exactly the same number
       * of samples.
       */
      const ridgeSample = i % samplesPerRidge;

      const ridgeT = ridgeSample / samplesPerRidge;

      /*
       * Smooth sinusoidal flute.
       *
       * 0 = outer ridge
       * 1 = deepest recess
       */
      const wave = (1 - Math.cos(ridgeT * Math.PI * 2)) / 2;

      const shapedWave = Math.pow(wave, ridgeRoundness);

      const recess = shapedWave * ridgeDepth * ring.ridgeAmount;

      const currentRadius = radius - ring.inset - recess;

      const x = Math.cos(angle) * currentRadius;

      const z = Math.sin(angle) * currentRadius;

      positions.push(x, ring.y, z);
    }
  }

  /*
   * Stitch neighbouring rings.
   */
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex++) {
    const currentRingStart = ringIndex * radialSegments;

    const nextRingStart = (ringIndex + 1) * radialSegments;

    for (let i = 0; i < radialSegments; i++) {
      const next = (i + 1) % radialSegments;

      const a = currentRingStart + i;

      const b = currentRingStart + next;

      const c = nextRingStart + i;

      const d = nextRingStart + next;

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

  /*
   * Flat bottom.
   */
  const bottomCenterIndex = positions.length / 3;

  positions.push(0, -halfHeight, 0);

  for (let i = 0; i < radialSegments; i++) {
    const next = (i + 1) % radialSegments;

    indices.push(bottomCenterIndex, next, i);
  }

  /*
   * Flat smooth top.
   *
   * Uses the final bevel ring as its perimeter.
   */
  const topRingStart = (rings.length - 1) * radialSegments;

  const topCenterIndex = positions.length / 3;

  positions.push(0, halfHeight, 0);

  for (let i = 0; i < radialSegments; i++) {
    const next = (i + 1) % radialSegments;

    indices.push(topCenterIndex, topRingStart + i, topRingStart + next);
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
