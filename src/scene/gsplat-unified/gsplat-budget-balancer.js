/**
 * @import { GSplatOctreeInstance } from './gsplat-octree-instance.js'
 * @import { GSplatPlacement } from './gsplat-placement.js'
 * @import { GSplatLodTable } from './gsplat-lod-table.js'
 */

import { NUM_VALUE_BUCKETS } from './constants.js';

// Monotonic float -> integer key. The bit pattern of a positive float is order preserving, and
// linear in log2 of the value, so bucketing on it is a log-spaced bucketing without a Math.log.
const _f32 = new Float32Array(1);
const _u32 = new Uint32Array(_f32.buffer);
const keyOf = (value) => {
    _f32[0] = value;
    return _u32[0];
};

// Fixed bucket scale rather than one derived from the values seen this update. A derived range
// shifts every update, which moves a node between buckets when nothing about that node changed -
// and that is a flicker source in its own right.
//
// The window has to cover every `coverage * error-per-splat` a scene can produce. Coverage is
// structurally bounded to [1e-12, 1] by NodeInfo#lodCoverage, so scene extent does not enter into
// it. The ratio does: with derived errors it is `ln(a/b) / (a - b)` over adjacent frontier counts,
// which peaks at ln 2 for counts 1 -> 2 and falls as ~ln2/count for large nodes. So the low end
// tracks splats *per node* rather than scene size - 1e-24 leaves room for a node of ~1e12 splats.
// The high end allows for authored errors far larger than any measured (~3), since the colour term
// in splat-transform's metric is unnormalised and has no upper bound.
//
// Anything outside the window still resolves, it just shares the first or last bucket and loses
// ordering against its neighbours there.
const KEY_LO = keyOf(1e-24);
const KEY_HI = keyOf(1e3);
const KEY_SCALE = (NUM_VALUE_BUCKETS - 1) / (KEY_HI - KEY_LO);

// The bit key of 1.0 - log2 of 0 in key units. Subtracted when adding two keys, since each
// carries the exponent bias once.
const KEY_ONE = keyOf(1);

// GSplatPlacement#lodFalloff is an exponent on coverage. It is applied in key space - the bit key
// is piecewise-linear in log2, so cov^falloff becomes one multiply instead of a Math.pow per node,
// at a cost of at most a bucket or two of quantisation. The exponent pivots around a mid-field
// coverage (a node roughly a hundred radii away) rather than around 1: at the pivot the value is
// unchanged by falloff, so the slider tilts a placement's budget between its near and far field
// instead of deflating the whole placement against other instances.
const KEY_PIVOT = keyOf(1e-4);

/**
 * Distributes a splat budget across octree instances by choosing a LOD level per node.
 *
 * Every node starts at the cheapest level it can render, which is the coarsest the scene can be and
 * therefore always within budget. Each single-level upgrade available anywhere in the scene is then
 * ranked by `coverage * error removed / splats added` - value for money, weighted by how much
 * screen the node covers - and they are bought best first until one does not fit.
 *
 * Stopping at the first upgrade that does not fit, rather than skipping it and continuing, is
 * deliberate. Continuing would make a node's outcome depend on whether some unrelated cheaper
 * upgrade happened to be considered first, so small camera movements would flip levels on and off.
 * The cost is leaving some budget unspent.
 *
 * Only a node's next unbought upgrade is ever in the queue; buying it enqueues its successor. That
 * keeps at most one entry per node live, which is what lets the buckets be intrusive lists over
 * preallocated typed arrays with no per-entry storage at all.
 *
 * A successor can be worth more than what was just bought, since values are the best deal reachable
 * from a level rather than that level's own slope. Requeueing is therefore capped at the bucket
 * being drained, so a run always completes within the sweep that started it - see the drain.
 *
 * @ignore
 */
class GSplatBudgetBalancer {
    /** @type {Int32Array} */
    _bucketHead = new Int32Array(NUM_VALUE_BUCKETS);

    /** @type {Int32Array} */
    _bucketTail = new Int32Array(NUM_VALUE_BUCKETS);

    /**
     * Next node in the same bucket, indexed by global node index. -1 terminates the list.
     *
     * @type {Int32Array}
     * @private
     */
    _next = new Int32Array(0);

    /**
     * Index of a node's next unbought upgrade, indexed by global node index.
     *
     * @type {Int32Array}
     * @private
     */
    _pending = new Int32Array(0);

