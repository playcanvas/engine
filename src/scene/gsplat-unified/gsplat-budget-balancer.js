/**
 * @import { GSplatOctreeInstance } from './gsplat-octree-instance.js'
 * @import { GSplatPlacement } from './gsplat-placement.js'
 */

import { NUM_BUCKETS } from './constants.js';

/**
 * Balances splat budget across multiple octree instances by adjusting LOD levels. Uses projected
 * error reduction when complete error metadata is available, otherwise the legacy distance buckets.
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

    /** @type {Array|null} @private */
    _errorNodes = null;

    /** @type {Int32Array|null} @private */
    _transitionNodes = null;

    /** @type {Int16Array|null} @private */
    _transitionFineLods = null;

    /** @type {Int16Array|null} @private */
    _transitionCoarseLods = null;

    /** @type {Float64Array|null} @private */
    _transitionCosts = null;

    /** @type {Float64Array|null} @private */
    _transitionPriorities = null;

    /** @type {Int16Array|null} @private */
    _frontierScratch = null;

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
     * @param {number} capacity - Required transition capacity.
     * @private
     */
    _ensureTransitionCapacity(capacity) {
        if ((this._transitionNodes?.length ?? 0) >= capacity) return;
        const size = Math.max(capacity, (this._transitionNodes?.length ?? 0) * 2, 64);
        this._transitionNodes = new Int32Array(size);
        this._transitionFineLods = new Int16Array(size);
        this._transitionCoarseLods = new Int16Array(size);
        this._transitionCosts = new Float64Array(size);
        this._transitionPriorities = new Float64Array(size);
    }

    /**
     * Balances splat budget across all octree instances by adjusting LOD levels.
     *
     * @param {Map<GSplatPlacement, GSplatOctreeInstance>} octreeInstances - Map of
     * GSplatOctreeInstance objects.
     * @param {number} budget - Target splat budget for octrees.
     */
    balance(octreeInstances, budget) {
        // Usable error metadata is a property of each asset, settled when its octree
        // was built, so this is one lookup per instance instead of a walk over every
        // node's LOD levels each frame.
        let completeErrors = true;
        for (const [, inst] of octreeInstances) {
            if (!inst.octree.lodErrors) {
                completeErrors = false;
                break;
            }
        }

        // only the error allocator needs the visible-node count, to size its
        // transition arrays
        let activeNodes = 0;
        if (completeErrors) {
            for (const [, inst] of octreeInstances) {
                const nodeInfos = inst.nodeInfos;
                for (let nodeIndex = 0; nodeIndex < inst.octree.nodes.length; nodeIndex++) {
                    if (nodeInfos[nodeIndex].optimalLod >= 0) activeNodes++;
                }
            }
        }

        if (completeErrors && activeNodes > 0) {
            this._balanceErrors(octreeInstances, budget, activeNodes);
        } else {
            this._balanceDistance(octreeInstances, budget);
        }
    }

    /**
     * Allocate budget using projected approximation-error reduction per additional splat.
     *
     * @param {Map<GSplatPlacement, GSplatOctreeInstance>} octreeInstances - Octree instances.
     * @param {number} budget - Target splat budget.
     * @param {number} activeNodes - Number of visible nodes.
     * @private
     */
    _balanceErrors(octreeInstances, budget, activeNodes) {
        this._initBuckets();
        for (let i = 0; i < NUM_BUCKETS; i++) this._buckets[i].length = 0;

        if (!this._errorNodes) this._errorNodes = [];
        this._errorNodes.length = 0;

        let maxLods = 0;
        for (const [, inst] of octreeInstances) maxLods = Math.max(maxLods, inst.rangeMax - inst.rangeMin + 1);
        this._ensureTransitionCapacity(activeNodes * Math.max(0, maxLods - 1));
        if ((this._frontierScratch?.length ?? 0) < maxLods) this._frontierScratch = new Int16Array(maxLods);

        let currentSplats = 0;
        let transitionCount = 0;
        let minLogPriority = Infinity;
        let maxLogPriority = -Infinity;

        for (const [, inst] of octreeInstances) {
            const nodes = inst.octree.nodes;
            for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
                const nodeInfo = inst.nodeInfos[nodeIndex];
                if (nodeInfo.optimalLod < 0) continue;
                const lods = nodes[nodeIndex].lods;
                nodeInfo.lods = lods;

                let frontierCount = 0;
                for (let lod = inst.rangeMin; lod <= inst.rangeMax; lod++) {
                    if (lods[lod].count <= 0) continue;
                    let dominated = false;
                    for (let other = inst.rangeMin; other <= inst.rangeMax; other++) {
                        if (other === lod || lods[other].count <= 0) continue;
                        const noMoreCost = lods[other].count <= lods[lod].count;
                        const noMoreError = lods[other].error <= lods[lod].error;
                        const strictlyBetter = lods[other].count < lods[lod].count || lods[other].error < lods[lod].error;
                        if (noMoreCost && noMoreError && strictlyBetter) {
                            dominated = true;
                            break;
                        }
                    }
                    if (!dominated) this._frontierScratch[frontierCount++] = lod;
                }

                if (frontierCount === 0) {
                    nodeInfo.optimalLod = -1;
                    continue;
                }

                for (let i = 1; i < frontierCount; i++) {
                    const lod = this._frontierScratch[i];
                    let j = i;
                    while (j > 0 && lods[this._frontierScratch[j - 1]].count > lods[lod].count) {
                        this._frontierScratch[j] = this._frontierScratch[j - 1];
                        j--;
                    }
                    this._frontierScratch[j] = lod;
                }

                const errorNodeIndex = this._errorNodes.length;
                this._errorNodes.push(nodeInfo);
                nodeInfo.optimalLod = this._frontierScratch[0];
                currentSplats += lods[nodeInfo.optimalLod].count;

                let previousPriority = Infinity;
                for (let i = 1; i < frontierCount; i++) {
                    const coarseLod = this._frontierScratch[i - 1];
                    const fineLod = this._frontierScratch[i];
                    const cost = lods[fineLod].count - lods[coarseLod].count;
                    const benefit = lods[coarseLod].error - lods[fineLod].error;
                    const priority = Math.min(previousPriority, nodeInfo.lodCoverage * benefit / cost);
                    this._transitionNodes[transitionCount] = errorNodeIndex;
                    this._transitionFineLods[transitionCount] = fineLod;
                    this._transitionCoarseLods[transitionCount] = coarseLod;
                    this._transitionCosts[transitionCount] = cost;
                    this._transitionPriorities[transitionCount] = priority;
                    if (priority > 0) {
                        const logPriority = Math.log(priority);
                        minLogPriority = Math.min(minLogPriority, logPriority);
                        maxLogPriority = Math.max(maxLogPriority, logPriority);
                    }
                    previousPriority = priority;
                    transitionCount++;
                }
            }
        }

        if (currentSplats >= budget || transitionCount === 0) return;

        const logRange = maxLogPriority - minLogPriority;
        for (let i = 0; i < transitionCount; i++) {
            const priority = this._transitionPriorities[i];
            let bucket = 0;
            if (priority > 0 && logRange > 0) {
                bucket = Math.floor((Math.log(priority) - minLogPriority) * (NUM_BUCKETS - 1) / logRange);
            } else if (priority > 0) {
                bucket = NUM_BUCKETS - 1;
            }
            this._buckets[bucket].push(i);
        }

        for (let bucket = NUM_BUCKETS - 1; bucket >= 0; bucket--) {
            const transitions = this._buckets[bucket];
            for (let i = 0; i < transitions.length; i++) {
                const transition = transitions[i];
                const nodeInfo = this._errorNodes[this._transitionNodes[transition]];
                if (nodeInfo.optimalLod !== this._transitionCoarseLods[transition]) continue;
                const cost = this._transitionCosts[transition];
                if (currentSplats + cost <= budget) {
                    currentSplats += cost;
                    nodeInfo.optimalLod = this._transitionFineLods[transition];
                }
            }
        }
    }

    /**
     * Legacy distance-bucket allocator used when error metadata is absent or incomplete.
     *
     * @param {Map<GSplatPlacement, GSplatOctreeInstance>} octreeInstances - Octree instances.
     * @param {number} budget - Target splat budget.
     * @private
     */
    _balanceDistance(octreeInstances, budget) {
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
