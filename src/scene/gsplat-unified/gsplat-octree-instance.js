import { Debug } from '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { GSplatPlacement } from './gsplat-placement.js';
import { GsplatAllocId } from './gsplat-alloc-id.js';
import { getLodDebugColors, lodDebugColorIndex } from './gsplat-lod-colors.js';
import { GSPLAT_DEBUG_NODE_AABBS, PROJECTION_ORTHOGRAPHIC } from '../constants.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { GSplatOctree } from './gsplat-octree.js'
 * @import { EventHandle } from '../../core/event-handle.js'
 */

const _invWorldMat = new Mat4();

const _tempCompletedUrls = [];
const _tempDebugAabb = new BoundingBox();
const _debugWaitingColor = new Color(0.45, 0.45, 0.45);

// tan(22.5deg) for the engine's default 45-degree vertical FOV, used as the FOV compensation reference
const REF_TAN_HALF_FOV = Math.tan(22.5 * math.DEG_TO_RAD);

// Load priority tiers, see GSplatOctreeInstance#requestFile. A tier's priorities lie in
// [tier, tier + 1), so a higher tier always loads first.
const LOAD_TIER_PREFETCH = 0;
const LOAD_TIER_SWITCH = 1;
const LOAD_TIER_VISIBLE = 2;

// How the cut walk reaches a node, see GSplatOctreeInstance#_applyTreeCut. A node whose region an
// ancestor renders is never reached.
const CUT_ACTIVE = 1;       // the node's region renders as its LOD asks for
const CUT_FALLBACK = 2;     // the node's region renders whatever is loaded, until an ancestor loads

/**
 * Stores LOD state for a single octree node.
 *
 * @ignore
 */
class NodeInfo {
    /**
     * Current LOD index being rendered. -1 indicates node is not visible.
     */
    currentLod = -1;

    /**
     * Squared world-space distance from the camera to this node, with the FOV compensation and
     * the behind-camera penalty folded in. The only way camera position influences LOD selection,
     * and what orders loads of the same LOD level within a priority tier. Kept squared so the
     * per-node pass needs no square root - every consumer works in squared or log space.
     */
    worldDistanceSq = 0;

    /**
     * Accumulated camera translation for SH color update threshold tracking.
     */
    colorAccumulatedTranslation = 0;

    /**
     * Back-reference to owning GSplatOctreeInstance.
     *
     * @type {GSplatOctreeInstance|null}
     */
    inst = null;

    /**
     * Unique allocation identifier for persistent work buffer allocation tracking.
     *
     * @type {number}
     */
    allocId = GsplatAllocId.get();

    /**
     * Resets the rendered LOD to -1 (invisible).
     */
    resetLod() {
        this.currentLod = -1;
    }
}

class GSplatOctreeInstance {
    /** @type {GSplatOctree} */
    octree;

    /** @type {GSplatPlacement} */
    placement;

    /** @type {Set<GSplatPlacement>} */
    activePlacements = new Set();

    /** @type {boolean} */
    dirtyModifiedPlacements = false;

    /**
     * Set to true when placements are added or removed, signaling that the manager needs to
     * create a new world state and trigger a full work buffer rebuild.
     */
    dirtyPlacementSetChanged = false;

    /** @type {GraphicsDevice} */
    device;

    /**
     * Array of NodeInfo instances, one per octree node.
     *
     * @type {NodeInfo[]}
     */
    nodeInfos;

    /**
     * Array of current placements per file. Index is fileIndex, value is GSplatPlacement or null.
     * Value null indicates file is not used / no placement.
     *
     * @type {(GSplatPlacement|null)[]}
     */
    filePlacements;

    /**
     * Set of pending file loads (file indices).
     *
     * @type {Set<number>}
     */
    pending = new Set();

    /**
     * Files that became unused by this instance this update. Each entry represents a single decRef.
     *
     * @type {Set<number>}
     */
    removedCandidates = new Set();

    /**
     * Minimum allowed LOD index for this instance, clamped to valid octree bounds.
     */
    rangeMin = 0;

    /**
     * Maximum allowed LOD index for this instance, clamped to valid octree bounds.
     */
    rangeMax = 0;

    /**
     * Previous node position at which LOD was last updated. This is used to determine if LOD needs
     * to be updated as the octree splat moves.
     */
    previousPosition = new Vec3();

    /**
     * Set when a resource has completed loading and LOD should be re-evaluated.
     */
    needsLodUpdate = false;

    /**
     * Tracks prefetched file indices that are being loaded without active placements, rebuilt on
     * every LOD update. When any completes, we trigger LOD re-evaluation to allow promotion.
     *
     * @type {Set<number>}
     */
    prefetchPending = new Set();

    /**
     * Files this instance waits for, mapped to their load priority. Rebuilt on every LOD update
     * and submitted to the octree, which combines the requests of all its instances.
     *
     * @type {Map<number, number>}
     * @private
     */
    _fileRequests = new Map();

    /**
     * Camera position and forward in octree local space, everything that scales a node's distance
     * squared, and the behind-camera penalty, as {@link GSplatOctreeInstance#prepareDistances} set
     * them for the current LOD update.
     *
     * @type {Vec3}
     * @private
     */
    _cameraPos = new Vec3();

