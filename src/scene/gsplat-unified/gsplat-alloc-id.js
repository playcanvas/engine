import { NumericIds } from '../../core/numeric-ids.js';

/**
 * Centralized allocation ID generator for gsplat work buffer allocations.
 * Provides unique IDs for placements and octree nodes that need persistent
 * allocation tracking in the block allocator.
 *
 * @type {NumericIds}
 * @ignore
 */
const GsplatAllocId = new NumericIds();

export { GsplatAllocId };
