// Shared constants for the gsplat-unified module.

/** Minimum alpha treated as visible; matches historical 1/255 shader floor. */
export const ALPHA_VISIBILITY_THRESHOLD = 1.0 / 255.0;

/**
 * Default number of splats across all GSplats in the scene, used by
 * {@link GSplatParams#splatBudget}.
 * @type {number}
 */
export const SPLAT_BUDGET_DEFAULT = 1000000;

/**
 * Number of bins on the log distance-scale axis the LOD allocator fits the splat budget along,
 * over a window of 96 natural-log units - about 10% of distance per bin. Must be even, so a scale
 * of 1 falls on a bin edge, and large enough that LOD bands, at least a factor of 1.2 apart, never
 * share a bin.
 * @type {number}
 */
export const NUM_SCALE_BINS = 1024;

/**
 * Number of sub-bins the LOD allocator splits the one bin the budget runs out in, so the budget is
 * filled to within a small fraction rather than to within a bin - about 0.01% of distance each.
 * @type {number}
 */
export const NUM_SUB_BINS = 1024;
