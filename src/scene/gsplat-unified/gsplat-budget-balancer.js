/**
 * @import { GSplatOctreeInstance } from './gsplat-octree-instance.js'
 * @import { GSplatPlacement } from './gsplat-placement.js'
 */

/**
 * Number of buckets for distance-based sorting.
 * More buckets = finer granularity for budget prioritization.
 * @type {number}
 */
const NUM_BUCKETS = 64;

/**
 * Balances splat budget across multiple octree instances by adjusting LOD levels.
 * Uses sqrt-based bucket distribution to give more precision to nearby geometry.
 * Bucket 0 = nearest to camera (highest priority), bucket N-1 = farthest (lowest priority).
 *
 * @ignore
 */
class GSplatBudgetBalancer {
    /**
     * Buckets storing NodeInfo references.
     * @type {Array<Array>|null}
     * @private
     */
    _buckets = null;

    /**
     * Initialize bucket infrastructure on first use.
     * @private
     */
    _initBuckets() {
        if (!this._buckets) {
            // Pre-allocate bucket arrays (will hold NodeInfo references)
            this._buckets = new Array(NUM_BUCKETS);
            for (let i = 0; i < NUM_BUCKETS; i++) {
                this._buckets[i] = [];
            }
        }
    }

    /**
     * Balances splat budget across all octree instances by adjusting LOD levels.
     * Uses sqrt-based bucket distribution to give more precision to nearby geometry.
     * Makes multiple passes, adjusting by one LOD level per pass, until budget is reached
     * or all nodes hit their respective limits (per-instance rangeMin or rangeMax).
     *
     * @param {Map<GSplatPlacement, GSplatOctreeInstance>} octreeInstances - Map of
     * GSplatOctreeInstance objects.
     * @param {number} budget - Target splat budget for octrees.
     * @param {number} globalMaxDistance - Max world-space distance for bucket calculation.
     */
    balance(octreeInstances, budget, globalMaxDistance) {
        // Initialize buckets on first use
        this._initBuckets();

        // Clear buckets
        for (let i = 0; i < NUM_BUCKETS; i++) {
            this._buckets[i].length = 0;
        }

        // Pre-compute multiplier for fast bucket calculation:
        // bucket = sqrt(worldDistance / globalMaxDistance) * NUM_BUCKETS
        // Simplified to: sqrt(worldDistance) * (NUM_BUCKETS / sqrt(globalMaxDistance))
        const bucketScale = NUM_BUCKETS / Math.sqrt(globalMaxDistance);

        // Collect all nodes into buckets based on world distance
        // Uses sqrt distribution: bucket 0 = nearest, bucket N-1 = farthest
        // At distance=0: bucket=0, at distance=maxDistance: bucket=NUM_BUCKETS-1
        // Nearby geometry gets more buckets (finer granularity) due to sqrt
        let totalOptimalSplats = 0;
        for (const [, inst] of octreeInstances) {
            const nodes = inst.octree.nodes;
            const nodeInfos = inst.nodeInfos;

            for (let nodeIndex = 0, len = nodes.length; nodeIndex < len; nodeIndex++) {
                const nodeInfo = nodeInfos[nodeIndex];
                const optimalLod = nodeInfo.optimalLod;
                if (optimalLod < 0) continue;

                // Cache lods array on nodeInfo for fast access in budget adjustment loops
                const lods = nodes[nodeIndex].lods;
                nodeInfo.lods = lods;

                // Fast bucket calculation: sqrt(distance) * pre-computed scale
                // Bucket 0 = nearest (highest priority), bucket N-1 = farthest
                const bucket = (Math.sqrt(nodeInfo.worldDistance) * bucketScale) >>> 0;
                const bucketIdx = bucket < NUM_BUCKETS ? bucket : NUM_BUCKETS - 1;
                this._buckets[bucketIdx].push(nodeInfo);

                totalOptimalSplats += lods[optimalLod].count;
            }
        }

        // Skip if already at budget
        let currentSplats = totalOptimalSplats;
        if (currentSplats === budget) {
            return;
        }

        // Determine direction
        const isOverBudget = currentSplats > budget;

        // Multiple passes: adjust by one LOD level per pass until budget is reached
        while (isOverBudget ? currentSplats > budget : currentSplats < budget) {
            let modified = false;

            if (isOverBudget) {
                // Degrade: process from FARTHEST (bucket NUM_BUCKETS-1) to NEAREST (bucket 0)
                // This preserves quality for nearby geometry
                for (let b = NUM_BUCKETS - 1; b >= 0 && currentSplats > budget; b--) {
                    const bucket = this._buckets[b];
                    for (let i = 0, len = bucket.length; i < len; i++) {
                        const nodeInfo = bucket[i];
                        if (nodeInfo.optimalLod < nodeInfo.inst.rangeMax) {
                            const lods = nodeInfo.lods;
                            const optimalLod = nodeInfo.optimalLod;
                            currentSplats -= lods[optimalLod].count - lods[optimalLod + 1].count;
                            nodeInfo.optimalLod = optimalLod + 1;
                            modified = true;
                            if (currentSplats <= budget) break;
                        }
                    }
                }
            } else {
                // Upgrade: process from NEAREST (bucket 0) to FARTHEST (bucket NUM_BUCKETS-1)
                // This improves quality for nearby geometry first
                for (let b = 0; b < NUM_BUCKETS && currentSplats < budget; b++) {
                    const bucket = this._buckets[b];
                    for (let i = 0, len = bucket.length; i < len; i++) {
                        const nodeInfo = bucket[i];
                        if (nodeInfo.optimalLod > nodeInfo.inst.rangeMin) {
                            const lods = nodeInfo.lods;
                            const optimalLod = nodeInfo.optimalLod;
                            const splatsAdded = lods[optimalLod - 1].count - lods[optimalLod].count;
                            if (currentSplats + splatsAdded <= budget) {
                                nodeInfo.optimalLod = optimalLod - 1;
                                currentSplats += splatsAdded;
                                modified = true;
                                if (currentSplats >= budget) break;
                            }
                        }
                    }
                }
            }

            // If no nodes were modified, we can't adjust further (all at limits)
            if (!modified) {
                break;
            }
        }
    }
}

export { GSplatBudgetBalancer };
