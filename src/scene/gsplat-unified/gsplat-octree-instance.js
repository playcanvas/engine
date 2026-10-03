import { Debug } from '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { Color } from '../../core/math/color.js';
import { GSplatPlacement } from './gsplat-placement.js';
import { GsplatAllocId } from './gsplat-alloc-id.js';
import { GSPLAT_DEBUG_NODE_AABBS, PROJECTION_ORTHOGRAPHIC } from '../constants.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { GSplatOctree } from './gsplat-octree.js'
 * @import { EventHandle } from '../../core/event-handle.js'
 */

const _invWorldMat = new Mat4();
const _localCameraPos = new Vec3();
const _localCameraFwd = new Vec3();

const _tempCompletedUrls = [];
const _tempDebugAabb = new BoundingBox();
const _tempDebugBox = new BoundingBox();
const _tempDebugMin = new Vec3();
const _tempDebugMax = new Vec3();

// Bounds on how many splats one LOD group may hold in any band, as a share of the splat budget.
// The allocator fits the budget by switching nodes whole, and stops at the first switch that does
// not fit, so a group large against the budget would leave budget unspent. See
// evaluateNodeDistances.
const GROUP_BUDGET_SHARE = 1 / 16;
const GROUP_MIN_SPLATS = 16384;
const GROUP_MAX_SPLATS = 262144;

// tan(22.5deg) for the engine's default 45-degree vertical FOV, used as the FOV compensation reference
const REF_TAN_HALF_FOV = Math.tan(22.5 * math.DEG_TO_RAD);

// Load priority tiers, see GSplatOctreeInstance#applyLodChanges. A tier's priorities lie in
// [tier, tier + 1), so a higher tier always loads first.
const LOAD_TIER_PREFETCH = 0;
const LOAD_TIER_SWITCH = 1;
const LOAD_TIER_VISIBLE = 2;

