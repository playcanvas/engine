import { Debug } from '../../core/debug.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { Color } from '../../core/math/color.js';
import { GSplatPlacement } from './gsplat-placement.js';

/**
 * @import { GraphNode } from '../graph-node.js'
 * @import { GSplatOctree } from './gsplat-octree.js'
 * @import { GSplatAssetLoaderBase } from './gsplat-asset-loader-base.js'
 * @import { Scene } from '../scene.js'
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

class GSplatOctreeInstance {
    /** @type {GSplatOctree} */
    octree;

    /** @type {GSplatPlacement} */
    placement;

    /** @type {Set<GSplatPlacement>} */
    activePlacements = new Set();

    /** @type {boolean} */
    dirtyModifiedPlacements = false;

    /** @type {GSplatAssetLoaderBase} */
    assetLoader;

    /**
     * Array of current LOD index per node. Index is nodeIndex, value is lodIndex.
     * Value -1 indicates node is not visible.
     * @type {Int32Array}
     */
    nodeLods;

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
     * Returns true if this instance has resources pending load or prefetch.
     *
     * @type {boolean}
     */
    get hasPendingLoads() {
        return this.pending.size > 0 || this.prefetchPending.size > 0;
    }

    /**
     * Environment placement.
     * @type {GSplatPlacement|null}
     */
    environmentPlacement = null;

    /**
     * @param {GSplatOctree} octree - The octree.
     * @param {GSplatPlacement} placement - The placement.
     * @param {GSplatAssetLoaderBase} assetLoader - The asset loader.
     */
    constructor(octree, placement, assetLoader) {
        this.octree = octree;
        this.placement = placement;
        this.assetLoader = assetLoader;

        // Initialize nodeLods array with all nodes set to -1 (not visible)
        this.nodeLods = new Int32Array(octree.nodes.length);
        this.nodeLods.fill(-1);

        // Initialize file placements array
        const numFiles = octree.files.length;
        this.filePlacements = new Array(numFiles).fill(null);

        // Handle environment if configured
        if (octree.environmentUrl) {
            octree.incEnvironmentRefCount();
            octree.ensureEnvironmentResource(assetLoader);
        }
    }

    /**
     * Destroys this octree instance and clears internal references.
     */
    destroy() {
        this.pending.clear();
        this.pendingDecrements.clear();
        this.filePlacements.length = 0;

        // Clean up environment if present
        if (this.environmentPlacement) {
            this.activePlacements.delete(this.environmentPlacement);
            this.octree.decEnvironmentRefCount(this.assetLoader);
            this.environmentPlacement = null;
        }
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
                this.octree.ensureFileResource(fi, this.assetLoader);
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
                this.octree.ensureFileResource(fi, this.assetLoader);
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

        // transform camera position to octree local space
        const worldCameraPosition = cameraNode.getPosition();
        const octreeWorldTransform = this.placement.node.getWorldTransform();
        _invWorldMat.copy(octreeWorldTransform).invert();
        const localCameraPosition = _invWorldMat.transformPoint(worldCameraPosition, _localCameraPos);
        const worldCameraForward = cameraNode.forward;
        const localCameraForward = _invWorldMat.transformVector(worldCameraForward, _localCameraFwd).normalize();

        // calculate max LOD once for all nodes
        const maxLod = this.octree.lodLevels - 1;
        const lodDistances = this.placement.lodDistances || [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

        // parameters
        const { lodBehindPenalty, lodRangeMin, lodRangeMax, lodUnderfillLimit = 0 } = params;

        // Clamp configured LOD range to valid bounds [0, maxLod] and ensure min <= max
        const rangeMin = Math.max(0, Math.min(lodRangeMin ?? 0, maxLod));
        const rangeMax = Math.max(rangeMin, Math.min(lodRangeMax ?? maxLod, maxLod));


        // process all nodes
        const nodes = this.octree.nodes;
        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            const node = nodes[nodeIndex];

            // LOD for the node, clamped by configured range
            // optimal target LOD based on distance and range
            let optimalLodIndex = this.calculateNodeLod(localCameraPosition, localCameraForward, nodeIndex, maxLod, lodDistances, lodBehindPenalty);
            if (optimalLodIndex < rangeMin) optimalLodIndex = rangeMin;
            if (optimalLodIndex > rangeMax) optimalLodIndex = rangeMax;
            const currentLodIndex = this.nodeLods[nodeIndex];

            // Determine desired display LOD using underfill strategy within allowed range
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
                        this.nodeLods[nodeIndex] = desiredLodIndex;
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
                    this.nodeLods[nodeIndex] = -1;
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
                        this.nodeLods[nodeIndex] = desiredLodIndex;
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
                this.octree.ensureFileResource(fileIndex, this.assetLoader);
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
                this.octree.ensureFileResource(fileIndex, this.assetLoader);

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
                            this.nodeLods[nodeIndex] = newLodIndex;
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
            this.octree.ensureEnvironmentResource(this.assetLoader);
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
                    const lodIndex = this.nodeLods[nodeIndex];
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
                this.octree.ensureFileResource(fileIndex, this.assetLoader);
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
