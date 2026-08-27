import { Debug } from '../../core/debug.js';

/**
 * @import { GSplatOctree } from './gsplat-octree.js'
 */

/**
 * Everything the budget allocator can know about an octree before it sees a camera, precomputed
 * once per LOD range.
 *
 * Each node is reduced to a chain of single-level *upgrades*, ordered cheapest level first. The
 * chain is the Pareto frontier over (splat count, error): a level is kept only when it strictly
 * improves on the cheapest error seen so far, which discards levels that cost more and look worse
 * than something else the node already offers. Requiring a *strict* improvement also collapses
 * levels identical in both, so consecutive entries always differ in both and every upgrade's cost
 * stays above zero.
 *
 * Per update the allocator needs one number per node - its projected screen coverage - and the
 * value of an upgrade is `coverage * error removed / splats added`. The second factor is fixed, and
 * coverage is a single non-negative scalar multiplying every upgrade of that node equally, so the
 * running minimum that keeps a node's returns non-increasing can be taken here rather than each
 * update:
 *
 *   min over j<=k of (coverage * r_j)  ===  coverage * min over j<=k of r_j
 *
 * That is what {@link GSplatLodTable#upgradeRatio} stores, leaving one multiply per upgrade at
 * selection time.
 *
 * @ignore
 */
class GSplatLodTable {
    /**
     * Finest allowed LOD index.
     *
     * @type {number}
     */
    rangeMin;

    /**
     * Coarsest allowed LOD index.
     *
     * @type {number}
     */
    rangeMax;

    /**
     * How many octree instances currently hold this table. Managed by the owning
     * {@link GSplatOctree}, which drops the table when this reaches zero - so a table is retained
     * exactly while some instance is using its range, rather than on a fixed cap that could evict
     * one still in use.
     *
     * @type {number}
     */
    refCount = 0;

    /**
     * Per node, the cheapest renderable level in range - where the allocator starts before it
     * spends anything. -1 when the node has no renderable level in range at all.
     *
     * @type {Int16Array}
     */
    startLod;

    /**
     * Per node, the splat count at {@link GSplatLodTable#startLod}.
     *
     * @type {Int32Array}
     */
    startCount;

    /**
     * Per node, where its upgrade slice begins. Node `n` owns
     * `[firstUpgrade[n], firstUpgrade[n + 1])`, so the array holds one extra entry and the slice
     * length needs no second array.
     *
     * @type {Int32Array}
     */
    firstUpgrade;

    /**
     * Per upgrade, the LOD index it moves the node to.
     *
     * @type {Int16Array}
     */
    upgradeToLod;

    /**
     * Per upgrade, the additional splats it costs. Always above zero.
     *
     * @type {Int32Array}
     */
    upgradeCost;

    /**
     * Per upgrade, error removed per additional splat, clamped to the running minimum along the
     * node's chain so returns never increase as a node gets finer. Multiplying by the node's
     * coverage yields the upgrade's value.
     *
     * @type {Float32Array}
     */
    upgradeRatio;

    /**
     * Sum of {@link GSplatLodTable#startCount} over all nodes - the splat cost of the whole octree
     * before any upgrade is bought.
     *
     * @type {number}
     */
    totalStartCount = 0;

    /**
     * Sum of the finest renderable level in range over all nodes - the splat cost with every
     * upgrade bought.
     *
     * @type {number}
     */
    totalFinestCount = 0;

