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
     * Map of nodeIndex -> oldFileIndex that needs to be decremented when current LOD loads.
     * Used to track delayed cleanup from LOD gap prevention.
     *
     * @type {Map<number, number>}
     */
    pendingDecrements = new Map();

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
     * Calculate LOD index for a specific node using pre-calculated local camera position.
     * @param {Vec3} localCameraPosition - The camera position in local space.
     * @param {number} nodeIndex - The node index.
     * @param {number} maxLod - The maximum LOD index (lodLevels - 1).
     * @returns {number} The LOD index for this node, or -1 if node should not be rendered.
     */
    calculateNodeLod(localCameraPosition, nodeIndex, maxLod) {
        const node = this.octree.nodes[nodeIndex];

        // Calculate distance in local space (no transforms needed)
        const distance = localCameraPosition.distance(node.bounds.center);

        // Distance thresholds for LOD selection
        const lodDistances = [2, 4, 6, 8, 10];

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

        // process all nodes
        const nodes = this.octree.nodes;
        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            const node = nodes[nodeIndex];

            // LOD for the node
            const newLodIndex = this.calculateNodeLod(localCameraPosition, nodeIndex, maxLod);
            const currentLodIndex = this.nodeLods[nodeIndex];

            // if LOD changed
            if (newLodIndex !== currentLodIndex) {

                // FIRST: Execute any existing pending decrement for this node
                const pendingOldFileIndex = this.pendingDecrements.get(nodeIndex);
                if (pendingOldFileIndex !== undefined) {
                    this.decrementFileRef(pendingOldFileIndex, nodeIndex);
                    this.pendingDecrements.delete(nodeIndex);
                }

                // update the stored LOD index
                this.nodeLods[nodeIndex] = newLodIndex;

                const wasVisible = currentLodIndex >= 0;
                const willBeVisible = newLodIndex >= 0;

                if (!wasVisible && willBeVisible) {

                    // becoming visible (invisible -> visible)
                    const newFileIndex = node.lods[newLodIndex].fileIndex;
                    this.incrementFileRef(newFileIndex, nodeIndex, newLodIndex);

                } else if (wasVisible && !willBeVisible) {

                    // becoming invisible (visible -> invisible)
                    const oldFileIndex = node.lods[currentLodIndex].fileIndex;
                    this.decrementFileRef(oldFileIndex, nodeIndex);

                } else if (wasVisible && willBeVisible) {

                    // switching between visible LODs (visible -> visible)
                    const newFileIndex = node.lods[newLodIndex].fileIndex;
                    const oldFileIndex = node.lods[currentLodIndex].fileIndex;

                    this.incrementFileRef(newFileIndex, nodeIndex, newLodIndex);

                    const newPlacement = this.filePlacements[newFileIndex];
                    if (newPlacement?.resource) {
                        // New LOD ready - remove old LOD immediately
                        this.decrementFileRef(oldFileIndex, nodeIndex);
                    } else {
                        // New LOD not ready - track pending decrement for when it loads
                        this.pendingDecrements.set(nodeIndex, oldFileIndex);
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

            // if resource is already loaded, allow it to be used
            if (!this.addFilePlacement(fileIndex)) {

                // resource not loaded yet, kick off load and add to pending
                const fileUrl = this.octree.files[fileIndex];
                this.octree.ensureFileResource(fileUrl, this.assetLoader);
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
                this.activePlacements.add(placement);
                this.dirtyModifiedPlacements = true;
                return true;
            }
        }
        return false;
    }

    /**
     * Tests if the octree instance has moved by more than 1 unit.
     *
     * @returns {boolean} True if the octree instance has moved by more than 1 unit, false otherwise.
     */
    testMoved() {
        const position = this.placement.node.getPosition();
        const length = position.distance(this.previousPosition);
        if (length > 1) {
            this.previousPosition.copy(position);
            return true;
        }
        return false;
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
                this.octree.ensureFileResource(fileUrl, this.assetLoader);

                // add placement if resource is now available and still needed
                const placement = this.filePlacements[fileIndex];
                if (placement && placement.intervals.size > 0 && this.addFilePlacement(fileIndex)) {
                    _tempCompletedUrls.push(fileIndex);

                    // execute pending decrements for nodes using this file
                    for (const [nodeIndex] of placement.intervals) {
                        // Execute any pending decrements for this node now that resource is loaded
                        const oldFileIndex = this.pendingDecrements.get(nodeIndex);
                        if (oldFileIndex !== undefined) {
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
