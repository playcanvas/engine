/**
 * @import { GSplatOctree, GSplatOctreeTree } from './gsplat-octree.js'
 */

/**
 * Per node of an octree's tree, its band splat counts for LOD grouping - see
 * {@link GSplatLodTable#getGroupCounts}.
 *
 * @typedef {object} GSplatLodGroupCounts
 * @property {Float64Array} bandCount - Per tree node and band, the splat count its leaves render
 * together for that band, laid out like GSplatLodTable#bandCount.
 * @property {Uint8Array} renderable - Per tree node, 1 when any of its leaves has something
 * renderable in range.
 * @property {Float64Array} maxCount - Per tree node, its largest splat count over the bands.
 * @ignore
 */

/**
 * Everything the LOD allocator needs to know about an octree before it sees a camera, precomputed
 * once per LOD range.
 *
 * LOD selection is by distance band: a node's band is the LOD index its distance calls for,
 * clamped to the range. The table maps each band to the level the node actually renders for it,
 * and that level's splat count. Normally that is the band itself, since every level is kept - a
 * node whose levels barely differ in splat count still renders the level its distance asks for, so
 * nearby nodes keep sharing the same files instead of pulling in finer ones for a handful of
 * splats.
 *
 * Levels a node has no data for are resolved to one it has:
 * - A gap between two levels with data renders the next finer level with data, or the next coarser
 * one when there is nothing finer.
 * - A node whose data stops before `rangeMax` - the generator decimated the region to nothing at
 * the coarser levels - renders nothing at the bands past its coarsest data. That is its *empty*
 * level: zero splats and no file, placed at the first missing index. Without it such a node would
 * be pinned to its finest available data at any distance, which loads a whole file for a handful
 * of splats.
 *
 * The distinct levels of a node's bands, coarsest first, form its *chain*: the states streaming and
 * underfill step through. Chain entries are ordered by LOD index, not by splat count - nothing
 * guarantees a coarser level holds fewer splats, and barely decimated nodes often do not.
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
     * Number of bands, `rangeMax - rangeMin + 1`, and so the row length of
     * {@link GSplatLodTable#bandLod} and {@link GSplatLodTable#bandCount}.
     *
     * @type {number}
     */
    span;

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
     * Per node and band, the LOD index rendered for that band. Node `n`, band `b` (absolute LOD
     * index `rangeMin + b`) is at `n * span + b`. -1 across the whole row when the node has nothing
     * renderable in range. May be the node's empty level, which has no file.
     *
     * @type {Int16Array}
     */
    bandLod;

    /**
     * Per node and band, the splat count of {@link GSplatLodTable#bandLod}. Same layout.
     *
     * @type {Int32Array}
     */
    bandCount;

    /**
     * Band splat counts of the octree's tree nodes, built on first use by
     * {@link GSplatLodTable#getGroupCounts}.
     *
     * @type {GSplatLodGroupCounts|null}
     * @private
     */
    _groupCounts = null;

    /**
     * Sum of the coarsest band's splat count over all nodes - the splat cost of the whole octree at
     * its coarsest.
     *
     * @type {number}
     */
    totalCoarsestCount = 0;

    /**
     * Sum of the finest band's splat count over all nodes - the splat cost of the whole octree at
     * its finest.
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
        const span = rangeMax - rangeMin + 1;
        this.span = span;

        const bandLod = new Int16Array(nodeCount * span);
        const bandCount = new Int32Array(nodeCount * span);

        let totalCoarsestCount = 0;
        let totalFinestCount = 0;

        for (let n = 0; n < nodeCount; n++) {
            const lods = nodes[n].lods;
            const row = n * span;

            // The coarsest level in range holding data. When that is finer than rangeMax, the level
            // just above it becomes the node's empty level - see the class notes.
            let coarsestData = -1;
            for (let lod = rangeMax; lod >= rangeMin; lod--) {
                if (lods[lod].count > 0) {
                    coarsestData = lod;
                    break;
                }
            }

            if (coarsestData < 0) {
                bandLod.fill(-1, row, row + span);
                continue;
            }

            const emptyLod = coarsestData + 1;
            for (let b = 0; b < span; b++) {
                const band = rangeMin + b;
                let lod = band;
                if (band > coarsestData) {
                    lod = emptyLod;
                } else if (lods[band].count <= 0) {
                    // a gap: the next finer level with data, else the next coarser one
                    lod = -1;
                    for (let l = band - 1; l >= rangeMin; l--) {
                        if (lods[l].count > 0) {
                            lod = l;
                            break;
                        }
                    }
                    if (lod < 0) {
                        for (let l = band + 1; l <= coarsestData; l++) {
                            if (lods[l].count > 0) {
                                lod = l;
                                break;
                            }
                        }
                    }
                }
                bandLod[row + b] = lod;
                bandCount[row + b] = lod === emptyLod ? 0 : lods[lod].count;
            }

            totalFinestCount += bandCount[row];
            totalCoarsestCount += bandCount[row + span - 1];
        }

        this.bandLod = bandLod;
        this.bandCount = bandCount;
        this.totalCoarsestCount = totalCoarsestCount;
        this.totalFinestCount = totalFinestCount;
    }

    /**
     * Returns the band splat counts of every node of the octree's tree, for LOD grouping: a group
     * chooses one band for all its leaves, and each leaf then renders its own level for that band -
     * its own entry in {@link GSplatLodTable#bandLod}, with its own gaps and empty level resolved.
     * So a group's count for a band is the sum of its leaves' counts for it, taken from this table,
     * and a leaf's row is exactly its own. Built on first use.
     *
     * @param {GSplatOctreeTree} tree - The octree's tree.
     * @returns {GSplatLodGroupCounts} The counts.
     */
    getGroupCounts(tree) {
        if (this._groupCounts) return this._groupCounts;

        const span = this.span;
        const { childStart, childCount, children, leafStart, leafEnd } = tree;
        const bandCount = new Float64Array(tree.count * span);
        const renderable = new Uint8Array(tree.count);
        const maxCount = new Float64Array(tree.count);

        // children before parents - in depth-first order every child has a higher index
        for (let i = tree.count - 1; i >= 0; i--) {
            const row = i * span;
            if (childCount[i] === 0) {
                const leaf = leafStart[i];
                if (leaf < leafEnd[i] && this.bandLod[leaf * span] >= 0) {
                    renderable[i] = 1;
                    for (let b = 0; b < span; b++) bandCount[row + b] = this.bandCount[leaf * span + b];
                }
            } else {
                for (let k = 0; k < childCount[i]; k++) {
                    const child = children[childStart[i] + k];
                    if (!renderable[child]) continue;
                    renderable[i] = 1;
                    const childRow = child * span;
                    for (let b = 0; b < span; b++) bandCount[row + b] += bandCount[childRow + b];
                }
            }
            let largest = 0;
            for (let b = 0; b < span; b++) largest = Math.max(largest, bandCount[row + b]);
            maxCount[i] = largest;
        }

        this._groupCounts = { bandCount, renderable, maxCount };
        return this._groupCounts;
    }

    /**
     * Walks a node's chain to the coarsest level that is no finer than `lod` and no coarser than
     * `limit` levels above it, preferring the finest such level that satisfies `accept`.
     *
     * Streaming fallbacks use this instead of walking raw LOD indices, so they can only ever pick
     * a level the allocator itself could choose.
     *
     * @param {number} nodeIndex - The node.
     * @param {number} lod - The target LOD index, expected to be on the node's chain.
     * @param {number} limit - How many chain steps coarser than the target are acceptable.
     * @param {(lod: number) => boolean} accept - Predicate a level must satisfy.
     * @returns {number} The chosen LOD index, or -1 when nothing in the window qualifies.
     */
    findCoarserAccepted(nodeIndex, lod, limit, accept) {
        const bandLod = this.bandLod;
        const row = nodeIndex * this.span;
        const end = row + this.span;

        // first band rendering `lod`; bands are non-decreasing in LOD, so the chain continues after it
        let b = row;
        while (b < end && bandLod[b] !== lod) b++;
        if (b === end) return -1;

        // finest first: the target itself, then progressively coarser chain entries
        let steps = 0;
        let previous = -1;
        for (; b < end && steps <= limit; b++) {
            const candidate = bandLod[b];
            if (candidate === previous) continue;
            if (previous >= 0) steps++;
            if (steps > limit) break;
            if (accept(candidate)) return candidate;
            previous = candidate;
        }
        return -1;
    }

    /**
     * Returns the next coarser level on a node's chain, or -1 when `lod` is already its coarsest.
     *
     * @param {number} nodeIndex - The node.
     * @param {number} lod - A LOD index on the node's chain.
     * @returns {number} The next coarser chain entry, or -1.
     */
    coarserOnChain(nodeIndex, lod) {
        const bandLod = this.bandLod;
        const row = nodeIndex * this.span;
        for (let b = row, end = row + this.span; b < end; b++) {
            if (bandLod[b] > lod) return bandLod[b];
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
        const bandLod = this.bandLod;
        const row = nodeIndex * this.span;
        for (let b = row + this.span - 1; b >= row; b--) {
            if (bandLod[b] >= 0 && bandLod[b] < lod) return bandLod[b];
        }
        return -1;
    }
}

export { GSplatLodTable };