    /**
     * @param {GSplatOctree} octree - The octree to build the table for.
     * @param {number} rangeMin - Finest allowed LOD index.
     * @param {number} rangeMax - Coarsest allowed LOD index.
     */
    constructor(octree, rangeMin, rangeMax) {
        this.rangeMin = rangeMin;
        this.rangeMax = rangeMax;

        const nodes = octree.nodes;
        const nodeCount = nodes.length;
        const spanLength = rangeMax - rangeMin + 1;

        this.startLod = new Int16Array(nodeCount);
        this.startCount = new Int32Array(nodeCount);
        this.firstUpgrade = new Int32Array(nodeCount + 1);

        // A node contributes at most one upgrade per level boundary in range.
        const maxUpgrades = nodeCount * Math.max(0, spanLength - 1);
        const upgradeToLod = new Int16Array(maxUpgrades);
        const upgradeCost = new Int32Array(maxUpgrades);
        const upgradeRatio = new Float32Array(maxUpgrades);

        // Reused per node: the candidate levels, then the frontier compacted in place over them.
        const scratch = new Int16Array(spanLength);

        let upgradeCount = 0;
        let totalStartCount = 0;
        let totalFinestCount = 0;

        for (let n = 0; n < nodeCount; n++) {
            const lods = nodes[n].lods;
            this.firstUpgrade[n] = upgradeCount;

            // Collect renderable levels in range, ordered by ascending cost and then ascending
            // error. Insertion sort: the list is at most spanLength long and, since coarser levels
            // normally hold fewer splats, usually already in order.
            let candidateCount = 0;
            for (let lod = rangeMax; lod >= rangeMin; lod--) {
                if (lods[lod].count <= 0) continue;
                let j = candidateCount++;
                while (j > 0) {
                    const prev = scratch[j - 1];
                    if (lods[prev].count < lods[lod].count ||
                        (lods[prev].count === lods[lod].count && lods[prev].error <= lods[lod].error)) {
                        break;
                    }
                    scratch[j] = prev;
                    j--;
                }
                scratch[j] = lod;
            }

            // Pareto frontier in one sweep of that order. Compacts in place, since the write index
            // never runs ahead of the read index.
            let frontierCount = 0;
            let bestError = Infinity;
            for (let i = 0; i < candidateCount; i++) {
                const lod = scratch[i];
                if (lods[lod].error < bestError) {
                    bestError = lods[lod].error;
                    scratch[frontierCount++] = lod;
                }
            }

            if (frontierCount === 0) {
                this.startLod[n] = -1;
                this.startCount[n] = 0;
                continue;
            }

            // Reduce the frontier to its upper concave hull over (count, -error). The frontier only
            // guarantees that error falls as cost rises - the slopes between consecutive levels can
            // still *rise* towards the finer end, and a level sitting below the chord between its
            // neighbours is never worth stopping at. Dropping it pools the levels either side into
            // one compound upgrade priced at the chord, which is the value actually on offer.
            //
            // Without this the allocator would have to clamp each marginal ratio to the running
            // minimum to keep its greedy order valid, and that understates the compound step: for
            // levels (20,10) -> (90,8) -> (100,0) both ratios clamp to 2/70, hiding the 10-error
            // reduction available for 80 splats at 0.125. Real authored error curves are not
            // concave - this binds on 9-27% of upgrades across measured captures - so the clamp
            // could leave a node stranded at its coarsest level while cheaper, less valuable
            // upgrades elsewhere won the budget. Compacts in place, as above.
            let hullCount = 0;
            for (let i = 0; i < frontierCount; i++) {
                const lod = scratch[i];
                while (hullCount >= 2) {
                    const a = scratch[hullCount - 2];
                    const b = scratch[hullCount - 1];
                    // sign of (b - a) x (lod - a) with y = -error; >= 0 means b is not above the
                    // chord a -> lod, so it cannot be an optimal stopping point
                    const cross = (lods[b].count - lods[a].count) * (lods[a].error - lods[lod].error) -
                                  (lods[a].error - lods[b].error) * (lods[lod].count - lods[a].count);
                    if (cross >= 0) hullCount--; else break;
                }
                scratch[hullCount++] = lod;
            }
            frontierCount = hullCount;

            const startLod = scratch[0];
            this.startLod[n] = startLod;
            this.startCount[n] = lods[startLod].count;
            totalStartCount += lods[startLod].count;
            totalFinestCount += lods[scratch[frontierCount - 1]].count;

            for (let i = 1; i < frontierCount; i++) {
                const coarseLod = scratch[i - 1];
                const fineLod = scratch[i];
                const cost = lods[fineLod].count - lods[coarseLod].count;
                const benefit = lods[coarseLod].error - lods[fineLod].error;
                upgradeToLod[upgradeCount] = fineLod;
                upgradeCost[upgradeCount] = cost;
                upgradeRatio[upgradeCount] = benefit / cost;
                upgradeCount++;
            }

            // The hull makes this hold by construction, and both the allocator's single sweep and
            // its lazy re-insertion depend on it.
            const emitted = upgradeCount;
            Debug.call(() => {
                this._assertNonIncreasing(n, upgradeRatio, emitted);
            });
        }

        this.firstUpgrade[nodeCount] = upgradeCount;
        this.totalStartCount = totalStartCount;
        this.totalFinestCount = totalFinestCount;

        // Trim to what was actually used - dominated levels mean this is often well short of the
        // upper bound, and the arrays live as long as the octree.
        this.upgradeToLod = upgradeToLod.subarray(0, upgradeCount).slice();
        this.upgradeCost = upgradeCost.subarray(0, upgradeCount).slice();
        this.upgradeRatio = upgradeRatio.subarray(0, upgradeCount).slice();
    }