// Color instances used by debug wireframe rendering for LOD visualization
const _lodColors = [
    new Color(1, 0, 0),
    new Color(0, 1, 0),
    new Color(0, 0, 1),
    new Color(1, 1, 0),
    new Color(1, 0, 1)
];

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
     * LOD index the budget allocator chose for this node, before underfill. -1 when the node has
     * nothing renderable in its LOD range.
     */
    optimalLod = -1;

    /**
     * Squared world-space distance from the camera to this node, with the FOV compensation and
     * the behind-camera penalty folded in. The only way camera position influences LOD selection,
     * and what orders loads within a priority tier. Kept squared so the per-node pass needs no
     * square root - every consumer works in squared or log space.
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
     * Resets all LOD values to -1 (invisible/uninitialized).
     */
    resetLod() {
        this.currentLod = -1;
        this.optimalLod = -1;
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
     * Map of nodeIndex -> { oldFileIndex, newFileIndex } that needs to be decremented when the
     * new LOD resource loads. This ensures we decrement even if the node switches LOD again
     * before the new resource arrives.
     *
     * @type {Map<number, { oldFileIndex: number, newFileIndex: number }>}
     */
    pendingDecrements = new Map();

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
     * Selection table for this instance's current LOD range, refreshed by
     * {@link GSplatOctreeInstance#resolveLodRange}. Read by the budget balancer rather than having
     * it resolve the range a second time.
     *
     * @type {import('./gsplat-lod-table.js').GSplatLodTable|null}
     */
    lodTable = null;

    /**
     * The nodes of {@link GSplatOctree#tree} that choose a LOD band in this update when LOD grouping
     * is on (see GSplatParams#lodGroupThreshold) - the cut through the tree: every leaf near the
     * camera, and one node for each distant subtree, whose leaves all render their own level for
     * the band it chooses. The first {@link GSplatOctreeInstance#lodUnitCount} entries are valid.
     * Null when every leaf chooses its own level.
     *
     * @type {Int32Array|null}
     */
    lodUnits = null;

    /**
     * Number of valid entries in {@link GSplatOctreeInstance#lodUnits}.
     */
    lodUnitCount = 0;

    /**
     * Per LOD unit, its squared world distance from the camera - see
     * {@link NodeInfo#worldDistanceSq}.
     *
     * @type {Float64Array}
     */
    lodUnitDistanceSq = new Float64Array(0);

    /**
     * Per LOD unit, the band the budget allocator chose for it, relative to the LOD range - band
     * `b` is LOD index `rangeMin + b` - or -1 when nothing in it is renderable in range.
     *
     * @type {Int16Array}
     */
    lodUnitBand = new Int16Array(0);

    /**
     * Traversal stack for the grouping walk, sized to the tree.
     *
     * @type {Int32Array}
     * @private
     */
    _cutStack = new Int32Array(0);

    /**
     * Backing storage for {@link GSplatOctreeInstance#lodUnits}, kept while grouping is off so
     * turning it back on does not reallocate.
     *
     * @type {Int32Array}
     * @private
     */
    _lodUnitStorage = new Int32Array(0);

    /**
     * Per leaf, 1 while {@link GSplatOctreeInstance#applyLodChanges} has to evaluate it: its target
     * level changed, or it is still on its way there. A leaf that shows its target and waits for
     * nothing does nothing in that pass, so it is skipped until its target changes again - which
     * keeps the pass proportional to what changes rather than to the size of the octree.
     *
     * @type {Uint8Array}
     * @private
     */
    _leafDirty;

    /**
     * Per leaf, the target level the last {@link GSplatOctreeInstance#applyLodChanges} saw, to
     * detect which targets the allocator changed since.
     *
     * @type {Int16Array}
     * @private
     */
    _leafTarget;

    /**
     * Work-buffer allocation ids of draw ranges, per leaf and LOD level - see
     * {@link GSplatOctreeInstance#rangeAllocId}. -1 until first used. Created on first use.
     *
     * @type {Int32Array|null}
     * @private
     */
    _rangeAllocIds = null;

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
     * Tracks invisible->visible pending adds per node: nodeIndex -> fileIndex.
     * Ensures only a single pending placement exists for a node while it's not yet displayed.
     *
     * @type {Map<number, number>}
     */
    pendingVisibleAdds = new Map();

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
        this._leafDirty = new Uint8Array(octree.nodes.length).fill(1);
        this._leafTarget = new Int16Array(octree.nodes.length).fill(-1);

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
        // The LOD table is this instance's own cache reference, not one of the octree's file
        // reference counts, so it is released regardless of skipRefCounting.
        if (this.octree && !this.octree.destroyed) {
            this.octree.releaseLodTable(this.lodTable);

            // Withdraw this instance's file requests. A file another instance still requests, for
            // another camera for example, keeps loading. Without deferred ref counting nothing
            // releases an unreferenced download later, so it is unloaded right away.
            this.octree.removeRequests(this, !skipRefCounting);
        }
        this.lodTable = null;
        this.lodUnits = null;
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
        this.pendingDecrements.clear();
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
        this.pendingDecrements.clear();
        this.removedCandidates.clear();
        this.prefetchPending.clear();
        this.pendingVisibleAdds.clear();

        // Reset all nodes to invisible, and have the next LOD update evaluate every one of them
        for (const nodeInfo of this.nodeInfos) {
            nodeInfo.resetLod();
        }
        this._leafDirty.fill(1);
        this._leafTarget.fill(-1);

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
     * Returns the work-buffer allocation id of a draw range that starts at a leaf's data in one LOD
     * level. A range is a leaf, or several consecutive leaves of the same LOD file, so the leaf and
     * level it starts at fix its first splat, and its size fixes the rest: a range whose contents
     * change always arrives with a different id or a different size, which is what makes the world
     * state copy it into the work buffer again. Stable while the range is unchanged, so an unchanged
     * range keeps its allocation and is not copied again.
     *
     * @param {number} leaf - Index of the range's first leaf.
     * @param {number} level - The LOD level the range is drawn at.
     * @returns {number} The allocation id.
     */
    rangeAllocId(leaf, level) {
        const levels = this.octree.lodLevels;
        if (!this._rangeAllocIds) {
            this._rangeAllocIds = new Int32Array(this.octree.nodes.length * levels).fill(-1);
        }
        const key = leaf * levels + level;
        let id = this._rangeAllocIds[key];
        if (id < 0) {
            id = GsplatAllocId.get();
            this._rangeAllocIds[key] = id;
        }
        return id;
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
     * Selects the LOD index to display for a node, applying the underfill strategy. When underfill
     * is enabled it prefers the finest already-loaded level within `lodUnderfillLimit` steps
     * coarser than the target, so a node shows something rather than nothing while its target
     * streams in. If none are loaded it takes the coarsest level in that window.
     *
     * Steps are taken along the node's LOD chain rather than over raw LOD indices, so levels the
     * node has no data for are skipped - see GSplatLodTable.
     *
     * @param {number} nodeIndex - The octree node index.
     * @param {number} optimalLodIndex - LOD index the allocator chose.
     * @param {number} lodUnderfillLimit - Allowed number of coarser chain steps.
     * @returns {number} LOD index to display.
     */
    selectDesiredLodIndex(nodeIndex, optimalLodIndex, lodUnderfillLimit) {
        if (lodUnderfillLimit > 0 && optimalLodIndex >= 0) {
            const table = this.lodTable;
            const node = this.octree.nodes[nodeIndex];

            // prefer the finest already-loaded level within the allowed window. A node's empty level
            // (no data, no file, see GSplatLodTable) always qualifies: while its real coarsest data
            // streams in the node draws nothing, instead of being pinned to finer data early.
            const loaded = table.findCoarserAccepted(nodeIndex, optimalLodIndex, lodUnderfillLimit, (lod) => {
                const fi = node.lods[lod].fileIndex;
                return fi === -1 || !!this.octree.getFileResource(fi);
            });
            if (loaded >= 0) return loaded;

            // fall back to the coarsest level in the window that has a file at all
            let coarsest = -1;
            let lod = optimalLodIndex;
            for (let step = 0; step <= lodUnderfillLimit && lod >= 0; step++) {
                if (node.lods[lod].fileIndex !== -1) coarsest = lod;
                lod = table.coarserOnChain(nodeIndex, lod);
            }
            if (coarsest >= 0) return coarsest;
        }

        return optimalLodIndex;
    }

    /**
     * Prefetch only the next-better LOD toward optimal. This stages loading in steps across all
     * nodes, avoiding intermixing requests before coarse is present. Steps follow the node's LOD
     * chain, so they skip levels the node has no data for and never overshoot the level the
     * allocator chose.
     *
     * @param {number} nodeIndex - The octree node index.
     * @param {number} desiredLodIndex - Currently selected LOD for display (may be coarser than optimal).
     * @param {number} optimalLodIndex - Target optimal LOD.
     * @param {number} priority - Load priority for the prefetched file.
     */
    prefetchNextLod(nodeIndex, desiredLodIndex, optimalLodIndex, priority) {
        if (desiredLodIndex === -1 || optimalLodIndex === -1) return;

        // If we're already at optimal but it's not loaded yet, request it, otherwise step one
        // chain entry finer toward optimal
        const targetLod = desiredLodIndex === optimalLodIndex ?
            optimalLodIndex :
            this.lodTable.finerOnChain(nodeIndex, desiredLodIndex);
        if (targetLod < 0) return;

        const fi = this.octree.nodes[nodeIndex].lods[targetLod].fileIndex;
        if (fi !== -1 && !this.requestFile(fi, priority)) {
            this.prefetchPending.add(fi);
        }
    }

    /**
     * Requests a file for this LOD update, unless it is already loaded. A file requested more than
     * once keeps its highest priority.
     *
     * @param {number} fileIndex - The file index.
     * @param {number} priority - Load priority, higher loads first.
     * @returns {boolean} True if the file is already loaded.
     */
    requestFile(fileIndex, priority) {
        if (this.octree.pollFileResource(fileIndex)) {
            return true;
        }

        const current = this._fileRequests.get(fileIndex);
        if (current === undefined || priority > current) {
            this._fileRequests.set(fileIndex, priority);
        }
        return false;
    }

    /**
     * Resolves the configured LOD range against the octree and caches the selection table for it.
     * Called before the budget allocator, so it sees the current range.
     */
    resolveLodRange() {
        const maxLod = this.octree.lodLevels - 1;
        const { lodRangeMin, lodRangeMax } = this.placement;
        const rangeMin = Math.max(0, Math.min(lodRangeMin ?? 0, maxLod));
        const rangeMax = Math.max(rangeMin, Math.min(lodRangeMax ?? maxLod, maxLod));
        this.rangeMin = rangeMin;
        this.rangeMax = rangeMax;

        // Hold a reference only while this instance is on that range, so a table is built once per
        // live range and dropped when the last instance moves off it.
        const table = this.lodTable;
        if (!table || table.rangeMin !== rangeMin || table.rangeMax !== rangeMax) {
            this.lodTable = this.octree.acquireLodTable(rangeMin, rangeMax);
            this.octree.releaseLodTable(table);
        }
    }

    /**
     * Evaluates each node's squared world distance from the camera, with FOV compensation and the
     * behind-camera penalty folded in. This is Pass 1 of the LOD update process; results are
     * stored in the nodeInfos array and consumed by the budget allocator, which is what actually
     * picks a LOD level. Distance is measured to the nearest point of the node's bounds, and the
     * same way under both projections - an orthographic footprint carries no depth term, so this
     * is what gives it a distance ordering at all.
     *
     * @param {GraphNode} cameraNode - The camera node.
     * @param {import('./gsplat-params.js').GSplatParams} params - Global gsplat parameters.
     */
    evaluateNodeDistances(cameraNode, params) {
        const { lodBehindPenalty } = params;

        // bounds shrink towards their center by this fraction of how much larger than a typical
        // node they are - see GSplatParams#lodDistanceShrink and GSplatOctree#nodeBoundsExcess
        const shrink = params.lodDistanceShrink ?? 0;
        const excessFlat = this.octree.nodeBoundsExcess;

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

        // transform camera position to octree local space
        const worldCameraPosition = cameraNode.getPosition();
        const octreeWorldTransform = this.placement.node.getWorldTransform();
        _invWorldMat.copy(octreeWorldTransform).invert();
        const localCameraPosition = _invWorldMat.transformPoint(worldCameraPosition, _localCameraPos);
        const worldCameraForward = cameraNode.forward;
        const localCameraForward = _invWorldMat.transformVector(worldCameraForward, _localCameraFwd).normalize();

        const nodes = this.octree.nodes;
        const nodeInfos = this.nodeInfos;

        // Packed [minX,minY,minZ,maxX,maxY,maxZ] per node — see GSplatOctree.nodeBoundsMinMax (hot path; avoids BoundingBox.closestPoint per iteration).
        const boundsFlat = this.octree.nodeBoundsMinMax;

        // Everything that scales the distance, squared once. Node bounds are octree-local, so the
        // placement's uniform scale converts to world units.
        const distanceScaleSq = (fovScale * uniformScale) * (fovScale * uniformScale);
        const penalty = lodBehindPenalty > 1 ? lodBehindPenalty - 1 : 0;

        // Camera position and forward in octree local space (scalars cached for the inner loop).
        const px = localCameraPosition.x;
        const py = localCameraPosition.y;
        const pz = localCameraPosition.z;
        const fwx = localCameraForward.x;
        const fwy = localCameraForward.y;
        const fwz = localCameraForward.z;

        // LOD grouping: evaluate a cut through the octree's tree rather than every leaf
        const groupThreshold = Math.min(params.lodGroupThreshold ?? 0, 0.99);
        const tree = this.octree.tree;
        if (groupThreshold > 0 && this.lodTable && tree.count > nodes.length) {
            this._evaluateGroups(px, py, pz, fwx, fwy, fwz, fovScale * fovScale, distanceScaleSq, penalty, shrink, groupThreshold, params.splatBudget);
            return;
        }
        this.lodUnits = null;
        this.lodUnitCount = 0;

        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            const nodeInfo = nodeInfos[nodeIndex];

            // Nearest point on this node's AABB to the camera (same result as BoundingBox.closestPoint).
            const b = nodeIndex * 6;
            let minX = boundsFlat[b];
            let maxX = boundsFlat[b + 3];
            let minY = boundsFlat[b + 1];
            let maxY = boundsFlat[b + 4];
            let minZ = boundsFlat[b + 2];
            let maxZ = boundsFlat[b + 5];
            if (shrink > 0) {
                const e = nodeIndex * 3;
                const sx = excessFlat[e] * shrink;
                const sy = excessFlat[e + 1] * shrink;
                const sz = excessFlat[e + 2] * shrink;
                minX += sx;
                maxX -= sx;
                minY += sy;
                maxY -= sy;
                minZ += sz;
                maxZ -= sz;
            }

            let qx = px;
            if (qx < minX) qx = minX;
            else if (qx > maxX) qx = maxX;

            let qy = py;
            if (qy < minY) qy = minY;
            else if (qy > maxY) qy = maxY;

            let qz = pz;
            if (qz < minZ) qz = minZ;
            else if (qz > maxZ) qz = maxZ;

            // Vector from camera to closest point on the box; its length is the distance to the volume.
            const dx = qx - px;
            const dy = qy - py;
            const dz = qz - pz;
            const distanceSq = dx * dx + dy * dy + dz * dz;

            // Angular multiplier for nodes behind the camera when enabled. Only those need the
            // actual distance, to normalize the angle.
            let penaltyFactor = 1;
            if (penalty > 0 && distanceSq > 0.0001) {
                const dot = fwx * dx + fwy * dy + fwz * dz;
                if (dot < 0) {
                    // 0 .. 1 for side-on -> directly behind
                    const t = -dot / Math.sqrt(distanceSq);
                    penaltyFactor = 1 + t * penalty;
                }
            }

            nodeInfo.worldDistanceSq = distanceSq * penaltyFactor * penaltyFactor * distanceScaleSq;
        }
    }

    /**
     * The LOD grouping variant of {@link GSplatOctreeInstance#evaluateNodeDistances}: evaluates a
     * cut through the octree's tree instead of every leaf, leaving it in
     * {@link GSplatOctreeInstance#lodUnits} for the budget allocator.
     *
     * Walking down from the root, a node is split into its children while its projected size - its
     * radius over its distance, `r / (r + d)` - exceeds the threshold, so the walk reaches single
     * leaves near the camera and stops at whole subtrees far from it. Every leaf of a subtree lies
     * within about twice that fraction of the subtree's distance, so they nearly always share the
     * distance band it gets, while a LOD update costs as many nodes as the cut holds rather than as
     * many as the octree has leaves. A node is also split while it holds more splats in some band
     * than a small share of the budget, as the allocator switches groups whole.
     *
     * A node's distance is measured exactly as a leaf's is in the per-leaf pass, to its box from
     * {@link GSplatOctree#getTreeDistanceBounds} - a leaf's own shrunk bounds, or the union of its
     * leaves' - so a cut down to every leaf reproduces the ungrouped distances exactly.
     *
     * @param {number} px - Camera x in octree local space.
     * @param {number} py - Camera y in octree local space.
     * @param {number} pz - Camera z in octree local space.
     * @param {number} fwx - Camera forward x in octree local space.
     * @param {number} fwy - Camera forward y in octree local space.
     * @param {number} fwz - Camera forward z in octree local space.
     * @param {number} fovScaleSq - Squared FOV compensation.
     * @param {number} distanceScaleSq - Squared scale from local to compensated world distance.
     * @param {number} penalty - Behind-camera penalty, 0 for none.
     * @param {number} shrink - GSplatParams#lodDistanceShrink.
     * @param {number} threshold - GSplatParams#lodGroupThreshold, in (0, 1).
     * @param {number} splatBudget - GSplatParams#splatBudget.
     * @private
     */
    _evaluateGroups(px, py, pz, fwx, fwy, fwz, fovScaleSq, distanceScaleSq, penalty, shrink, threshold, splatBudget) {
        const tree = this.octree.tree;
        this._ensureLodUnitCapacity(tree.count);
        const units = /** @type {Int32Array} */ (this.lodUnits);
        const unitDistanceSq = this.lodUnitDistanceSq;
        const stack = this._cutStack;
        const { childStart, childCount, children } = tree;
        const { boundsMinMax, radius } = this.octree.getTreeDistanceBounds(shrink);
        const { maxCount } = /** @type {import('./gsplat-lod-table.js').GSplatLodTable} */ (this.lodTable).getGroupCounts(tree);

        // projected size above the threshold, r / (r + d) > t, is d < r (1 - t) / t
        const splitScale = (1 - threshold) / threshold;
        const budget = splatBudget > 0 && Number.isFinite(splatBudget) ? splatBudget : GROUP_MAX_SPLATS / GROUP_BUDGET_SHARE;
        const maxGroupSplats = Math.min(GROUP_MAX_SPLATS, Math.max(GROUP_MIN_SPLATS, budget * GROUP_BUDGET_SHARE));

        // Depth-first, children pushed in reverse so leaves are reached in index order.
        let count = 0;
        let top = 0;
        stack[top++] = 0;
        while (top > 0) {
            const n = stack[--top];

            // distance terms exactly as in the per-leaf loop of evaluateNodeDistances
            const b = n * 6;
            let qx = px;
            const minX = boundsMinMax[b];
            const maxX = boundsMinMax[b + 3];
            if (qx < minX) qx = minX;
            else if (qx > maxX) qx = maxX;

            let qy = py;
            const minY = boundsMinMax[b + 1];
            const maxY = boundsMinMax[b + 4];
            if (qy < minY) qy = minY;
            else if (qy > maxY) qy = maxY;

            let qz = pz;
            const minZ = boundsMinMax[b + 2];
            const maxZ = boundsMinMax[b + 5];
            if (qz < minZ) qz = minZ;
            else if (qz > maxZ) qz = maxZ;

            const dx = qx - px;
            const dy = qy - py;
            const dz = qz - pz;
            const distanceSq = dx * dx + dy * dy + dz * dz;

            let penaltyFactor = 1;
            if (penalty > 0 && distanceSq > 0.0001) {
                const dot = fwx * dx + fwy * dy + fwz * dz;
                if (dot < 0) {
                    const t = -dot / Math.sqrt(distanceSq);
                    penaltyFactor = 1 + t * penalty;
                }
            }
            const penaltySq = penaltyFactor * penaltyFactor;

            const nodeChildren = childCount[n];
            if (nodeChildren > 0) {
                const split = radius[n] * splitScale;
                if (distanceSq * penaltySq * fovScaleSq < split * split || maxCount[n] > maxGroupSplats) {
                    const first = childStart[n];
                    for (let k = nodeChildren - 1; k >= 0; k--) {
                        stack[top++] = children[first + k];
                    }
                    continue;
                }
            }

            // multiplied in the per-leaf pass's order, so a leaf unit's value is bit-identical
            units[count] = n;
            unitDistanceSq[count] = distanceSq * penaltyFactor * penaltyFactor * distanceScaleSq;
            count++;
        }
        this.lodUnitCount = count;
    }

    /**
     * Makes sure the LOD unit arrays can hold a cut through a tree of the given size, and marks
     * this update as grouped.
     *
     * @param {number} capacity - Number of nodes in the tree.
     * @private
     */
    _ensureLodUnitCapacity(capacity) {
        if (this._cutStack.length < capacity) {
            this._cutStack = new Int32Array(capacity);
            this._lodUnitStorage = new Int32Array(capacity);
            this.lodUnitDistanceSq = new Float64Array(capacity);
            this.lodUnitBand = new Int16Array(capacity);
        }
        this.lodUnits = this._lodUnitStorage;
    }

    /**
     * Hands the band each LOD unit was given to all the leaves under it: each leaf takes its own
     * level for that band, with its own gaps and empty level resolved, along with the unit's
     * distance, which orders the leaves' loads and paces their color updates. Everything downstream
     * - placements, streaming, underfill - then works per leaf exactly as ungrouped. Flags the
     * leaves whose target changed for {@link GSplatOctreeInstance#applyLodChanges}.
     *
     * @private
     */
    _spreadLodUnits() {
        const { leafStart, leafEnd } = this.octree.tree;
        const { bandLod, span } = /** @type {import('./gsplat-lod-table.js').GSplatLodTable} */ (this.lodTable);
        const units = /** @type {Int32Array} */ (this.lodUnits);
        const nodeInfos = this.nodeInfos;
        const leafTarget = this._leafTarget;
        const leafDirty = this._leafDirty;
        for (let u = 0; u < this.lodUnitCount; u++) {
            const n = units[u];
            const band = this.lodUnitBand[u];
            const distanceSq = this.lodUnitDistanceSq[u];
            for (let leaf = leafStart[n], end = leafEnd[n]; leaf < end; leaf++) {
                const target = band >= 0 ? bandLod[leaf * span + band] : -1;
                const info = nodeInfos[leaf];
                info.optimalLod = target;
                info.worldDistanceSq = distanceSq;
                if (leafTarget[leaf] !== target) {
                    leafTarget[leaf] = target;
                    leafDirty[leaf] = 1;
                }
            }
        }
    }

    /**
     * Applies calculated LOD changes and manages file placements.
     * This is Pass 2 of the LOD update process. Reads the levels the budget allocator wrote into
     * the nodeInfos array.
     *
     * Also requests every file this instance still waits for, with a load priority. The priority
     * is ranked by tier first - a node that shows nothing yet, then a node waiting to switch LOD,
     * then a prefetch of the next finer level - and within a tier by the node's
     * {@link NodeInfo#worldDistanceSq}, so the view fills with coarse data first and then refines
     * nearest the camera first. A file shared by several nodes takes the highest priority of them.
     * The requests are submitted to the octree, which combines them with those of its other
     * instances and issues them in {@link GSplatOctree#flushRequests}.
     *
     * @param {import('./gsplat-params.js').GSplatParams} params - Global gsplat parameters.
     */
    applyLodChanges(params) {
        const octree = this.octree;
        const nodes = octree.nodes;
        const { lodUnderfillLimit = 0 } = params;
        const leafDirty = this._leafDirty;

        // Flag the leaves whose target the allocator changed. With LOD grouping the targets were
        // chosen per group and reach the leaves here, which flags them on the way.
        if (this.lodUnits) {
            this._spreadLodUnits();
        } else {
            const leafTarget = this._leafTarget;
            for (let i = 0; i < nodes.length; i++) {
                const target = this.nodeInfos[i].optimalLod;
                if (leafTarget[i] !== target) {
                    leafTarget[i] = target;
                    leafDirty[i] = 1;
                }
            }
        }

        // Rebuilt below from what the nodes still want, so a file nothing wants any more stops
        // being requested and tracked. Only flagged leaves can want anything: a settled leaf's file
        // is loaded and it has nothing to prefetch.
        this.prefetchPending.clear();
        this._fileRequests.clear();

        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            if (!leafDirty[nodeIndex]) continue;
            const node = nodes[nodeIndex];
            const nodeInfo = this.nodeInfos[nodeIndex];

            const optimalLodIndex = nodeInfo.optimalLod;
            const currentLodIndex = nodeInfo.currentLod;

            // Apply underfill strategy to determine desired LOD for streaming
            const desiredLodIndex = this.selectDesiredLodIndex(nodeIndex, optimalLodIndex, lodUnderfillLimit);

            // if desired LOD differs from currently displayed LOD
            if (desiredLodIndex !== currentLodIndex) {

                // Determine visibility based on the presence of a valid file index
                const currentFileIndex = currentLodIndex >= 0 ? node.lods[currentLodIndex].fileIndex : -1;
                const desiredFileIndex = desiredLodIndex >= 0 ? node.lods[desiredLodIndex].fileIndex : -1;
                const wasVisible = currentFileIndex !== -1;
                const willBeVisible = desiredFileIndex !== -1;

                // if there's a pending transition, manage it without dropping the currently visible LOD
                const pendingEntry = this.pendingDecrements.get(nodeIndex);
                if (pendingEntry) {
                    // if desired target changed while previous target was still loading, cancel previous target for this node
                    if (pendingEntry.newFileIndex !== desiredFileIndex) {
                        // remove this node's interval from the previously pending target if it still exists
                        const prevPendingPlacement = this.filePlacements[pendingEntry.newFileIndex];
                        if (prevPendingPlacement) {
                            this.decrementFileRef(pendingEntry.newFileIndex, nodeIndex);
                        }

                        // update or clear pending transition
                        if (wasVisible && willBeVisible) {
                            this.pendingDecrements.set(nodeIndex, { oldFileIndex: pendingEntry.oldFileIndex, newFileIndex: desiredFileIndex });
                        } else {
                            // no longer targeting a visible LOD; clear pending and let normal logic handle hide/show
                            this.pendingDecrements.delete(nodeIndex);
                        }
                    }
                    // if target stays the same, keep pending as-is until the resource loads
                }

                if (!wasVisible && willBeVisible) {

                    // becoming visible (invisible -> visible)

                    // if we had a previous pending visible-add for a different file, cancel it
                    const prevPendingFi = this.pendingVisibleAdds.get(nodeIndex);
                    if (prevPendingFi !== undefined && prevPendingFi !== desiredFileIndex) {
                        this.decrementFileRef(prevPendingFi, nodeIndex);
                        this.pendingVisibleAdds.delete(nodeIndex);
                    }

                    this.incrementFileRef(desiredFileIndex, nodeIndex, desiredLodIndex);
                    const newPlacement = this.filePlacements[desiredFileIndex];
                    if (newPlacement?.resource) {
                        // resource is ready now, display immediately
                        nodeInfo.currentLod = desiredLodIndex;
                        // clear any pending visible-add entry
                        this.pendingVisibleAdds.delete(nodeIndex);
                    } else {
                        // keep displayed as invisible until resource arrives; next update will promote
                        this.pendingVisibleAdds.set(nodeIndex, desiredFileIndex);
                    }

                } else if (wasVisible && !willBeVisible) {

                    // becoming invisible (visible -> invisible)
                    // if there was a pending target for this node, cancel it first
                    const pendingEntry2 = this.pendingDecrements.get(nodeIndex);
                    if (pendingEntry2) {
                        this.decrementFileRef(pendingEntry2.newFileIndex, nodeIndex);
                        this.pendingDecrements.delete(nodeIndex);
                    }
                    this.decrementFileRef(currentFileIndex, nodeIndex);
                    nodeInfo.currentLod = -1;
                    // clear any pending visible-add entry
                    this.pendingVisibleAdds.delete(nodeIndex);

                } else if (wasVisible && willBeVisible) {

                    // switching between visible LODs (visible -> visible)
                    this.incrementFileRef(desiredFileIndex, nodeIndex, desiredLodIndex);

                    const newPlacement = this.filePlacements[desiredFileIndex];
                    if (newPlacement?.resource) {
                        // new LOD ready - remove old LOD immediately
                        this.decrementFileRef(currentFileIndex, nodeIndex);
                        // clear any pending for this node if exists
                        this.pendingDecrements.delete(nodeIndex);
                        // update displayed lod now that switch is complete
                        nodeInfo.currentLod = desiredLodIndex;
                        // clear any pending visible-add entry
                        this.pendingVisibleAdds.delete(nodeIndex);
                    } else {
                        // new LOD not ready - track pending decrement for when it loads
                        this.pendingDecrements.set(nodeIndex, { oldFileIndex: currentFileIndex, newFileIndex: desiredFileIndex });
                        // keep displayed lod as current until pending resolves
                        // ensure no pending visible-add entry remains
                        this.pendingVisibleAdds.delete(nodeIndex);
                    }
                }
            }

            // Priority within a tier, nearer first: inverse square distance mapped monotonically
            // into [0, 1).
            const rank = 1 / (1 + Math.max(nodeInfo.worldDistanceSq, 1e-12));

            // request the file the node waits for, to become visible or to switch LOD
            const visibleAddFi = this.pendingVisibleAdds.get(nodeIndex);
            if (visibleAddFi !== undefined) {
                this.requestFile(visibleAddFi, LOAD_TIER_VISIBLE + rank);
            }
            const pendingSwitch = this.pendingDecrements.get(nodeIndex);
            if (pendingSwitch) {
                this.requestFile(pendingSwitch.newFileIndex, LOAD_TIER_SWITCH + rank);
            }

            // Prefetch loading: request only the next-better LOD toward optimal
            this.prefetchNextLod(nodeIndex, desiredLodIndex, optimalLodIndex, LOAD_TIER_PREFETCH + rank);

            // Settled once it shows its target - or shows nothing, for a target with nothing to
            // draw - and waits for no file. Its target's file is then loaded, so it has nothing to
            // switch, request or prefetch, and later updates skip it until the target changes.
            const targetVisible = optimalLodIndex >= 0 && node.lods[optimalLodIndex].fileIndex !== -1;
            if ((targetVisible ? nodeInfo.currentLod === optimalLodIndex : nodeInfo.currentLod === -1) &&
                visibleAddFi === undefined && pendingSwitch === undefined) {
                leafDirty[nodeIndex] = 0;
            }
        }

        // Every placement still waiting for its file must stay requested, or flushRequests would
        // withdraw it. The nodes above cover these with their own priorities, this is only a floor.
        for (const fileIndex of this.pending) {
            this.requestFile(fileIndex, LOAD_TIER_PREFETCH);
        }

        octree.submitRequests(this, this._fileRequests);
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

                // if resource became available, update placement and execute any pending decrements
                if (this.addFilePlacement(fileIndex)) {
                    _tempCompletedUrls.push(fileIndex);

                    // Execute any pending decrements for nodes whose tracked newFileIndex now matches
                    for (const [nodeIndex, { oldFileIndex, newFileIndex }] of this.pendingDecrements) {
                        if (newFileIndex === fileIndex) {
                            this.decrementFileRef(oldFileIndex, nodeIndex);
                            this.pendingDecrements.delete(nodeIndex);

                            // set displayed LOD to the LOD that maps to the newly ready file
                            let newLodIndex = 0;
                            const nodeLods = this.octree.nodes[nodeIndex].lods;
                            for (let li = 0; li < nodeLods.length; li++) {
                                if (nodeLods[li].fileIndex === newFileIndex) {
                                    newLodIndex = li;
                                    break;
                                }
                            }
                            this.nodeInfos[nodeIndex].currentLod = newLodIndex;
                        }
                    }
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

    // debug render world space bounds for octree nodes based on current LOD selection
    debugRender(scene) {
        Debug.call(() => {
            if (scene.gsplat.debug === GSPLAT_DEBUG_NODE_AABBS) {
                const modelMat = this.placement.node.getWorldTransform();

                // with LOD grouping, show the groups - the cut the allocator chose bands on
                if (this.lodUnits) {
                    const { boundsMinMax } = this.octree.tree;
                    const rangeMin = this.lodTable?.rangeMin ?? 0;
                    for (let u = 0; u < this.lodUnitCount; u++) {
                        const band = this.lodUnitBand[u];
                        if (band < 0) continue;
                        const b = this.lodUnits[u] * 6;
                        _tempDebugMin.set(boundsMinMax[b], boundsMinMax[b + 1], boundsMinMax[b + 2]);
                        _tempDebugMax.set(boundsMinMax[b + 3], boundsMinMax[b + 4], boundsMinMax[b + 5]);
                        _tempDebugBox.setMinMax(_tempDebugMin, _tempDebugMax);
                        _tempDebugAabb.setFromTransformedAabb(_tempDebugBox, modelMat);
                        const color = _lodColors[Math.min(rangeMin + band, _lodColors.length - 1)];
                        scene.immediate.drawWireAlignedBox(_tempDebugAabb.getMin(), _tempDebugAabb.getMax(), color, true, scene.defaultDrawLayer);
                    }
                    return;
                }

                const nodes = this.octree.nodes;
                for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
                    const lodIndex = this.nodeInfos[nodeIndex].currentLod;
                    if (lodIndex >= 0) {
                        const color = _lodColors[Math.min(lodIndex, _lodColors.length - 1)];
                        _tempDebugAabb.setFromTransformedAabb(nodes[nodeIndex].bounds, modelMat);
                        scene.immediate.drawWireAlignedBox(_tempDebugAabb.getMin(), _tempDebugAabb.getMax(), color, true, scene.defaultDrawLayer);
                    }
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