    /**
     * @type {Vec3}
     * @private
     */
    _cameraFwd = new Vec3(0, 0, -1);

    /** @private */
    _distanceScaleSq = 1;

    /** @private */
    _penalty = 0;

    /**
     * Number of the current cut through the octree, chosen by GSplatBudgetBalancer#balance. The
     * per-node state of a cut is valid for the nodes stamped with it, so nothing has to be cleared
     * between cuts.
     *
     * @type {number}
     */
    treeStamp = 0;

    /**
     * Per node, the {@link GSplatOctreeInstance#treeStamp} of the last cut that refined it.
     *
     * @type {Uint32Array|null}
     */
    treeRefined = null;

    /**
     * Per node, its position on the allocator's scale axis in the last cut that reached it, see
     * GSplatBudgetBalancer.
     *
     * @type {Float64Array|null}
     */
    treePosition = null;

    /**
     * The size of a band and this instance's offset on the allocator's scale axis, for the
     * current cut.
     *
     * @type {number}
     */
    treeStep = 1;

    /** @type {number} */
    treeOffset = 0;

    /**
     * Where on the scale axis the current cut stopped: the switch points before it are taken.
     *
     * @type {number}
     */
    treeCutStop = Infinity;

    /**
     * Memoized per-node answers of the current cut's walk - whether a node is loaded, can render its
     * region from loaded data, or can render it within the underfill limit - each valid where its
     * stamp is the current {@link GSplatOctreeInstance#treeStamp}.
     *
     * @type {Uint32Array|null}
     * @private
     */
    _treeLoadedStamp = null;

    /** @private */
    _treeLoaded = null;

    /** @private */
    _treeCoverStamp = null;

    /** @private */
    _treeCover = null;

    /** @private */
    _treeWithinStamp = null;

    /** @private */
    _treeWithin = null;

    /**
     * Stack of the cut's walk, its nodes and how the walk reached them, one of the CUT_* values.
     *
     * @type {Int32Array|null}
     * @private
     */
    _treeStack = null;

    /** @private */
    _treeStackState = null;

    /**
     * The nodes the last cut rendered, and those the current one renders, so applying a cut only
     * touches the nodes it changes.
     *
     * @type {Int32Array|null}
     * @private
     */
    _drawn = null;

    /** @private */
    _drawnCount = 0;

    /** @private */
    _drawnNext = null;

    /**
     * The nodes the last cut asked for whose data is not loaded yet, drawn by the node AABB debug
     * view. Recorded in debug builds only.
     *
     * @type {Int32Array|null}
     * @private
     */
    _debugWaiting = null;

    /** @private */
    _debugWaitingCount = 0;

    /**
     * Per node, the {@link GSplatOctreeInstance#treeStamp} of the last cut that rendered it.
     *
     * @type {Uint32Array|null}
     * @private
     */
    _drawStamp = null;

    /**
     * Returns the count of resources pending load or prefetch, including environment if loading.
     *
     * @type {number}
     */
    get pendingLoadCount() {
        let count = this.pending.size + this.prefetchPending.size;

        // Add environment if it's configured but not yet loaded
        if (this.octree.environmentUrl && !this.environmentPlacement) {
            count++;
        }

        return count;
    }

    /**
     * Environment placement.
     *
     * @type {GSplatPlacement|null}
     */
    environmentPlacement = null;

