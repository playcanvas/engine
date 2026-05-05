// Shared constants for the gsplat-unified module.

// Number of u32 slots per splat in projCache. 8 = 32 bytes (cache-line friendly).
// Slots: [0] centerX, [1] centerY, [2..4] conic coeffs, [5] pickId/color, [6] viewDepth/opacity,
// [7] precomputed -0.5 * radiusFactor (power cutoff for rasterize early-out).
export const CACHE_STRIDE = 8;

/**
 * Number of distance buckets for global splat budget balancing.
 * More buckets = finer granularity for budget prioritization (sqrt-based distance mapping).
 * @type {number}
 */
export const NUM_BUCKETS = 64;
