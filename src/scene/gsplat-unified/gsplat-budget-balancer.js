/**
 * @import { GSplatOctreeInstance } from './gsplat-octree-instance.js'
 * @import { GSplatPlacement } from './gsplat-placement.js'
 */

import { NUM_SCALE_BINS, NUM_SUB_BINS } from './constants.js';

// The histogram axis is the natural log of the scene-wide distance scale. The window covers any
// switch point a scene can produce - world distances from 1e-6 to far beyond any scene, over the
// base distances and multipliers the component allows - and anything outside it still resolves, it
// only shares the first or last bin. It is symmetric so that a scale of 1 falls exactly on a bin
// edge, which is what makes limit mode reproduce the configured distances exactly rather than to
// within a bin.
const LOG_SCALE_MIN = -48;
const LOG_SCALE_MAX = 48;
const BIN_SCALE = NUM_SCALE_BINS / (LOG_SCALE_MAX - LOG_SCALE_MIN);
const LAST_BIN = NUM_SCALE_BINS - 1;
const LAST_SUB_BIN = NUM_SUB_BINS - 1;

// The first bin past a scale of exactly 1: every switch point below it is taken at that scale.
const UNIT_SCALE_BIN = NUM_SCALE_BINS / 2;

// Floor on squared node distance before taking its log, so a camera inside a node stays finite.
const MIN_DISTANCE_SQ = 1e-12;

// Nodes carry squared distances, so the log of the distance is half the log taken.
const HALF_BIN_SCALE = BIN_SCALE * 0.5;

/**
 * Chooses a LOD level per node from its distance, fitted to the splat budget.
 *
 * A node at world distance `d` renders the LOD band `1 + log_m(d / (s * b))`, floored and clamped
 * to its LOD range, where `b` and `m` are its placement's base distance and multiplier. `s` is one
 * scene-wide scale on every base distance: raising it pushes every band outward, so the splat total
 * grows with it. The allocator's whole job is to pick `s`:
 * - in target mode, the largest `s` whose total still fits the budget;
 * - in limit mode, the same but never above 1, so the configured distances are an upper bound on
 * detail and the budget only ever lowers it.
 *
 * Every node switches band at a scale known in closed form - it is finer than band `L` exactly when
 * `ln s > ln(d / b) - (L - 1) ln m`. Those switch points all lie on the one `ln s` axis, whatever
 * the per-placement base distances and multipliers, so the allocator drops each one into a
 * histogram over that axis with the splat change it causes, then runs a prefix sum from the
 * coarsest end until a bin would exceed the budget. That bin alone is then resolved the same way on
 * a finer histogram of its own, so the budget is filled to within a fraction of a percent of
 * distance rather than to within a bin - captures often hold many nodes at nearly the same distance, and a
 * single bin can carry a large share of the scene. A last pass assigns each node the band the
 * resulting cut gives it. There is no queue and no sort.
 *
 * Stopping at the first sub-bin that does not fit, rather than skipping it and continuing, keeps a
 * node's level from depending on unrelated nodes further along the axis, so small camera movements
 * do not flip levels on and off. Nodes sharing a sub-bin switch together.
 *
 * @ignore
 */
class GSplatBudgetBalancer {
    /**
     * Splat change per bin of the scale axis, and then per sub-bin of the bin being resolved.
     *
     * @type {Float64Array}
     * @private
     */
    _histogram = new Float64Array(Math.max(NUM_SCALE_BINS, NUM_SUB_BINS));

    /**
     * Per global node index, the node's position on the scale axis in bin units, offset so that
     * its switch point leaving band `rangeMin + b` sits at `position - b * step`. Computed once,
     * read by every later pass.
     *
     * @type {Float64Array}
     * @private
     */
    _position = new Float64Array(0);

