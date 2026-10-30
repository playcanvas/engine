/**
 * @import { GSplatOctreeInstance } from './gsplat-octree-instance.js'
 * @import { GSplatPlacement } from './gsplat-placement.js'
 */

// Floor on squared node distance before taking its log, so a camera inside a node stays finite.
const MIN_DISTANCE_SQ = 1e-12;

/**
 * Chooses the cut through the LOD trees of the octree instances within the splat budget: which
 * nodes are replaced by their children for more detail.
 *
 * A node at world distance `d` asks for the LOD band `1 + log_m(d / (s * b))`, floored and clamped
 * to its LOD range, where `b` and `m` are its placement's base distance and multiplier. `s` is one
 * scene-wide scale on every base distance: raising it pushes every band outward, so the splat total
 * grows with it. The allocator's whole job is to pick `s`:
 * - in target mode, the largest `s` whose total still fits the budget;
 * - in limit mode, the same but never above 1, so the configured distances are an upper bound on
 * detail and the budget only ever lowers it.
 *
 * A node is refined once its band is finer than its level, which happens at a switch point known
 * in closed form - once `ln s > ln(d / b) - (level - 1) ln m`. The switch points of all nodes lie on
 * the one `ln s` axis, whatever the per-placement base distances and multipliers. Refining a node
 * changes the splat count by its children's less its own.
 *
 * The top level nodes start the cut, and their refinements are queued by switch point. The
 * refinement the scale reaches first is taken while it fits the budget, and queues its children's.
 * As a child is never nearer the camera than its parent, its switch point always follows its
 * parent's, so taking them in this order sweeps the axis as if every node's switch points were
 * sorted, while only the nodes the cut refines and their children are ever visited - the cost
 * follows the size of the cut, not of the octrees. The first refinement that does not fit ends the
 * sweep, rather than being skipped, so a node's refinement does not depend on unrelated nodes
 * further along the axis, and small camera movements do not flip nodes on and off.
 *
 * Each instance is given the refined nodes and the scale the cut stopped at, see
 * GSplatOctreeInstance#beginTreeCut, for {@link GSplatOctreeInstance#applyLodChanges}.
 *
 * @ignore
 */
class GSplatBudgetBalancer {
    /**
     * The instances of the current {@link GSplatBudgetBalancer#balance}, indexed by the instance
     * index of the queue entries.
     *
     * @type {GSplatOctreeInstance[]}
     * @private
     */
    _instances = [];

    /**
     * Min-heap of pending refinements: each one's switch point on the scale axis, its instance
     * index and its node.
     *
     * @private
     */
    _heapKey = new Float64Array(256);

    /** @private */
    _heapInst = new Int32Array(256);

    /** @private */
    _heapNode = new Int32Array(256);

    /** @private */
    _heapSize = 0;

    /**
     * Chooses the cut through every instance's tree, see {@link GSplatBudgetBalancer}. A node coarser
     * than the instance's LOD range is always refined, and one at or finer than its finest level
     * never is.
     *
     * @param {Map<GSplatPlacement, GSplatOctreeInstance>} octreeInstances - The octree instances,
     * each with its distances prepared, see GSplatOctreeInstance#prepareDistances.
     * @param {number} budget - Splat budget for octrees. Infinity for no budget.
     * @param {boolean} limit - True when the budget only limits the configured LOD distances,
     * false when detail is raised to fill it.
     */
    balance(octreeInstances, budget, limit) {
        const instances = this._instances;
        instances.length = 0;
        this._heapSize = 0;

        let total = 0;
        for (const [, inst] of octreeInstances) {
            const index = instances.length;
            instances.push(inst);

            // a node's position on the axis is `ln(d / b) + (1 - rangeMin) ln m`, so its switch
            // point leaving the band `rangeMin + k` lies `k` steps of `ln m` below it
            const step = Math.log(inst.placement.lodMultiplier);
            const offset = -Math.log(inst.placement.lodBaseDistance) - (inst.rangeMin - 1) * step;
            inst.beginTreeCut(step, offset);

            // the top level nodes are stored first
            const { parentIndex, nodeSplats } = inst.octree;
            for (let n = 0; n < parentIndex.length && parentIndex[n] < 0; n++) {
                this._visitNode(inst, n);
                total += nodeSplats[n] + this._scheduleNode(index, inst, n);
            }
        }

        // take refinements in the order the scale reaches their switch points, while they fit -
        // in limit mode, never past a scale of 1, where ln s is 0
        let stop = Infinity;
        while (this._heapSize > 0) {
            const key = this._heapKey[0];
            if (limit && key >= 0) break;

            const index = this._heapInst[0];
            const n = this._heapNode[0];
            const inst = instances[index];
            const delta = inst.octree.childrenSplats[n] - inst.octree.nodeSplats[n];
            if (total + delta > budget) {
                stop = key;
                break;
            }

            this._heapPop();
            total += delta + this._refineNode(index, inst, n);
        }
        if (limit && stop > 0) {
            stop = 0;
        }

        for (let i = 0; i < instances.length; i++) {
            instances[i].treeCutStop = stop;
        }
        instances.length = 0;
    }