    /**
     * Asserts that a node's emitted marginal ratios never rise towards the finer end.
     *
     * @param {number} nodeIndex - The node whose chain was just emitted.
     * @param {Float32Array} ratios - The ratio array being filled.
     * @param {number} end - One past the node's last emitted upgrade.
     * @private
     */
    _assertNonIncreasing(nodeIndex, ratios, end) {
        for (let k = this.firstUpgrade[nodeIndex] + 1; k < end; k++) {
            Debug.assert(ratios[k] <= ratios[k - 1],
                `GSplatLodTable: node ${nodeIndex} has rising marginal returns (${ratios[k - 1]} -> ${ratios[k]}); the concave hull should have pooled these levels.`);
        }
    }

    /**
     * Walks a node's chain to the coarsest level that is no finer than `lod` and no coarser than
     * `limit` levels above it, preferring the finest such level that satisfies `accept`.
     *
     * Streaming fallbacks use this instead of walking raw LOD indices, so they can only ever pick
     * a level the allocator itself would consider. That keeps the splat count monotone as a node
     * climbs towards its target: chain entries are ordered by ascending cost, whereas raw level
     * indices are not - nothing guarantees a coarser level holds fewer splats.
     *
     * @param {number} nodeIndex - The node.
     * @param {number} lod - The target LOD index, expected to be on the node's chain.
     * @param {number} limit - How many chain steps coarser than the target are acceptable.
     * @param {(lod: number) => boolean} accept - Predicate a level must satisfy.
     * @returns {number} The chosen LOD index, or -1 when nothing in the window qualifies.
     */
    findCoarserAccepted(nodeIndex, lod, limit, accept) {
        const start = this.firstUpgrade[nodeIndex];
        const end = this.firstUpgrade[nodeIndex + 1];

        // Position of `lod` in the chain. Entry -1 is startLod, entry k is upgradeToLod[start + k].
        let position = -1;
        for (let k = start; k < end; k++) {
            if (this.upgradeToLod[k] === lod) {
                position = k - start;
                break;
            }
        }
        if (position < 0 && this.startLod[nodeIndex] !== lod) return -1;

        // Finest first: the target itself, then progressively coarser chain entries.
        const lowest = Math.max(-1, position - limit);
        for (let p = position; p >= lowest; p--) {
            const candidate = p < 0 ? this.startLod[nodeIndex] : this.upgradeToLod[start + p];
            if (accept(candidate)) return candidate;
        }
        return -1;
    }

    /**
     * Returns the next coarser level on a node's chain, or -1 when `lod` is already its cheapest.
     *
     * @param {number} nodeIndex - The node.
     * @param {number} lod - A LOD index on the node's chain.
     * @returns {number} The next coarser chain entry, or -1.
     */
    coarserOnChain(nodeIndex, lod) {
        const start = this.firstUpgrade[nodeIndex];
        const end = this.firstUpgrade[nodeIndex + 1];
        for (let k = start; k < end; k++) {
            if (this.upgradeToLod[k] === lod) {
                return k === start ? this.startLod[nodeIndex] : this.upgradeToLod[k - 1];
            }
        }
        return -1;
    }

    /**
     * Returns the next finer level on a node's chain, or -1 when `lod` is already its finest.
     *
     * @param {number} nodeIndex - The node.
     * @param {number} lod - A LOD index on the node's chain.
     * @returns {number} The next finer chain entry, or -1.
     */
    finerOnChain(nodeIndex, lod) {
        const start = this.firstUpgrade[nodeIndex];
        const end = this.firstUpgrade[nodeIndex + 1];
        if (start === end) return -1;
        if (this.startLod[nodeIndex] === lod) return this.upgradeToLod[start];
        for (let k = start; k < end - 1; k++) {
            if (this.upgradeToLod[k] === lod) return this.upgradeToLod[k + 1];
        }
        return -1;
    }
}

export { GSplatLodTable };
