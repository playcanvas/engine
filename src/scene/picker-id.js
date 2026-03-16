import { NumericIds } from '../core/numeric-ids.js';

/**
 * Centralized picker ID generator. Provides unique IDs for objects that need
 * to be identifiable during GPU-based picking operations.
 *
 * @type {NumericIds}
 * @ignore
 */
const PickerId = new NumericIds();

export { PickerId };