    /**
     * Measures a node the cut reached, and records its position on the scale axis.
     *
     * @param {GSplatOctreeInstance} inst - The instance.
     * @param {number} n - The node.
     * @private
     */
    _visitNode(inst, n) {
        // the log of the distance is half the log of the squared distance
        const dSq = inst.measureTreeNode(n);
        inst.treePosition[n] = 0.5 * Math.log(dSq > MIN_DISTANCE_SQ ? dSq : MIN_DISTANCE_SQ) + inst.treeOffset;
    }

    /**
     * Queues the refinement of a node, or refines it now when it is coarser than the LOD range
     * allows.
     *
     * @param {number} index - The instance index.
     * @param {GSplatOctreeInstance} inst - The instance.
     * @param {number} n - The node.
     * @returns {number} The splat change of the refinements made now.
     * @private
     */
    _scheduleNode(index, inst, n) {
        const octree = inst.octree;
        if (octree.childCount[n] === 0) return 0;

        // the node's level relative to the range, the band it is refined when leaving
        const band = octree.nodeLevel[n] - inst.rangeMin;
        if (band <= 0) return 0;
        if (band > inst.rangeMax - inst.rangeMin) {
            return octree.childrenSplats[n] - octree.nodeSplats[n] + this._refineNode(index, inst, n);
        }

        this._heapPush(inst.treePosition[n] - band * inst.treeStep, index, n);
        return 0;
    }

    /**
     * Refines a node: reaches its children and queues their refinements.
     *
     * @param {number} index - The instance index.
     * @param {GSplatOctreeInstance} inst - The instance.
     * @param {number} n - The node.
     * @returns {number} The splat change of the children's refinements made now.
     * @private
     */
    _refineNode(index, inst, n) {
        inst.treeRefined[n] = inst.treeStamp;
        const { childStart, childCount } = inst.octree;
        let delta = 0;
        for (let c = childStart[n], end = c + childCount[n]; c < end; c++) {
            this._visitNode(inst, c);
            delta += this._scheduleNode(index, inst, c);
        }
        return delta;
    }

    /**
     * @param {number} key - The switch point.
     * @param {number} index - The instance index.
     * @param {number} node - The node.
     * @private
     */
    _heapPush(key, index, node) {
        if (this._heapSize === this._heapKey.length) {
            const grow = (array) => {
                const larger = new /** @type {any} */ (array.constructor)(array.length * 2);
                larger.set(array);
                return larger;
            };
            this._heapKey = grow(this._heapKey);
            this._heapInst = grow(this._heapInst);
            this._heapNode = grow(this._heapNode);
        }

        const keys = this._heapKey;
        const instIndices = this._heapInst;
        const nodes = this._heapNode;
        let i = this._heapSize++;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (keys[parent] <= key) break;
            keys[i] = keys[parent];
            instIndices[i] = instIndices[parent];
            nodes[i] = nodes[parent];
            i = parent;
        }
        keys[i] = key;
        instIndices[i] = index;
        nodes[i] = node;
    }

    /**
     * Removes the entry with the smallest switch point.
     *
     * @private
     */
    _heapPop() {
        const size = --this._heapSize;
        if (size === 0) return;

        const keys = this._heapKey;
        const instIndices = this._heapInst;
        const nodes = this._heapNode;
        const key = keys[size];
        const index = instIndices[size];
        const node = nodes[size];
        let i = 0;
        for (;;) {
            let child = 2 * i + 1;
            if (child >= size) break;
            if (child + 1 < size && keys[child + 1] < keys[child]) child++;
            if (keys[child] >= key) break;
            keys[i] = keys[child];
            instIndices[i] = instIndices[child];
            nodes[i] = nodes[child];
            i = child;
        }
        keys[i] = key;
        instIndices[i] = index;
        nodes[i] = node;
    }
}

export { GSplatBudgetBalancer };
