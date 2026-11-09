// Shared constants for the gsplat-unified module.

/** Minimum alpha treated as visible; matches historical 1/255 shader floor. */
export const ALPHA_VISIBILITY_THRESHOLD = 1.0 / 255.0;

/**
 * Default number of splats across all GSplats in the scene, used by
 * {@link GSplatParams#splatBudget}.
 * @type {number}
 */
export const SPLAT_BUDGET_DEFAULT = 1000000;
