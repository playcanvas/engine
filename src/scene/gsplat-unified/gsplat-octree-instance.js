import { Debug } from '../../core/debug.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { GSplatPlacement } from './gsplat-placement.js';

/**
 * @import { GraphNode } from '../graph-node.js'
 * @import { GSplatOctree } from './gsplat-octree.js'
 * @import { GSplatAssetLoaderBase } from './gsplat-asset-loader-base.js'
 */

const _invWorldMat = new Mat4();
const _localCameraPos = new Vec3();

const _tempCompletedUrls = [];

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
    }

    /**
     * Destroys this octree instance and clears internal references.
     */
    destroy() {
        this.pending.clear();
        this.pendingDecrements.clear();
        this.filePlacements.length = 0;
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
     * @param {number} nodeIndex - The node index.
     * @param {number} maxLod - The maximum LOD index (lodLevels - 1).
     * @param {number[]} lodDistances - Array of distance thresholds per LOD.
     * @returns {number} The LOD index for this node, or -1 if node should not be rendered.
     */
    calculateNodeLod(localCameraPosition, nodeIndex, maxLod, lodDistances) {
        const node = this.octree.nodes[nodeIndex];

        // Calculate distance in local space
        const distance = localCameraPosition.distance(node.bounds.center);

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
     * Updates the octree instance when LOD needs to be updated.
     *
     * @param {GraphNode} cameraNode - The camera node.
     */
    updateLod(cameraNode) {

        // transform camera position to octree local space
        const worldCameraPosition = cameraNode.getPosition();
        const octreeWorldTransform = this.placement.node.getWorldTransform();
        _invWorldMat.copy(octreeWorldTransform).invert();
        const localCameraPosition = _invWorldMat.transformPoint(worldCameraPosition, _localCameraPos);

        // calculate max LOD once for all nodes
        const maxLod = this.octree.lodLevels - 1;
        const lodDistances = this.placement.lodDistances || [5, 10, 15, 20, 25];

        // process all nodes
        const nodes = this.octree.nodes;
        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            const node = nodes[nodeIndex];

            // LOD for the node
            const newLodIndex = this.calculateNodeLod(localCameraPosition, nodeIndex, maxLod, lodDistances);
            const currentLodIndex = this.nodeLods[nodeIndex];

            // if LOD changed
            if (newLodIndex !== currentLodIndex) {

                // execute any existing pending decrement for this node
                const pendingEntry = this.pendingDecrements.get(nodeIndex);
                if (pendingEntry) {
                    this.decrementFileRef(pendingEntry.oldFileIndex, nodeIndex);
                    this.pendingDecrements.delete(nodeIndex);
                }

                // update the stored LOD index
                this.nodeLods[nodeIndex] = newLodIndex;

                // Determine visibility based on the presence of a valid file index
                const currentFileIndex = currentLodIndex >= 0 ? node.lods[currentLodIndex].fileIndex : -1;
                const newFileIndex = newLodIndex >= 0 ? node.lods[newLodIndex].fileIndex : -1;
                const wasVisible = currentFileIndex !== -1;
                const willBeVisible = newFileIndex !== -1;

                if (!wasVisible && willBeVisible) {

                    // becoming visible (invisible -> visible)
                    this.incrementFileRef(newFileIndex, nodeIndex, newLodIndex);

                } else if (wasVisible && !willBeVisible) {

                    // becoming invisible (visible -> invisible)
                    this.decrementFileRef(currentFileIndex, nodeIndex);

                } else if (wasVisible && willBeVisible) {

                    // switching between visible LODs (visible -> visible)
                    this.incrementFileRef(newFileIndex, nodeIndex, newLodIndex);

                    const newPlacement = this.filePlacements[newFileIndex];
                    if (newPlacement?.resource) {
                        // new LOD ready - remove old LOD immediately
                        this.decrementFileRef(currentFileIndex, nodeIndex);
                    } else {
                        // new LOD not ready - track pending decrement for when it loads
                        this.pendingDecrements.set(nodeIndex, { oldFileIndex: currentFileIndex, newFileIndex });
                    }
                }
            }
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
                const fileUrl = this.octree.files[fileIndex];
                this.octree.ensureFileResource(fileUrl, fileIndex, this.assetLoader);
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
        Debug.assert(placement);

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
        const fileUrl = this.octree.files[fileIndex];
        const res = this.octree.getFileResource(fileUrl);
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
     * @returns {boolean} True if octree instance is dirty, false otherwise.
     */
    update() {

        // handle pending loads
        if (this.pending.size) {
            for (const fileIndex of this.pending) {

                // check if the asset has finished loading and store it if so
                const fileUrl = this.octree.files[fileIndex];
                this.octree.ensureFileResource(fileUrl, fileIndex, this.assetLoader);

                // if resource became available, update placement and execute any pending decrements
                if (this.addFilePlacement(fileIndex)) {
                    _tempCompletedUrls.push(fileIndex);

                    // Execute any pending decrements for nodes whose tracked newFileIndex now matches
                    for (const [nodeIndex, { oldFileIndex, newFileIndex }] of this.pendingDecrements) {
                        if (newFileIndex === fileIndex) {
                            this.decrementFileRef(oldFileIndex, nodeIndex);
                            this.pendingDecrements.delete(nodeIndex);
                        }
                    }
                }
            }

            // remove completed items from pending
            for (const fileIndex of _tempCompletedUrls) {
                this.pending.delete(fileIndex);
            }

            // clear temp array
            _tempCompletedUrls.length = 0;
        }

        // check if any placements need LOD update
        const dirty = this.dirtyModifiedPlacements;
        this.dirtyModifiedPlacements = false;
        return dirty;
    }
}

export { GSplatOctreeInstance };
