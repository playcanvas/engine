/**
 * Calculate the damp rate.
 *
 * @param {number} damping - The damping.
 * @param {number} dt - The delta time.
 * @returns {number} - The lerp rate.
 */
export const damp = (damping, dt) => 1 - Math.pow(damping, dt * 1000);
