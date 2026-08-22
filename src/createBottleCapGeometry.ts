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

  /**
   * Very subtle roundover at the bottom of the cap.
   */
  bottomBevelHeight?: number;

  /**
   * How far the very bottom edge rolls inward.
   */
  bottomBevelSize?: number;

  /**
   * Number of rings making up the bottom roundover.
   */
  bottomBevelSegments?: number;
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

  bottomBevelHeight = 0.4,
  bottomBevelSize = 0.15,
  bottomBevelSegments = 4,
}: BottleCapGeometryOptions) {
  const geometry = new THREE.BufferGeometry();

  const halfHeight = height / 2;

  const radialSegments = ridges * samplesPerRidge;

  const safeTopBevelHeight = Math.min(bevelHeight, height);

  const safeBottomBevelHeight = Math.min(
    bottomBevelHeight,
    height - safeTopBevelHeight,
  );

  const rings: {
    y: number;
    inset: number;
    ridgeAmount: number;
  }[] = [];

  /*
   * Bottom roundover.
   *
   * At the very bottom:
   * - radius is slightly inset
   * - ridge depth is slightly reduced
   *
   * It quickly returns to the normal cap wall.
   */
  for (let i = 0; i <= bottomBevelSegments; i++) {
    const t = i / bottomBevelSegments;

    /*
     * Reverse quarter-circle-like easing.
     *
     * t = 0 -> maximum effect
     * t = 1 -> no effect
     */
    const bevelT = 1 - Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));

    rings.push({
      y: -halfHeight + t * safeBottomBevelHeight,

      inset: bottomBevelSize * bevelT,

      /*
       * Very subtly fade the ridges at the bottom edge.
       */
      ridgeAmount: 1 - bevelT * 0.35,
    });
  }

  /*
   * Straight ribbed wall.
   */
  rings.push({
    y: halfHeight - safeTopBevelHeight,

    inset: 0,
    ridgeAmount: 1,
  });

  /*
   * Rounded top bevel.
   */
  for (let i = 1; i <= bevelSegments; i++) {
    const t = i / bevelSegments;

    const bevelT = 1 - Math.sqrt(Math.max(0, 1 - t * t));

    rings.push({
      y: halfHeight - safeTopBevelHeight + t * safeTopBevelHeight,

      inset: bevelSize * bevelT,

      /*
       * Fade the fluting away through the top bevel.
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
