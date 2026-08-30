// Shared constants for the gsplat-unified module.

/** Minimum alpha treated as visible; matches historical 1/255 shader floor. */
export const ALPHA_VISIBILITY_THRESHOLD = 1.0 / 255.0;

// Number of u32 slots per splat in projCache. 8 = 32 bytes (cache-line friendly).
// Slots: [0] centerX, [1] centerY, [2..4] conic coeffs, [5] pickId/color, [6] viewDepth/opacity,
// [7] precomputed -0.5 * radiusFactor (power cutoff for rasterize early-out).
export const CACHE_STRIDE = 8;

/**
 * Default target number of splats across all GSplats in the scene, used by
 * {@link GSplatParams#splatBudget} and substituted when a non-positive budget is configured.
 * @type {number}
 */
export const SPLAT_BUDGET_DEFAULT = 1000000;

/**
 * Number of value buckets for global splat budget balancing. Upgrades are bucketed by
 * coverage-weighted error reduction per splat on a fixed log scale, so this sets how finely the
 * greedy order is resolved. 256 already measured indistinguishable from an exact sort at no more
 * cost than 64; 512 keeps that resolution across the wider value window the balancer uses.
 * @type {number}
 */
export const NUM_VALUE_BUCKETS = 512;