    /**
     * Assigns a LOD level to every node of every instance, keeping the total splat count within
     * budget. Reads NodeInfo#worldDistanceSq, writes NodeInfo#optimalLod.
     *
     * @param {Map<GSplatPlacement, GSplatOctreeInstance>} octreeInstances - Map of
     * GSplatOctreeInstance objects.
     * @param {number} budget - Splat budget for octrees. Infinity for no budget.
     * @param {boolean} limit - True when the budget only limits the configured LOD distances,
     * false when detail is raised to fill it.
     */
    balance(octreeInstances, budget, limit) {
        let nodeTotal = 0;
        let total = 0;
        let finestTotal = 0;
        for (const [, inst] of octreeInstances) {
            nodeTotal += inst.octree.nodes.length;
            total += inst.lodTable.totalCoarsestCount;
            finestTotal += inst.lodTable.totalFinestCount;
        }
        if (nodeTotal === 0) return;

        // Nothing to fit when not even the coarsest scene fits, or in target mode when the finest
        // does.
        if (total >= budget) {
            this._assignChainEnd(octreeInstances, false);
            return;
        }
        if (!limit && finestTotal <= budget) {
            this._assignChainEnd(octreeInstances, true);
            return;
        }

        if (this._position.length < nodeTotal) {
            this._position = new Float64Array(Math.max(nodeTotal, this._position.length * 2, 1024));
        }
        const position = this._position;

        // Position pass: each node's place on the scale axis. In limit mode it also totals the
        // splats at the configured distances, which is all there is to do when those fit.
        let unitTotal = 0;
        let base = 0;
        for (const [, inst] of octreeInstances) {
            const { bandLod, bandCount, span } = inst.lodTable;
            const nodeInfos = inst.nodeInfos;
            const step = Math.log(inst.placement.lodMultiplier) * BIN_SCALE;
            const offset = (-Math.log(inst.placement.lodBaseDistance) - LOG_SCALE_MIN) * BIN_SCALE - (inst.rangeMin - 1) * step;

            for (let n = 0, len = nodeInfos.length; n < len; n++) {
                const row = n * span;
                if (bandLod[row] < 0) continue;

                const dSq = nodeInfos[n].worldDistanceSq;
                const p = Math.log(dSq > MIN_DISTANCE_SQ ? dSq : MIN_DISTANCE_SQ) * HALF_BIN_SCALE + offset;
                position[base + n] = p;

                if (limit) {
                    let b = span - 1;
                    while (b > 0) {
                        const t = p - b * step;
                        if ((t < 0 ? 0 : (t >= NUM_SCALE_BINS ? LAST_BIN : t | 0)) >= UNIT_SCALE_BIN) break;
                        b--;
                    }
                    unitTotal += bandCount[row + b];
                }
            }
            base += nodeInfos.length;
        }

        // The cut along the scale axis: every switch point in a bin below `cutBin` is taken, and
        // in `cutBin` itself those in a sub-bin below `cutSub`.
        let cutBin = UNIT_SCALE_BIN;
        let cutSub = 0;
        if (!limit || unitTotal > budget) {
            const stopBin = limit ? UNIT_SCALE_BIN : NUM_SCALE_BINS;
            const histogram = this._histogram;

            // Histogram pass: each node's switch points with the splat change each one makes.
            histogram.fill(0, 0, NUM_SCALE_BINS);
            this._accumulate(octreeInstances, -1);

            // Sweep: take whole bins from the coarsest end while the total fits. Limit mode never
            // goes past a scale of 1, the configured distances.
            cutBin = 0;
            while (cutBin < stopBin) {
                const next = total + histogram[cutBin];
                if (next > budget) break;
                total = next;
                cutBin++;
            }

            // The bin that did not fit as a whole is split into sub-bins and swept the same way.
            if (cutBin < stopBin) {
                histogram.fill(0, 0, NUM_SUB_BINS);
                this._accumulate(octreeInstances, cutBin);
                while (cutSub < NUM_SUB_BINS) {
                    const next = total + histogram[cutSub];
                    if (next > budget) break;
                    total = next;
                    cutSub++;
                }
            }
        }

        // Assignment pass: step each node finer while its next switch point is taken. Switch
        // points rise as bands get finer, so the first one not taken ends the walk.
        base = 0;
        for (const [, inst] of octreeInstances) {
            const { bandLod, span } = inst.lodTable;
            const nodeInfos = inst.nodeInfos;
            const step = Math.log(inst.placement.lodMultiplier) * BIN_SCALE;

            for (let n = 0, len = nodeInfos.length; n < len; n++) {
                const row = n * span;
                if (bandLod[row] < 0) {
                    nodeInfos[n].optimalLod = -1;
                    continue;
                }

                const p = position[base + n];
                let b = span - 1;
                while (b > 0) {
                    const t = p - b * step;
                    const bin = t < 0 ? 0 : (t >= NUM_SCALE_BINS ? LAST_BIN : t | 0);
                    if (bin > cutBin) break;
                    if (bin === cutBin) {
                        const sub = (t - cutBin) * NUM_SUB_BINS;
                        if ((sub < 0 ? 0 : (sub >= NUM_SUB_BINS ? LAST_SUB_BIN : sub | 0)) >= cutSub) break;
                    }
                    b--;
                }
                nodeInfos[n].optimalLod = bandLod[row + b];
            }
            base += nodeInfos.length;
        }
    }

