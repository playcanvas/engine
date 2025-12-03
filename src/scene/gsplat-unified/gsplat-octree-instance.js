import { Debug } from '../../core/debug.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { Color } from '../../core/math/color.js';
import { GSplatPlacement } from './gsplat-placement.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { GSplatOctree } from './gsplat-octree.js'
 * @import { Scene } from '../scene.js'
 * @import { EventHandle } from '../../core/event-handle.js'
 */

const _invWorldMat = new Mat4();
const _localCameraPos = new Vec3();
const _localCameraFwd = new Vec3();
const _dirToNode = new Vec3();

const _tempCompletedUrls = [];
const _tempDebugAabb = new BoundingBox();

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
     * @type {number}
     */
    currentLod = -1;

    /**
     * Optimal LOD index based on distance/visibility (before underfill).
     * @type {number}
     */
    optimalLod = -1;

    /**
     * Importance of this node (0..1 range, higher = more important).
     * Used for budget enforcement - higher importance nodes maintain quality when budget is exceeded.
     * @type {number}
     */
    importance = 0;

    /**
     * Resets all LOD values to -1 (invisible/uninitialized).
     */
    reset() {
        this.currentLod = -1;
        this.optimalLod = -1;
        this.importance = 0;
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

    /** @type {GraphicsDevice} */
    device;

    /**
     * Array of NodeInfo instances, one per octree node.
     * @type {NodeInfo[]}
     */
    nodeInfos;

    /**
     * Array of current placements per file. Index is fileIndex, value is GSplatPlacement or null.
     * Value null indicates file is not used / no placement.
     * @type {(GSplatPlacement|null)[]}
     */
    filePlacements;

    /**
     * Set of pending file loads (file indices).
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
     * Previous node position at which LOD was last updated. This is used to determine if LOD needs
     * to be updated as the octree splat moves.
     *
     * @type {Vec3}
     */
    previousPosition = new Vec3();

    /**
     * Set when a resource has completed loading and LOD should be re-evaluated.
     *
     * @type {boolean}
     */
    needsLodUpdate = false;

    /**
     * Tracks prefetched file indices that are being loaded without active placements.
     * When any completes, we trigger LOD re-evaluation to allow promotion.
     *
     * @type {Set<number>}
     */
    prefetchPending = new Set();

    /**
     * Tracks invisible->visible pending adds per node: nodeIndex -> fileIndex.
     * Ensures only a single pending placement exists for a node while it's not yet displayed.
     * @type {Map<number, number>}
     */
    pendingVisibleAdds = new Map();

    /**
     * Reusable array of node indices for budget enforcement sorting.
     * Lazy-allocated on first budget enforcement, then reused.
     * @type {Uint32Array|null}
     * @private
     */
    _nodeIndices = null;

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
            this.nodeInfos[i] = new NodeInfo();
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
     */
    destroy() {
        // Only decrement refs if octree is still alive
        // Skip ref counting if octree was force-destroyed (e.g., asset unloaded)
        if (this.octree && !this.octree.destroyed) {
            // Decrement ref counts for all files currently in use (loaded files)
            const filesToDecRef = this.getFileDecrements();
            for (const fileIndex of filesToDecRef) {
                this.octree.decRefCount(fileIndex, 0);
            }

            // Also unload files that are pending (requested but not loaded yet)
            for (const fileIndex of this.pending) {
                // Skip if already in filePlacements (already handled above)
                if (!this.filePlacements[fileIndex]) {
                    this.octree.unloadResource(fileIndex);
                }
            }

            // Same for prefetch pending
            for (const fileIndex of this.prefetchPending) {
                if (!this.filePlacements[fileIndex]) {
                    this.octree.unloadResource(fileIndex);
                }
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

        // Reset all nodes to invisible
        for (const nodeInfo of this.nodeInfos) {
            nodeInfo.reset();
        }

        // Clean up environment if present
        if (this.environmentPlacement) {
            this.activePlacements.delete(this.environmentPlacement);
            this.environmentPlacement = null;
            this.octree.unloadEnvironmentResource();
        }

        // Mark that LOD needs to be re-evaluated after context restore
        this.dirtyModifiedPlacements = true;
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
     * Calculate LOD index for a specific node using pre-calculated local camera position.
     * @param {Vec3} localCameraPosition - The camera position in local space.
     * @param {Vec3} localCameraForward - The camera forward direction in local space (normalized).
     * @param {number} nodeIndex - The node index.
     * @param {number} maxLod - The maximum LOD index (lodLevels - 1).
     * @param {number[]} lodDistances - Array of distance thresholds per LOD.
     * @param {number} lodBehindPenalty - Multiplier for behind-camera distance. 1 disables penalty.
     * @returns {number} The LOD index for this node, or -1 if node should not be rendered.
     */
    calculateNodeLod(localCameraPosition, localCameraForward, nodeIndex, maxLod, lodDistances, lodBehindPenalty) {
        const node = this.octree.nodes[nodeIndex];

        // Calculate the nearest point on the bounding box to the camera for accurate distance
        node.bounds.closestPoint(localCameraPosition, _dirToNode);

        // Calculate direction from camera to nearest point on box
        _dirToNode.sub(localCameraPosition);
        let distance = _dirToNode.length();

        // Apply angular-based multiplier for nodes behind the camera when enabled
        if (lodBehindPenalty > 1 && distance > 0.01) {

            // dot using unnormalized direction to avoid extra normalize; divide by distance
            const dotOverDistance = localCameraForward.dot(_dirToNode) / distance;

            // Only apply penalty when behind the camera (dot < 0)
            if (dotOverDistance < 0) {
                const t = -dotOverDistance; // 0 .. 1 for front -> directly behind
                const factor = 1 + t * (lodBehindPenalty - 1);
                distance *= factor;
            }
        }

        // Find appropriate LOD based on distance and available LOD levels
        for (let lod = 0; lod < maxLod; lod++) {
            if (distance < lodDistances[lod]) {
                return lod;
            }
        }

        // If distance is greater than all thresholds, use the highest available LOD
        return maxLod;

        // return -1 for past far plane
    }

    /**
     * Selects desired LOD index for a node using the underfill strategy. When underfill is enabled,
     * it prefers already-loaded LODs within [optimalLodIndex .. optimalLodIndex + lodUnderfillLimit].
     * If none are loaded, it selects the coarsest available LOD within the range.
     *
     * @param {import('./gsplat-octree-node.js').GSplatOctreeNode} node - The octree node.
     * @param {number} optimalLodIndex - Optimal LOD index based on camera/distance.
     * @param {number} maxLod - Maximum LOD index.
     * @param {number} lodUnderfillLimit - Allowed coarse range above optimal.
     * @returns {number} Desired LOD index to display.
     */
    selectDesiredLodIndex(node, optimalLodIndex, maxLod, lodUnderfillLimit) {
        if (lodUnderfillLimit > 0) {
            const allowedMaxCoarseLod = Math.min(maxLod, optimalLodIndex + lodUnderfillLimit);

            // prefer highest quality already-loaded within the allowed range
            for (let lod = optimalLodIndex; lod <= allowedMaxCoarseLod; lod++) {
                const fi = node.lods[lod].fileIndex;
                if (fi !== -1 && this.octree.getFileResource(fi)) {
                    return lod;
                }
            }

            // fallback: choose the coarsest available within the range
            for (let lod = allowedMaxCoarseLod; lod >= optimalLodIndex; lod--) {
                const fi = node.lods[lod].fileIndex;
                if (fi !== -1) {
                    return lod;
                }
            }
        }

        return optimalLodIndex;
    }

    /**
     * Prefetch only the next-better LOD toward optimal. This stages loading in steps across all
     * nodes, avoiding intermixing requests before coarse is present.
     *
     * @param {import('./gsplat-octree-node.js').GSplatOctreeNode} node - The octree node.
     * @param {number} desiredLodIndex - Currently selected LOD for display (may be coarser than optimal).
     * @param {number} optimalLodIndex - Target optimal LOD.
     */
    prefetchNextLod(node, desiredLodIndex, optimalLodIndex) {
        if (desiredLodIndex === -1 || optimalLodIndex === -1) return;

        // If we're already at optimal but it's not loaded yet, request it
        if (desiredLodIndex === optimalLodIndex) {
            const fi = node.lods[optimalLodIndex].fileIndex;
            if (fi !== -1) {
                this.octree.ensureFileResource(fi);
                if (!this.octree.getFileResource(fi)) {
                    this.prefetchPending.add(fi);
                }
            }
            return;
        }

        // Step one level finer toward optimal
        const targetLod = Math.max(optimalLodIndex, desiredLodIndex - 1);
        // Find first valid fileIndex between targetLod..optimalLodIndex
        for (let lod = targetLod; lod >= optimalLodIndex; lod--) {
            const fi = node.lods[lod].fileIndex;
            if (fi !== -1) {
                this.octree.ensureFileResource(fi);
                if (!this.octree.getFileResource(fi)) {
                    this.prefetchPending.add(fi);
                }
                break;
            }
        }
    }

    /**
     * Updates the octree instance when LOD needs to be updated.
     *
     * @param {GraphNode} cameraNode - The camera node.
     * @param {import('./gsplat-params.js').GSplatParams} params - Global gsplat parameters.
     */
    updateLod(cameraNode, params) {

        const maxLod = this.octree.lodLevels - 1;
        const lodDistances = this.placement.lodDistances || [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

        // Clamp configured LOD range to valid bounds [0, maxLod] and ensure min <= max
        const { lodRangeMin, lodRangeMax } = params;
        const rangeMin = Math.max(0, Math.min(lodRangeMin ?? 0, maxLod));
        const rangeMax = Math.max(rangeMin, Math.min(lodRangeMax ?? maxLod, maxLod));

        // Pass 1: Evaluate optimal LOD for each node (distance-based)
        const totalOptimalSplats = this.evaluateNodeLods(cameraNode, maxLod, lodDistances, rangeMin, rangeMax, params);

        // Enforce splat budget if enabled and over budget
        const { splatBudget } = params;
        if (splatBudget > 0 && totalOptimalSplats > splatBudget) {
            this.enforceSplatBudget(totalOptimalSplats, splatBudget, rangeMax);
        }

        // Pass 2: Calculate desired LOD (underfill) and apply changes
        this.applyLodChanges(maxLod, params);
    }

    /**
     * Evaluates optimal LOD indices for all nodes based on camera position and parameters.
     * This is Pass 1 of the LOD update process. Results are stored in nodeInfos array.
     *
     * @param {GraphNode} cameraNode - The camera node.
     * @param {number} maxLod - Maximum LOD index (lodLevels - 1).
     * @param {number[]} lodDistances - Array of distance thresholds per LOD.
     * @param {number} rangeMin - Minimum allowed LOD index.
     * @param {number} rangeMax - Maximum allowed LOD index.
     * @param {import('./gsplat-params.js').GSplatParams} params - Global gsplat parameters.
     * @returns {number} Total number of splats that would be used by optimal LODs.
     * @private
     */
    evaluateNodeLods(cameraNode, maxLod, lodDistances, rangeMin, rangeMax, params) {
        const { lodBehindPenalty } = params;

        // transform camera position to octree local space
        const worldCameraPosition = cameraNode.getPosition();
        const octreeWorldTransform = this.placement.node.getWorldTransform();
        _invWorldMat.copy(octreeWorldTransform).invert();
        const localCameraPosition = _invWorldMat.transformPoint(worldCameraPosition, _localCameraPos);
        const worldCameraForward = cameraNode.forward;
        const localCameraForward = _invWorldMat.transformVector(worldCameraForward, _localCameraFwd).normalize();

        const nodes = this.octree.nodes;
        const nodeInfos = this.nodeInfos;
        let totalSplats = 0;

        // Use distance threshold for max LOD range to normalize importance
        const maxDistance = lodDistances[rangeMax] || 100;

        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            const node = nodes[nodeIndex];

            // Calculate the nearest point on the bounding box to the camera for accurate distance
            node.bounds.closestPoint(localCameraPosition, _dirToNode);

            // Calculate direction from camera to nearest point on box
            _dirToNode.sub(localCameraPosition);
            const actualDistance = _dirToNode.length();

            // Apply angular-based multiplier for nodes behind the camera when enabled
            let penalizedDistance = actualDistance;
            let importanceMultiplier = 1.0;

            if (lodBehindPenalty > 1 && actualDistance > 0.01) {
                // dot using unnormalized direction to avoid extra normalize; divide by distance
                const dotOverDistance = localCameraForward.dot(_dirToNode) / actualDistance;

                // Only apply penalty when behind the camera (dot < 0)
                if (dotOverDistance < 0) {
                    const t = -dotOverDistance; // 0 .. 1 for front -> directly behind
                    const factor = 1 + t * (lodBehindPenalty - 1);
                    penalizedDistance = actualDistance * factor;
                    importanceMultiplier = 1.0 / factor; // inverse for importance
                }
            }

            // Find appropriate LOD based on penalized distance
            let optimalLodIndex = maxLod;
            for (let lod = 0; lod < maxLod; lod++) {
                if (penalizedDistance < lodDistances[lod]) {
                    optimalLodIndex = lod;
                    break;
                }
            }

            // Clamp to configured range
            if (optimalLodIndex < rangeMin) optimalLodIndex = rangeMin;
            if (optimalLodIndex > rangeMax) optimalLodIndex = rangeMax;

            // Calculate importance: inverse of distance, normalized, with behind-camera penalty
            const normalizedDistance = Math.min(actualDistance / maxDistance, 1.0);
            const importance = (1.0 - normalizedDistance) * importanceMultiplier;

            // Store optimal LOD and importance
            nodeInfos[nodeIndex].optimalLod = optimalLodIndex;
            nodeInfos[nodeIndex].importance = importance;

            // Count splats for this optimal LOD
            const lod = nodes[nodeIndex].lods[optimalLodIndex];
            if (lod && lod.count) {
                totalSplats += lod.count;
            }
        }

        return totalSplats;
    }

    /**
     * Adjusts optimal LOD indices to fit within the splat budget by degrading quality
     * for lower-importance nodes first. Uses multiple passes, degrading by one level per pass,
     * until within budget or all nodes are at maximum coarseness (rangeMax).
     *
     * @param {number} totalSplats - Current total splat count with optimal LODs.
     * @param {number} splatBudget - Maximum allowed splat count.
     * @param {number} rangeMax - Maximum allowed LOD index.
     * @private
     */
    enforceSplatBudget(totalSplats, splatBudget, rangeMax) {
        const nodes = this.octree.nodes;
        const nodeInfos = this.nodeInfos;

        // Lazy-allocate node indices array on first use
        if (!this._nodeIndices) {
            this._nodeIndices = new Uint32Array(nodes.length);
            for (let i = 0; i < nodes.length; i++) {
                this._nodeIndices[i] = i;
            }
        }

        // Sort node indices by importance (lowest first) - done once
        const nodeIndices = this._nodeIndices;
        nodeIndices.sort((a, b) => nodeInfos[a].importance - nodeInfos[b].importance);

        let currentSplats = totalSplats;

        // Multiple passes: degrade by one level per pass until within budget
        while (currentSplats > splatBudget) {
            let degradedAnyNode = false;

            // Try degrading each node by one level (starting from lowest importance)
            for (let i = 0; i < nodeIndices.length; i++) {
                if (currentSplats <= splatBudget) {
                    break; // Within budget
                }

                const nodeIndex = nodeIndices[i];
                const nodeInfo = nodeInfos[nodeIndex];
                const node = nodes[nodeIndex];
                const currentOptimalLod = nodeInfo.optimalLod;

                // Try degrading to next coarser LOD (respect rangeMax constraint)
                if (currentOptimalLod < rangeMax) {
                    const currentLod = node.lods[currentOptimalLod];
                    const nextLod = node.lods[currentOptimalLod + 1];
                    const splatsSaved = currentLod.count - nextLod.count;

                    // Degrade to coarser LOD
                    nodeInfo.optimalLod = currentOptimalLod + 1;
                    currentSplats -= splatsSaved;
                    degradedAnyNode = true;
                }
            }

            // If no nodes could be degraded, all are at rangeMax - can't reduce further
            if (!degradedAnyNode) {
                break;
            }
        }
    }

    /**
     * Applies calculated LOD changes and manages file placements.
     * This is Pass 2 of the LOD update process. Reads from nodeInfos array populated by evaluateNodeLods().
     *
     * @param {number} maxLod - Maximum LOD index (lodLevels - 1).
     * @param {import('./gsplat-params.js').GSplatParams} params - Global gsplat parameters.
     * @private
     */
    applyLodChanges(maxLod, params) {
        const nodes = this.octree.nodes;
        const { lodUnderfillLimit = 0 } = params;

        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            const node = nodes[nodeIndex];
            const nodeInfo = this.nodeInfos[nodeIndex];

            const optimalLodIndex = nodeInfo.optimalLod;
            const currentLodIndex = nodeInfo.currentLod;

            // Apply underfill strategy to determine desired LOD for streaming
            const desiredLodIndex = this.selectDesiredLodIndex(node, optimalLodIndex, maxLod, lodUnderfillLimit);

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

            // Prefetch loading: request only the next-better LOD toward optimal
            this.prefetchNextLod(node, desiredLodIndex, optimalLodIndex);
        }
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
            placement = new GSplatPlacement(null, this.placement.node, lodIndex);
            this.filePlacements[fileIndex] = placement;

            // If we scheduled a remove for this file in this update, cancel it
            const removeScheduled = this.removedCandidates.delete(fileIndex);
            if (!removeScheduled) {
                this.octree.incRefCount(fileIndex);
            }

            // if resource is already loaded, allow it to be used
            if (!this.addFilePlacement(fileIndex)) {

                // resource not loaded yet, kick off load and add to pending
                this.octree.ensureFileResource(fileIndex);
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
                placement.aabb.copy(res.aabb);
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
     * @param {Scene} scene - Optional scene for debug rendering.
     * @returns {boolean} True if octree instance is dirty, false otherwise.
     */
    update(scene) {

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
                this.environmentPlacement = new GSplatPlacement(envResource, this.placement.node, 0);
                this.environmentPlacement.aabb.copy(envResource.aabb);
                this.activePlacements.add(this.environmentPlacement);
                this.dirtyModifiedPlacements = true;
            }
        }

        // check if any placements need LOD update
        const dirty = this.dirtyModifiedPlacements;
        this.dirtyModifiedPlacements = false;
        return dirty;
    }

    // debug render world space bounds for octree nodes based on current LOD selection
    debugRender(scene) {
        Debug.call(() => {
            if (scene.gsplat.debugNodeAabbs) {
                const modelMat = this.placement.node.getWorldTransform();
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

export { GSplatOctreeInstance };