    /**
     * Node coverage, indexed by global node index. Copied out of NodeInfo during the seed pass so
     * the drain, which visits nodes in value order rather than index order, reads a flat array.
     *
     * @type {Float32Array}
     * @private
     */
    _coverage = new Float32Array(0);

    /**
     * Per node, the falloff-scaled bit key of its coverage, used instead of {@link _coverage} when
     * any instance has a non-default lodFalloff. See KEY_PIVOT.
     *
     * @type {Float64Array}
     * @private
     */
    _coverageKey = new Float64Array(0);

    /**
     * Which instance owns each global node index.
     *
     * @type {Uint16Array}
     * @private
     */
    _instanceOf = new Uint16Array(0);

    /**
     * Global node index of each instance's first node.
     *
     * @type {number[]}
     * @private
     */
    _instanceBase = [];

    /** @type {GSplatOctreeInstance[]} */
    _instances = [];

    /** @type {GSplatLodTable[]} */
    _tables = [];

    /**
     * @param {number} capacity - Required global node capacity.
     * @private
     */
    _ensureCapacity(capacity) {
        if (this._next.length >= capacity) return;
        const size = Math.max(capacity, this._next.length * 2, 1024);
        this._next = new Int32Array(size);
        this._pending = new Int32Array(size);
        this._coverage = new Float32Array(size);
        this._coverageKey = new Float64Array(size);
        this._instanceOf = new Uint16Array(size);
    }

    /**
     * Maps an upgrade value to a bucket. Monotonic in the value, so ordering between different
     * upgrades is preserved; the drain caps where a successor may be requeued.
     *
     * @param {number} value - Coverage-weighted error reduction per splat.
     * @returns {number} Bucket index.
     * @private
     */
    _bucketOf(value) {
        const bucket = ((keyOf(value) - KEY_LO) * KEY_SCALE) | 0;
        return bucket < 0 ? 0 : (bucket >= NUM_VALUE_BUCKETS ? NUM_VALUE_BUCKETS - 1 : bucket);
    }

    /**
     * Maps a value already expressed as a bit key - the sum of a falloff-scaled coverage key and a
     * ratio key - to a bucket.
     *
     * @param {number} key - Bit-key of the value.
     * @returns {number} Bucket index.
     * @private
     */
    _bucketOfKey(key) {
        const bucket = ((key - KEY_LO) * KEY_SCALE) | 0;
        return bucket < 0 ? 0 : (bucket >= NUM_VALUE_BUCKETS ? NUM_VALUE_BUCKETS - 1 : bucket);
    }

    /**
     * @param {number} bucket - Bucket to append to.
     * @param {number} node - Global node index.
     * @private
     */
    _push(bucket, node) {
        this._next[node] = -1;
        if (this._bucketHead[bucket] < 0) {
            this._bucketHead[bucket] = node;
        } else {
            this._next[this._bucketTail[bucket]] = node;
        }
        this._bucketTail[bucket] = node;
    }