    /**
     * Adds every switch point's splat change to the histogram: by bin when `bin` is negative, or
     * by sub-bin for the switch points inside `bin` only.
     *
     * @param {Map<GSplatPlacement, GSplatOctreeInstance>} octreeInstances - The octree instances.
     * @param {number} bin - The bin to split into sub-bins, or -1 for the whole axis.
     * @private
     */
    _accumulate(octreeInstances, bin) {
        const position = this._position;
        const histogram = this._histogram;

        // Bands lie more than a bin apart - the multiplier is at least 1.2, about two bins - so a
        // node has at most one switch point in a given bin and it is found directly. The end
        // bins also hold everything clamped from outside the window, so those are scanned.
        const scan = bin < 0 || bin === 0 || bin === LAST_BIN;

        let base = 0;
        for (const [, inst] of octreeInstances) {
            const { bandLod, bandCount, span } = inst.lodTable;
            const len = inst.nodeInfos.length;
            const step = Math.log(inst.placement.lodMultiplier) * BIN_SCALE;
            const invStep = 1 / step;

            for (let n = 0; n < len; n++) {
                const row = n * span;
                if (bandLod[row] < 0) continue;
                const p = position[base + n];

                // the candidate and its neighbor, in case rounding lands the floor one short
                let b = scan ? 1 : Math.floor((p - bin) * invStep);
                const end = scan ? span : Math.min(b + 2, span);
                if (b < 1) b = 1;

                for (; b < end; b++) {
                    const delta = bandCount[row + b - 1] - bandCount[row + b];
                    if (delta === 0) continue;
                    const t = p - b * step;
                    const tb = t < 0 ? 0 : (t >= NUM_SCALE_BINS ? LAST_BIN : t | 0);
                    if (bin < 0) {
                        histogram[tb] += delta;
                    } else if (tb === bin) {
                        const sub = (t - bin) * NUM_SUB_BINS;
                        histogram[sub < 0 ? 0 : (sub >= NUM_SUB_BINS ? LAST_SUB_BIN : sub | 0)] += delta;
                    }
                }
            }
            base += len;
        }
    }

    /**
     * Puts every node at one end of its LOD chain, for the cases where the budget decides
     * everything - either the whole scene fits at its finest, or not even the coarsest scene does.
     *
     * @param {Map<GSplatPlacement, GSplatOctreeInstance>} octreeInstances - The octree instances.
     * @param {boolean} finest - True for the finest band, false for the coarsest.
     * @private
     */
    _assignChainEnd(octreeInstances, finest) {
        for (const [, inst] of octreeInstances) {
            const { bandLod, span } = inst.lodTable;
            const nodeInfos = inst.nodeInfos;
            const offset = finest ? 0 : span - 1;
            for (let n = 0, len = nodeInfos.length; n < len; n++) {
                nodeInfos[n].optimalLod = bandLod[n * span + offset];
            }
        }
    }
}

export { GSplatBudgetBalancer };
