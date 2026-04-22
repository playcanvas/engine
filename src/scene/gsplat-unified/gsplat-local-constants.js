// Shared constants for the local compute gsplat renderer. These values are mirrored into
// the WGSL shaders via cdefines text substitution (e.g. `{CACHE_STRIDE}u`), so they must
// live in a single place to keep JS-side buffer allocations and shader-side indexing in sync.

// Number of u32 slots per splat in projCache. 8 = 32 bytes (cache-line friendly).
// Slots: [0] centerX, [1] centerY, [2..4] conic coeffs, [5] pickId/color, [6] viewDepth/opacity,
// [7] precomputed -0.5 * radiusFactor (power cutoff for rasterize early-out).
export const CACHE_STRIDE = 8;