    /**
     * Event handle for device lost event.
     *
     * @type {EventHandle|null}
     * @private
     */
    _deviceLostEvent = null;


    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatOctree} octree - The octree.
     * @param {GSplatPlacement} placement - The placement.
     */
    constructor(device, octree, placement) {
        this.device = device;
        this.octree = octree;
        this.placement = placement;

        // Initialize nodeInfos array with NodeInfo instances for all nodes
        this.nodeInfos = new Array(octree.nodes.length);
        for (let i = 0; i < octree.nodes.length; i++) {
            const nodeInfo = new NodeInfo();
            nodeInfo.inst = this;

            this.nodeInfos[i] = nodeInfo;
        }

        // Initialize file placements array
        const numFiles = octree.files.length;
        this.filePlacements = new Array(numFiles).fill(null);

        // Handle environment if configured
        if (octree.environmentUrl) {
            octree.incEnvironmentRefCount();
            octree.ensureEnvironmentResource();
        }

        // Register device lost handler
        this._deviceLostEvent = device.on('devicelost', this._onDeviceLost, this);
    }

    /**
     * Destroys this octree instance and clears internal references.
     *
     * @param {boolean} [skipRefCounting] - When true, skip decrementing file ref counts
     * on the octree. Used when the caller handles ref counting externally via pendingReleases
     * (e.g. during world state updates where decrements must be deferred).
     */
    destroy(skipRefCounting = false) {
        if (this.octree && !this.octree.destroyed) {
            // Withdraw this instance's file requests. A file another instance still requests, for
            // another camera for example, keeps loading. Without deferred ref counting nothing
            // releases an unreferenced download later, so it is unloaded right away.
            this.octree.removeRequests(this, !skipRefCounting);
        }
        this._fileRequests.clear();

        if (!skipRefCounting && this.octree && !this.octree.destroyed) {
            // Decrement ref counts for all files currently in use (loaded files)
            const filesToDecRef = this.getFileDecrements();
            for (const fileIndex of filesToDecRef) {
                this.octree.decRefCount(fileIndex, 0);
            }

            // Clean up environment if present
            if (this.environmentPlacement) {
                this.octree.decEnvironmentRefCount();
            }
        }

        this.pending.clear();
        this.filePlacements.length = 0;

        // Clean up environment placement
        if (this.environmentPlacement) {
            this.activePlacements.delete(this.environmentPlacement);
            this.environmentPlacement = null;
        }

        // Remove device event listener
        this._deviceLostEvent?.off();
        this._deviceLostEvent = null;
    }

    /**
     * Handles device lost event by releasing all loaded resources.
     *
     * @private
     */
    _onDeviceLost() {
        // Decrement ref counts for all currently loaded file resources
        for (let i = 0; i < this.filePlacements.length; i++) {
            if (this.filePlacements[i]) {
                // zero cooldown, immediate unload
                this.octree.decRefCount(i, 0);
            }
        }

        // Clear all internal state
        this.filePlacements.fill(null);
        this.activePlacements.clear();
        this.pending.clear();
        this.removedCandidates.clear();
        this.prefetchPending.clear();

        // Reset all nodes to invisible
        for (const nodeInfo of this.nodeInfos) {
            nodeInfo.resetLod();
        }
        this._drawnCount = 0;

        // Clean up environment if present
        if (this.environmentPlacement) {
            this.activePlacements.delete(this.environmentPlacement);
            this.environmentPlacement = null;
            this.octree.unloadEnvironmentResource();
        }

        // Mark that LOD needs to be re-evaluated after context restore
        this.dirtyModifiedPlacements = true;
        this.dirtyPlacementSetChanged = true;
        this.needsLodUpdate = true;
    }

    /**
     * Returns the file indices currently referenced by this instance that should be decremented
     * when the instance is destroyed.
     *
     * @returns {number[]} Array of file indices to decRef.
     */
    getFileDecrements() {
        const toRelease = [];
        for (let i = 0; i < this.filePlacements.length; i++) {
            if (this.filePlacements[i]) {
                toRelease.push(i);
            }
        }
        return toRelease;
    }

    /**
     * Requests the file of a node, and watches it so that the cut is chosen again once it loads.
     *
     * @param {number} nodeIndex - The node.
     * @param {number} tier - The load tier, one of the LOAD_TIER_* values.
     * @private
     */
    _requestCutNode(nodeIndex, tier) {
        const fileIndex = this.octree.nodes[nodeIndex].lods[this.octree.nodeLevel[nodeIndex]].fileIndex;
        if (fileIndex === -1) return;

        Debug.call(() => {
            this._debugWaiting ??= new Int32Array(this.octree.nodes.length);
            this._debugWaiting[this._debugWaitingCount++] = nodeIndex;
        });

        const distanceRank = 1 / (1 + Math.max(this.nodeInfos[nodeIndex].worldDistanceSq, 1e-12));
        if (!this.requestFile(fileIndex, tier, distanceRank)) {
            this.prefetchPending.add(fileIndex);
        }
    }

    /**
     * Starts a cut through this instance's octree, chosen by GSplatBudgetBalancer#balance for the
     * current LOD update.
     *
     * @param {number} step - The size of a band on the allocator's scale axis.
     * @param {number} offset - This instance's offset on the scale axis.
     */
    beginTreeCut(step, offset) {
        if (!this.treeRefined) {
            const count = this.octree.nodes.length;
            this.treeRefined = new Uint32Array(count);
            this.treePosition = new Float64Array(count);
            this._treeLoadedStamp = new Uint32Array(count);
            this._treeLoaded = new Uint8Array(count);
            this._treeCoverStamp = new Uint32Array(count);
            this._treeCover = new Uint8Array(count);
            this._treeWithinStamp = new Uint32Array(count);
            this._treeWithin = new Uint8Array(count);
            this._treeStack = new Int32Array(count);
            this._treeStackState = new Uint8Array(count);
            this._drawn = new Int32Array(count);
            this._drawnNext = new Int32Array(count);
            this._drawStamp = new Uint32Array(count);
        }
        this.treeStamp++;
        this.treeStep = step;
        this.treeOffset = offset;
        this.treeCutStop = Infinity;
    }

    /**
     * Measures and records the squared world distance from the camera to one node, with the FOV
     * compensation and the behind-camera penalty folded in. It is the only way camera position
     * influences LOD selection, and what orders the loads of one LOD level. Distance is measured to
     * the nearest point of the node's bounds, the same way under both projections - an orthographic
     * footprint carries no depth term, so this is what gives it a distance ordering at all.
     *
     * A node is never nearer than its parent, which the cut measures first: the allocator relies on
     * a child never asking for more detail than its parent. Nested bounds give that on their own,
     * but the behind-camera penalty depends on direction, so it can raise a parent above its child.
     *
     * @param {number} n - The node.
     * @returns {number} The squared distance.
     */
    measureTreeNode(n) {
        const boundsFlat = this.octree.nodeBoundsMinMax;
        const { x: px, y: py, z: pz } = this._cameraPos;
        const b = n * 6;

        let qx = px;
        if (qx < boundsFlat[b]) qx = boundsFlat[b];
        else if (qx > boundsFlat[b + 3]) qx = boundsFlat[b + 3];

        let qy = py;
        if (qy < boundsFlat[b + 1]) qy = boundsFlat[b + 1];
        else if (qy > boundsFlat[b + 4]) qy = boundsFlat[b + 4];

        let qz = pz;
        if (qz < boundsFlat[b + 2]) qz = boundsFlat[b + 2];
        else if (qz > boundsFlat[b + 5]) qz = boundsFlat[b + 5];

        const dx = qx - px;
        const dy = qy - py;
        const dz = qz - pz;
        const distanceSq = dx * dx + dy * dy + dz * dz;

        let penaltyFactor = 1;
        if (this._penalty > 0 && distanceSq > 0.0001) {
            const fwd = this._cameraFwd;
            const dot = fwd.x * dx + fwd.y * dy + fwd.z * dz;
            if (dot < 0) {
                penaltyFactor = 1 + (-dot / Math.sqrt(distanceSq)) * this._penalty;
            }
        }

        let value = distanceSq * penaltyFactor * penaltyFactor * this._distanceScaleSq;
        const parent = this.octree.parentIndex[n];
        if (parent >= 0 && value < this.nodeInfos[parent].worldDistanceSq) {
            value = this.nodeInfos[parent].worldDistanceSq;
        }
        this.nodeInfos[n].worldDistanceSq = value;
        return value;
    }

    /**
     * Whether a node reached by the current cut is loaded, or has no data to load. Polls the
     * loader, so a file that finished loading is seen.
     *
     * @param {number} n - The node.
     * @returns {boolean} True when the node can render.
     * @private
     */
    _isTreeNodeLoaded(n) {
        const stamp = this.treeStamp;
        const memo = /** @type {Uint8Array} */ (this._treeLoaded);
        const memoStamp = /** @type {Uint32Array} */ (this._treeLoadedStamp);
        if (memoStamp[n] !== stamp) {
            const octree = this.octree;
            const fileIndex = octree.nodes[n].lods[octree.nodeLevel[n]].fileIndex;
            memo[n] = fileIndex === -1 || octree.pollFileResource(fileIndex) ? 1 : 0;
            memoStamp[n] = stamp;
        }
        return memo[n] === 1;
    }

    /**
     * Whether a node's region can render from any loaded data right now - its own, or that of nodes
     * below it. Skips the subtrees with nothing loaded, see GSplatOctree#loadedBelow.
     *
     * @param {number} n - The node.
     * @returns {boolean} True when the region is coverable.
     * @private
     */
    _isTreeCoverable(n) {
        const stamp = this.treeStamp;
        const memo = /** @type {Uint8Array} */ (this._treeCover);
        const memoStamp = /** @type {Uint32Array} */ (this._treeCoverStamp);
        if (memoStamp[n] !== stamp) {
            const { childStart, childCount, loadedBelow } = this.octree;
            let coverable = this._isTreeNodeLoaded(n);
            if (!coverable && childCount[n] > 0 && loadedBelow[n] > 0) {
                coverable = true;
                for (let c = childStart[n], end = c + childCount[n]; c < end; c++) {
                    if (!this._isTreeCoverable(c)) {
                        coverable = false;
                        break;
                    }
                }
            }
            memo[n] = coverable ? 1 : 0;
            memoStamp[n] = stamp;
        }
        return memo[n] === 1;
    }

    /**
     * Whether a node's region can render from loaded data no finer than the current cut asks for,
     * and no more than `underfillLimit` levels coarser than its distance asks for. Only follows the
     * nodes the cut refines, which it has measured.
     *
     * @param {number} n - A node the cut reached.
     * @param {number} underfillLimit - See GSplatParams#lodUnderfillLimit.
     * @returns {boolean} True when the region is within the limit.
     * @private
     */
    _isTreeWithinLimit(n, underfillLimit) {
        const stamp = this.treeStamp;
        const memo = /** @type {Uint8Array} */ (this._treeWithin);
        const memoStamp = /** @type {Uint32Array} */ (this._treeWithinStamp);
        if (memoStamp[n] !== stamp) {
            const { childStart, childCount, nodeLevel } = this.octree;
            const refines = this.treeRefined[n] === stamp;
            let within = this._isTreeNodeLoaded(n) && (!refines || nodeLevel[n] - this._treeBand(n) <= underfillLimit);
            if (!within && refines) {
                within = true;
                for (let c = childStart[n], end = c + childCount[n]; c < end; c++) {
                    if (!this._isTreeWithinLimit(c, underfillLimit)) {
                        within = false;
                        break;
                    }
                }
            }
            memo[n] = within ? 1 : 0;
            memoStamp[n] = stamp;
        }
        return memo[n] === 1;
    }

    /**
     * The LOD band the current cut gives a node it measured: the level its distance asks for at the
     * scale the cut stopped at.
     *
     * @param {number} n - The node.
     * @returns {number} The band, an absolute LOD index within the range.
     * @private
     */
    _treeBand(n) {
        // the node whose switch point stopped the cut sits on a band boundary, which rounding must
        // not move to the finer side
        const span = this.rangeMax - this.rangeMin + 1;
        let band = Math.floor((this.treePosition[n] - this.treeCutStop) / this.treeStep + 1e-9);
        if (!(band >= 0)) band = 0;
        else if (band > span - 1) band = span - 1;
        return this.rangeMin + band;
    }

    /**
     * Renders the cut GSplatBudgetBalancer#balance chose, walking only the nodes it reached and the
     * loaded data below them it falls back on, and applies it to the nodes whose state it changes -
     * the cost follows the size of the cut, not of the octree.
     *
     * A node the allocator refines hands its region to its children, and the walk from the top
     * level down renders the first node on each path it does not refine. The nodes rendered this
     * way cover the scene exactly once.
     *
     * Only loaded data is ever rendered, so a change of the cut takes effect at once, in one world
     * state, with no frame showing a region twice or not at all. While the cut streams in, a region
     * whose nodes are not loaded renders other loaded data instead, preferring coarser data:
     * - A node coarser than asked for renders while the nodes it refines to load, when it is no more
     * than `underfillLimit` levels coarser than its distance asks for. So when the cut gets coarser,
     * a loaded ancestor of the nodes it moves to renders until they load, and the splat count stays
     * within the plan.
     * - Otherwise the finer loaded data below the region renders until the nodes it moves to load,
     * as when no coarser data within the limit is loaded, or the limit is 0.
     * - A node renders however much coarser than asked for when nothing finer is loaded, so the
     * view streams in coarse to fine one level at a time. Only the parts of the scene with nothing
     * loaded at all, as at the start, render nothing.
     *
     * @param {number} underfillLimit - See GSplatParams#lodUnderfillLimit.
     * @private
     */
    _applyTreeCut(underfillLimit) {
        const octree = this.octree;
        const { nodes, parentIndex, childStart, childCount, nodeLevel, loadedBelow } = octree;
        const stamp = this.treeStamp;
        const refined = /** @type {Uint32Array} */ (this.treeRefined);
        const stack = /** @type {Int32Array} */ (this._treeStack);
        const stackState = /** @type {Uint8Array} */ (this._treeStackState);
        const drawn = /** @type {Int32Array} */ (this._drawnNext);
        let drawnCount = 0;

        Debug.call(() => {
            this._debugWaitingCount = 0;
        });

        // the top level nodes are stored first
        let top = 0;
        for (let n = 0; n < nodes.length && parentIndex[n] < 0; n++) {
            stack[top] = n;
            stackState[top++] = CUT_ACTIVE;
        }

        while (top > 0) {
            const n = stack[--top];
            const nodeState = stackState[top];
            const first = childStart[n];
            const end = first + childCount[n];
            const loaded = this._isTreeNodeLoaded(n);

            // a region with no node loaded yet renders whatever is loaded below it
            if (nodeState === CUT_FALLBACK) {
                if (loaded) {
                    drawn[drawnCount++] = n;
                } else if (loadedBelow[n] > 0) {
                    for (let c = first; c < end; c++) {
                        stack[top] = c;
                        stackState[top++] = CUT_FALLBACK;
                    }
                }
                continue;
            }

            // a node the cut does not refine renders, or until it loads, the finer data below it
            if (refined[n] !== stamp) {
                if (loaded) {
                    drawn[drawnCount++] = n;
                } else {
                    this._requestCutNode(n, this._isTreeCoverable(n) ? LOAD_TIER_SWITCH : LOAD_TIER_VISIBLE);
                    if (loadedBelow[n] > 0) {
                        for (let c = first; c < end; c++) {
                            stack[top] = c;
                            stackState[top++] = CUT_FALLBACK;
                        }
                    }
                }
                continue;
            }

            let allCoverable = true;
            let allWithinLimit = true;
            for (let c = first; c < end; c++) {
                if (!this._isTreeCoverable(c)) allCoverable = false;
                if (!this._isTreeWithinLimit(c, underfillLimit)) allWithinLimit = false;
            }

            if (!allWithinLimit && loaded && (nodeLevel[n] - this._treeBand(n) <= underfillLimit || !allCoverable)) {
                // the node renders coarser than asked for while the children it refines to load
                drawn[drawnCount++] = n;
                for (let c = first; c < end; c++) {
                    if (!this._isTreeWithinLimit(c, underfillLimit) && !this._isTreeNodeLoaded(c)) {
                        this._requestCutNode(c, LOAD_TIER_SWITCH);
                    }
                }
            } else if (allWithinLimit || allCoverable) {
                // refine, each child region rendering by its own LOD, or from the finer data below
                // it where nothing within the limit is loaded
                for (let c = first; c < end; c++) {
                    stack[top] = c;
                    stackState[top++] = CUT_ACTIVE;
                }
            } else {
                // only a top level node gets here, with nothing to render in its place: what is
                // loaded below it renders until it loads
                this._requestCutNode(n, LOAD_TIER_VISIBLE);
                if (loadedBelow[n] > 0) {
                    for (let c = first; c < end; c++) {
                        stack[top] = c;
                        stackState[top++] = CUT_FALLBACK;
                    }
                }
            }
        }

        // Apply: the nodes the cut renders first, so a file whose ranges move between nodes keeps
        // its placement, then hide the nodes it no longer renders.
        const nodeInfos = this.nodeInfos;
        const drawStamp = /** @type {Uint32Array} */ (this._drawStamp);
        for (let i = 0; i < drawnCount; i++) {
            const n = drawn[i];
            drawStamp[n] = stamp;
            const level = nodeLevel[n];
            const info = nodeInfos[n];
            if (info.currentLod !== level) {
                const fileIndex = nodes[n].lods[level].fileIndex;
                if (fileIndex !== -1) {
                    this.incrementFileRef(fileIndex, n, level);
                    if (this.filePlacements[fileIndex]?.resource) {
                        info.currentLod = level;
                    }
                }
            }
        }

        const previous = /** @type {Int32Array} */ (this._drawn);
        for (let i = 0; i < this._drawnCount; i++) {
            const n = previous[i];
            const info = nodeInfos[n];
            if (drawStamp[n] !== stamp && info.currentLod >= 0) {
                this.decrementFileRef(nodes[n].lods[info.currentLod].fileIndex, n);
                info.currentLod = -1;
            }
        }

        this._drawn = drawn;
        this._drawnNext = previous;
        this._drawnCount = drawnCount;
    }

    /**
     * Requests a file for this LOD update, unless it is already loaded. A file requested more than
     * once keeps its highest priority.
     *
     * The priority is ranked by tier first. Within a tier, coarser LOD levels load first, so the
     * whole view refines one level at a time instead of the nearest nodes refining all the way
     * before farther ones get their first step. Within a level, nearer loads first.
     *
     * @param {number} fileIndex - The file index.
     * @param {number} tier - The load tier, one of the LOAD_TIER_* values.
     * @param {number} distanceRank - The requesting node's distance mapped monotonically into
     * [0, 1), higher is nearer.
     * @returns {boolean} True if the file is already loaded.
     */
    requestFile(fileIndex, tier, distanceRank) {
        if (this.octree.pollFileResource(fileIndex)) {
            return true;
        }

        const octree = this.octree;
        const priority = tier + (octree.files[fileIndex].lodLevel + distanceRank) / octree.lodLevels;

        const current = this._fileRequests.get(fileIndex);
        if (current === undefined || priority > current) {
            this._fileRequests.set(fileIndex, priority);
        }
        return false;
    }

    /**
     * Resolves the configured LOD range against the octree. Called before the budget allocator, so
     * it sees the current range.
     */
    resolveLodRange() {
        const maxLod = this.octree.lodLevels - 1;
        const { lodRangeMin, lodRangeMax } = this.placement;
        const rangeMin = Math.max(0, Math.min(lodRangeMin ?? 0, maxLod));
        const rangeMax = Math.max(rangeMin, Math.min(lodRangeMax ?? maxLod, maxLod));
        this.rangeMin = rangeMin;
        this.rangeMax = rangeMax;
    }

    /**
     * Prepares the camera terms of a LOD update: the camera position and forward in octree local
     * space, everything that scales a node's distance squared, and the behind-camera penalty. The
     * cut uses them to measure only the nodes it reaches, see
     * {@link GSplatOctreeInstance#measureTreeNode}.
     *
     * @param {GraphNode} cameraNode - The camera node.
     * @param {import('./gsplat-params.js').GSplatParams} params - Global gsplat parameters.
     */
    prepareDistances(cameraNode, params) {
        const { lodBehindPenalty } = params;

        // Uniform scale of the octree transform, for world-space distance conversion.
        const uniformScale = this.placement.node.getWorldTransform().getScale().x;

        const camera = cameraNode.camera;
        const ortho = camera.projection === PROJECTION_ORTHOGRAPHIC;

        // FOV compensation, perspective only: use min(tanHalfV, tanHalfH) to handle ultra-wide and
        // portrait.
        let fovScale = 1;
        if (!ortho) {
            // a backbuffer with no size in either dimension (e.g. a hidden canvas) reports a 0, NaN
            // or infinite aspect ratio, which would turn every distance, and so every LOD choice and
            // load priority, into NaN
            const cameraAspect = camera.aspectRatio;
            const aspectRatio = cameraAspect > 0 && Number.isFinite(cameraAspect) ? cameraAspect : 1;
            let tanHalfVFov = Math.tan(camera.fov * 0.5 * math.DEG_TO_RAD);
            if (camera.horizontalFov) {
                tanHalfVFov /= aspectRatio;
            }
            const tanHalfHFov = tanHalfVFov * aspectRatio;
            fovScale = Math.min(tanHalfVFov, tanHalfHFov) / REF_TAN_HALF_FOV;
        }

        // transform the camera position and forward to octree local space
        _invWorldMat.copy(this.placement.node.getWorldTransform()).invert();
        _invWorldMat.transformPoint(cameraNode.getPosition(), this._cameraPos);
        _invWorldMat.transformVector(cameraNode.forward, this._cameraFwd).normalize();

        // Everything that scales the distance, squared once. Node bounds are octree-local, so the
        // placement's uniform scale converts to world units.
        this._distanceScaleSq = (fovScale * uniformScale) * (fovScale * uniformScale);
        this._penalty = lodBehindPenalty > 1 ? lodBehindPenalty - 1 : 0;
    }

    /**
     * Applies the cut the budget allocator chose, see {@link GSplatOctreeInstance#_applyTreeCut},
     * and manages file placements. This is Pass 2 of the LOD update process.
     *
     * Also requests every file this instance waits for, with a load priority. The priority is
     * ranked by tier first - a region that shows nothing yet, then a node waiting for the nodes it
     * switches to - and within a tier by LOD level, coarsest first, and then by the node's
     * {@link NodeInfo#worldDistanceSq}. So the view fills with coarse data first and then refines one
     * level at a time across the whole view, each level nearest the camera first. A file shared by
     * several nodes takes the highest priority of them. The requests are submitted to the octree,
     * which combines them with those of its other instances and issues them in
     * {@link GSplatOctree#flushRequests}.
     *
     * @param {import('./gsplat-params.js').GSplatParams} params - Global gsplat parameters.
     */
    applyLodChanges(params) {
        // rebuilt below from what the nodes still want, so a file nothing wants any more stops
        // being requested and tracked
        this.prefetchPending.clear();
        this._fileRequests.clear();

        this._applyTreeCut(params.lodUnderfillLimit ?? 0);

        // Every placement still waiting for its file must stay requested, or flushRequests would
        // withdraw it. The cut covers these with their own priorities, this is only a floor.
        for (const fileIndex of this.pending) {
            this.requestFile(fileIndex, LOAD_TIER_PREFETCH, 0);
        }

        this.octree.submitRequests(this, this._fileRequests);
    }

    /**
     * Increments reference count for a file and creates placement immediately.
     *
     * @param {number} fileIndex - The file index.
     * @param {number} nodeIndex - The octree node index.
     * @param {number} lodIndex - The LOD index for this node.
     */
    incrementFileRef(fileIndex, nodeIndex, lodIndex) {

        if (fileIndex === -1) return;

        // check if this is the first reference
        let placement = this.filePlacements[fileIndex];
        if (!placement) {

            // create placement (with null resource initially)
            placement = new GSplatPlacement(null, this.placement.node, lodIndex, null, this.placement);
            this.filePlacements[fileIndex] = placement;

            // If we scheduled a remove for this file in this update, cancel it
            const removeScheduled = this.removedCandidates.delete(fileIndex);
            if (!removeScheduled) {
                this.octree.incRefCount(fileIndex);
            }

            // if resource is already loaded, allow it to be used
            if (!this.addFilePlacement(fileIndex)) {

                // resource not loaded yet, add to pending - applyLodChanges requests the load
                this.pending.add(fileIndex);
            }
        }

        // Add interval for this node to the placement
        const nodes = this.octree.nodes;
        const node = nodes[nodeIndex];
        const lod = node.lods[lodIndex];

        // Create interval as Vec2(start, end)
        const interval = new Vec2(lod.offset, lod.offset + lod.count - 1);
        placement.intervals.set(nodeIndex, interval);

        this.dirtyModifiedPlacements = true;
    }

    /**
     * Decrements reference count for a file and removes placement if needed.
     *
     * @param {number} fileIndex - The file index.
     * @param {number} nodeIndex - The octree node index.
     */
    decrementFileRef(fileIndex, nodeIndex) {

        if (fileIndex === -1) return;

        const placement = this.filePlacements[fileIndex];
        if (!placement) {
            return;
        }

        if (placement) {

            // remove interval for this node from the placement
            placement.intervals.delete(nodeIndex);
            this.dirtyModifiedPlacements = true;

            // if this was the last reference, remove placement
            if (placement.intervals.size === 0) {
                // Only remove if it was added (has resource)
                if (placement.resource) {
                    this.activePlacements.delete(placement);

                    // Only signal a placement set change when the last child is removed,
                    // since that removes the bounds group and may shift boundsBaseIndex
                    // for other groups. Earlier removals leave the group intact.
                    if (this.activePlacements.size === 0) {
                        this.dirtyPlacementSetChanged = true;
                    }
                }

                // schedule a single decRef via world state
                this.removedCandidates.add(fileIndex);
                this.filePlacements[fileIndex] = null;
                this.pending.delete(fileIndex);
            }
        }
    }

    /**
     * Updates existing placement with loaded resource and adds to manager.
     *
     * @param {number} fileIndex - The file index.
     * @returns {boolean} True if placement was updated and added to manager, false otherwise.
     */
    addFilePlacement(fileIndex) {
        const res = this.octree.getFileResource(fileIndex);
        if (res) {
            // get the existing placement and update its resource
            const placement = this.filePlacements[fileIndex];
            if (placement) {
                placement.resource = res;

                // Only signal a placement set change when the first child is added,
                // since that creates a new bounds group and may shift boundsBaseIndex
                // for other groups. Subsequent children join the existing group and
                // don't affect bounds structure.
                if (this.activePlacements.size === 0) {
                    this.dirtyPlacementSetChanged = true;
                }

                this.activePlacements.add(placement);
                this.dirtyModifiedPlacements = true;
                // clear pending removal if we are reusing the file
                this.removedCandidates.delete(fileIndex);
                return true;
            }
        }
        return false;
    }

    /**
     * Tests if the octree instance has moved by more than the provided LOD update distance.
     *
     * @param {number} threshold - Distance threshold to trigger an update.
     * @returns {boolean} True if the octree instance has moved by more than the threshold, false otherwise.
     */
    testMoved(threshold) {
        const position = this.placement.node.getPosition();
        const length = position.distance(this.previousPosition);
        if (length > threshold) {
            return true;
        }
        return false;
    }

    /**
     * Updates the previous position of the octree instance.
     */
    updateMoved() {
        this.previousPosition.copy(this.placement.node.getPosition());
    }

    /**
     * Updates the octree instance each frame.
     *
     * @returns {boolean} True if octree instance is dirty, false otherwise.
     */
    update() {

        // Re-evaluate LODs when the LOD range changed on the component
        if (this.placement.lodDirty) {
            this.placement.lodDirty = false;
            this.needsLodUpdate = true;
        }

        // handle pending loads
        if (this.pending.size) {
            for (const fileIndex of this.pending) {

                // check if the asset has finished loading and store it if so
                this.octree.ensureFileResource(fileIndex);

                // if the resource became available, its placement can render
                if (this.addFilePlacement(fileIndex)) {
                    _tempCompletedUrls.push(fileIndex);
                }
            }

            // mark LOD update if any resource completed
            if (_tempCompletedUrls.length > 0) {
                this.needsLodUpdate = true;
            }

            // remove completed items from pending
            for (const fileIndex of _tempCompletedUrls) {
                this.pending.delete(fileIndex);
            }

            // clear temp array
            _tempCompletedUrls.length = 0;
        }

        // watch prefetched loads for completion to allow promotion
        this.pollPrefetchCompletions();

        // handle environment loading
        if (this.octree.environmentUrl && !this.environmentPlacement) {
            // poll for environment resource completion
            this.octree.ensureEnvironmentResource();
            const envResource = this.octree.environmentResource;

            if (envResource) {
                // create environment placement with the loaded resource
                this.environmentPlacement = new GSplatPlacement(envResource, this.placement.node, 0, null, this.placement);
                this.environmentPlacement.aabb.copy(envResource.aabb);
                this.activePlacements.add(this.environmentPlacement);
                this.dirtyModifiedPlacements = true;
                this.dirtyPlacementSetChanged = true;

                // Now that the placement exists, _onDeviceLost will tear down this resource,
                // so its CPU-side ImageBitmap sources are no longer needed for re-upload.
                envResource.releaseTextureSources?.();
            }
        }

        // check if any placements need LOD update
        const dirty = this.dirtyModifiedPlacements;
        this.dirtyModifiedPlacements = false;
        return dirty;
    }

    /**
     * Consumes and returns whether the active placement set membership changed (add/remove).
     *
     * @returns {boolean} True if placements were added or removed since last call.
     */
    consumePlacementSetChanged() {
        const changed = this.dirtyPlacementSetChanged;
        this.dirtyPlacementSetChanged = false;
        return changed;
    }

    // debug render world space bounds of the octree nodes the current LOD cut renders, colorized
    // by their LOD, and in gray the nodes it waits for, whose region renders other loaded data
    debugRender(scene) {
        Debug.call(() => {
            if (scene.gsplat.debug === GSPLAT_DEBUG_NODE_AABBS) {
                const modelMat = this.placement.node.getWorldTransform();
                const { nodes, nodeLevel } = this.octree;
                const lodColors = getLodDebugColors();
                const drawBox = (n, color) => {
                    _tempDebugAabb.setFromTransformedAabb(nodes[n].bounds, modelMat);
                    scene.immediate.drawWireAlignedBox(_tempDebugAabb.getMin(), _tempDebugAabb.getMax(), color, true, scene.defaultDrawLayer);
                };

                const drawn = /** @type {Int32Array} */ (this._drawn);
                for (let i = 0; i < this._drawnCount; i++) {
                    const n = drawn[i];
                    const level = nodeLevel[n];
                    if (nodes[n].lods[level].fileIndex !== -1) {
                        drawBox(n, lodColors[lodDebugColorIndex(level)]);
                    }
                }

                const waiting = /** @type {Int32Array} */ (this._debugWaiting);
                for (let i = 0; i < this._debugWaitingCount; i++) {
                    drawBox(waiting[i], _debugWaitingColor);
                }
            }
        });
    }

    /**
     * Returns true if this instance requests LOD re-evaluation and resets the flag.
     *
     * @returns {boolean} True if LOD should be re-evaluated.
     */
    consumeNeedsLodUpdate() {
        const v = this.needsLodUpdate;
        this.needsLodUpdate = false;
        return v;
    }

    /**
     * Polls prefetched file indices for completion and updates state.
     */
    pollPrefetchCompletions() {

        if (this.prefetchPending.size) {

            // poll loader and store resource in octree if ready
            for (const fileIndex of this.prefetchPending) {
                this.octree.ensureFileResource(fileIndex);
                if (this.octree.getFileResource(fileIndex)) {
                    _tempCompletedUrls.push(fileIndex);
                }
            }

            // remove completed from prefetchPending
            if (_tempCompletedUrls.length > 0) {
                this.needsLodUpdate = true;
            }

            for (const fileIndex of _tempCompletedUrls) {
                this.prefetchPending.delete(fileIndex);
            }
            _tempCompletedUrls.length = 0;
        }
    }
}

export { GSplatOctreeInstance, NodeInfo };
