/**
 * @import { GSplatOctreeInstance } from './gsplat-octree-instance.js'
 * @import { GSplatPlacement } from './gsplat-placement.js'
 */

import { NUM_BUCKETS } from './constants.js';

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
     */
    balance(octreeInstances, budget) {
        // Initialize buckets on first use
        this._initBuckets();

        // Clear buckets
        for (let i = 0; i < NUM_BUCKETS; i++) {
            this._buckets[i].length = 0;
        }

        // Collect all nodes into buckets (indices precomputed in evaluateNodeLods when enforcing budget).
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

                this._buckets[nodeInfo.budgetBucket].push(nodeInfo);

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
        let done = false;
        while (!done && (isOverBudget ? currentSplats > budget : currentSplats < budget)) {
            let modified = false;

            if (isOverBudget) {
                // Degrade: process from FARTHEST (bucket NUM_BUCKETS-1) to NEAREST (bucket 0)
                // This preserves quality for nearby geometry
                for (let b = NUM_BUCKETS - 1; b >= 0 && !done; b--) {
                    const bucket = this._buckets[b];
                    for (let i = 0, len = bucket.length; i < len; i++) {
                        const nodeInfo = bucket[i];
                        if (nodeInfo.optimalLod < nodeInfo.inst.rangeMax) {
                            const lods = nodeInfo.lods;
                            const optimalLod = nodeInfo.optimalLod;
                            currentSplats -= lods[optimalLod].count - lods[optimalLod + 1].count;
                            nodeInfo.optimalLod = optimalLod + 1;
                            modified = true;
                            if (currentSplats <= budget) {
                                done = true;
                                break;
                            }
                        }
                    }
                }
            } else {
                // Upgrade: process from NEAREST (bucket 0) to FARTHEST (bucket NUM_BUCKETS-1)
                // This improves quality for nearby geometry first
                for (let b = 0; b < NUM_BUCKETS && !done; b++) {
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
                                if (currentSplats >= budget) {
                                    done = true;
                                    break;
                                }
                            } else {
                                done = true;
                                break;
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