    /**
     * Assigns a LOD level to every node of every instance, keeping the total splat count within
     * budget. Reads NodeInfo#lodCoverage, writes NodeInfo#optimalLod.
     *
     * @param {Map<GSplatPlacement, GSplatOctreeInstance>} octreeInstances - Map of
     * GSplatOctreeInstance objects.
     * @param {number} budget - Target splat budget for octrees.
     */
    balance(octreeInstances, budget) {
        const instances = this._instances;
        const tables = this._tables;
        const bases = this._instanceBase;
        instances.length = 0;
        tables.length = 0;
        bases.length = 0;

        let nodeTotal = 0;
        let totalStartCount = 0;
        let totalFinestCount = 0;
        // With every instance at the default falloff the exact value path is used, bit-identical
        // to ranking without the feature; any non-default falloff switches all ranking to the
        // key-space path, where the exponent is a multiply. See KEY_PIVOT.
        let useKeys = false;
        for (const [, inst] of octreeInstances) {
            // resolveLodRange() already built this for the instance's range; resolving it again
            // here would rebuild whenever two instances of one octree differ in range
            const table = inst.lodTable;
            bases.push(nodeTotal);
            instances.push(inst);
            tables.push(table);
            nodeTotal += inst.octree.nodes.length;
            totalStartCount += table.totalStartCount;
            totalFinestCount += table.totalFinestCount;
            if (inst.placement.lodFalloff !== 1) useKeys = true;
        }
        if (instances.length === 0) return;

        // Everything fits, or nothing does - either way there is nothing to trade off.
        if (totalFinestCount <= budget) {
            this._assignChainEnd(true);
            return;
        }
        if (totalStartCount >= budget) {
            this._assignChainEnd(false);
            return;
        }

        this._ensureCapacity(nodeTotal);
        this._bucketHead.fill(-1);

        const next = this._next;
        const pending = this._pending;
        const coverage = this._coverage;
        const coverageKey = this._coverageKey;
        const instanceOf = this._instanceOf;

        // Seed pass: floor every node and queue its first upgrade.
        for (let i = 0; i < instances.length; i++) {
            const inst = instances[i];
            const table = tables[i];
            const nodeInfos = inst.nodeInfos;
            const base = bases[i];
            const { startLod, firstUpgrade, upgradeRatio } = table;
            const falloff = inst.placement.lodFalloff;

            for (let n = 0, len = nodeInfos.length; n < len; n++) {
                const nodeInfo = nodeInfos[n];
                const lod = startLod[n];
                nodeInfo.optimalLod = lod;
                if (lod < 0) continue;

                const first = firstUpgrade[n];
                if (first >= firstUpgrade[n + 1]) continue;

                const g = base + n;
                const cov = nodeInfo.lodCoverage;
                coverage[g] = cov;
                instanceOf[g] = i;
                pending[g] = first;
                if (useKeys) {
                    coverageKey[g] = falloff * (keyOf(cov) - KEY_PIVOT) + KEY_PIVOT;
                    this._push(this._bucketOfKey(coverageKey[g] + keyOf(upgradeRatio[first]) - KEY_ONE), g);
                } else {
                    this._push(this._bucketOf(cov * upgradeRatio[first]), g);
                }
            }
        }

        // Drain: best deals first, stopping at the first upgrade that does not fit.
        //
        // Each bucket is consumed as a queue: pop the head, then push the node's successor, which
        // may land back in this same bucket and must be appended behind whatever is still queued.
        // Popping first is what makes that safe - reading the popped node's link afterwards would
        // miss a same-bucket re-push whenever it was the tail.
        let spent = totalStartCount;
        for (let bucket = NUM_VALUE_BUCKETS - 1; bucket >= 0; bucket--) {
            let g = this._bucketHead[bucket];
            while (g >= 0) {
                this._bucketHead[bucket] = next[g];

                const i = instanceOf[g];
                const table = tables[i];
                const k = pending[g];
                const cost = table.upgradeCost[k];
                if (spent + cost > budget) return;

                spent += cost;
                const n = g - bases[i];
                instances[i].nodeInfos[n].optimalLod = table.upgradeToLod[k];

                const k2 = k + 1;
                if (k2 < table.firstUpgrade[n + 1]) {
                    pending[g] = k2;
                    // Never above the bucket being drained. A successor can be worth more than what
                    // was just bought - values are the best deal reachable from a level, so a poorly
                    // valued step opens a better run - and this sweep has already passed the higher
                    // buckets. Since every update re-floors from the cheapest level, a node pushed
                    // above the sweep would be dropped on every update, not merely delayed, and
                    // could never finish the run it started. Requeueing it here instead completes
                    // the run in this sweep, at the priority of the step that opened it.
                    const target = useKeys ?
                        this._bucketOfKey(coverageKey[g] + keyOf(table.upgradeRatio[k2]) - KEY_ONE) :
                        this._bucketOf(coverage[g] * table.upgradeRatio[k2]);
                    this._push(target > bucket ? bucket : target, g);
                }
                g = this._bucketHead[bucket];
            }
        }
    }

    /**
     * Puts every node at one end of its LOD chain, for the cases where the budget makes the ranking
     * irrelevant - either the whole scene fits at its finest, or not even the cheapest scene does.
     *
     * @param {boolean} finest - True for the finest level in range, false for the cheapest.
     * @private
     */
    _assignChainEnd(finest) {
        for (let i = 0; i < this._instances.length; i++) {
            const table = this._tables[i];
            const nodeInfos = this._instances[i].nodeInfos;
            const { startLod, firstUpgrade, upgradeToLod } = table;
            for (let n = 0, len = nodeInfos.length; n < len; n++) {
                const lod = startLod[n];
                if (lod < 0 || !finest) {
                    nodeInfos[n].optimalLod = lod;
                    continue;
                }
                const end = firstUpgrade[n + 1];
                nodeInfos[n].optimalLod = end > firstUpgrade[n] ? upgradeToLod[end - 1] : lod;
            }
        }
    }
}

export { GSplatBudgetBalancer };
