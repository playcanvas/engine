import { Vec2 } from '../../core/math/vec2.js';
import { GSplatPlacement } from './gsplat-placement.js';

/**
 * @import { GraphNode } from '../graph-node.js'
 * @import { GSplatOctree } from './gsplat-octree.js'
 * @import { GSplatManager } from './gsplat-manager.js'
 * @import { GSplatAssetLoaderBase } from './gsplat-asset-loader-base.js'
 */

// const invWorldMat = new Mat4();
// const _tempVec3 = new Vec3();

const _tempCompletedUrls = [];

class GSplatOctreeInstance {
    /** @type {GSplatOctree} */
    octree;

    /** @type {GSplatPlacement} */
    placement;

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
     * Array of reference counts per file. Index is fileIndex, value is number of nodes using this file.
     * @type {Uint32Array}
     */
    fileRefCount;

    /**
     * Set of pending file loads (file indices).
     * @type {Set<number>}
     */
    pending = new Set();

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

        // Initialize file arrays
        const numFiles = octree.files.length;
        this.filePlacements = new Array(numFiles).fill(null);
        this.fileRefCount = new Uint32Array(numFiles); // initialized to 0
    }

    /**
     * Calculate LOD index for a specific node.
     * @param {GraphNode} cameraNode - The camera node.
     * @param {number} nodeIndex - The node index.
     * @returns {number} The LOD index for this node, or -1 if node should not be rendered.
     */
    calculateNodeLod(cameraNode, nodeIndex) {
        // For now, use the same global logic - distance from camera to octree
        // Later this will be per-node based on node-specific criteria
        const worldCameraPosition = cameraNode.getPosition();
        const distance = worldCameraPosition.distance(this.placement.node.getPosition());

        if (distance > 30) {
            return -1; // Node not rendered at all
        }
        return distance < 10 ? 0 : 1;
    }

    /**
     * Updates the octree instance when LOD needs to be updated.
     *
     * @param {GraphNode} cameraNode - The camera node.
     * @param {GSplatManager} manager - The manager.
     */
    updateLod(cameraNode, manager) {
        // use the placement to transform camera position to octree space
        // const octreeWorldTransform = this.placement.node.getWorldTransform();
        // invWorldMat.copy(octreeWorldTransform).invert();
        // const octreeCameraPosition = invWorldMat.transformPoint(worldCameraPosition, _tempVec3);

        // Process all nodes in a single loop
        const nodes = this.octree.nodes;
        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            const node = nodes[nodeIndex];

            // Calculate LOD for this specific node
            const newLodIndex = this.calculateNodeLod(cameraNode, nodeIndex);
            const currentLodIndex = this.nodeLods[nodeIndex];

            // Check if LOD changed for this node
            if (newLodIndex !== currentLodIndex) {

                // Remove reference from old file
                if (currentLodIndex >= 0) {
                    const oldFileIndex = node.lods[currentLodIndex].fileIndex;
                    this.decrementFileRef(oldFileIndex, manager, nodeIndex, currentLodIndex);
                }

                // Update the stored LOD index
                this.nodeLods[nodeIndex] = newLodIndex;

                // Add reference to new file
                if (newLodIndex >= 0) {
                    const newFileIndex = node.lods[newLodIndex].fileIndex;
                    this.incrementFileRef(newFileIndex, manager, nodeIndex, newLodIndex);
                }
            }
        }
    }

    /**
     * Increments reference count for a file and creates placement immediately.
     * @param {number} fileIndex - The file index.
     * @param {GSplatManager} manager - The manager.
     * @param {number} nodeIndex - The octree node index.
     * @param {number} lodIndex - The LOD index for this node.
     */
    incrementFileRef(fileIndex, manager, nodeIndex, lodIndex) {
        const oldCount = this.fileRefCount[fileIndex];
        this.fileRefCount[fileIndex] = oldCount + 1;

        // If this is the first reference, create placement immediately
        if (oldCount === 0) {
            // Create placement (with null resource initially)
            const newPlacement = new GSplatPlacement(null, this.placement.node, true);
            this.filePlacements[fileIndex] = newPlacement;

            // Try to add to manager if resource is already loaded
            if (!this.addFilePlacement(fileIndex, manager)) {
                // Resource not loaded yet, kick off load and add to pending
                const fileUrl = this.octree.files[fileIndex];
                this.octree.ensureFileResource(fileUrl, this.assetLoader);
                this.pending.add(fileIndex);
            }
        }

        // Add interval for this node to the placement
        this.addInterval(fileIndex, nodeIndex, lodIndex);
    }

    /**
     * Decrements reference count for a file and removes placement if needed.
     * @param {number} fileIndex - The file index.
     * @param {GSplatManager} manager - The manager.
     * @param {number} nodeIndex - The octree node index.
     * @param {number} lodIndex - The LOD index for this node.
     */
    decrementFileRef(fileIndex, manager, nodeIndex, lodIndex) {
        const oldCount = this.fileRefCount[fileIndex];
        if (oldCount > 0) {
            // Remove interval for this node from the placement
            this.removeInterval(fileIndex, nodeIndex);

            this.fileRefCount[fileIndex] = oldCount - 1;

            // If this was the last reference, remove placement
            if (oldCount === 1) {
                const placement = this.filePlacements[fileIndex];
                // Only remove from manager if it was added (has resource)
                if (placement?.resource) {
                    manager.remove(placement);
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
     * @param {GSplatManager} manager - The manager.
     * @returns {boolean} True if placement was updated and added to manager, false otherwise.
     */
    addFilePlacement(fileIndex, manager) {
        const fileUrl = this.octree.files[fileIndex];
        const res = this.octree.getFileResource(fileUrl);
        if (res) {
            // Get the existing placement and update its resource
            const placement = this.filePlacements[fileIndex];
            if (placement) {
                placement.resource = res;
                manager.add(placement);
                return true;
            }
        }
        return false;
    }

    /**
     * Adds an interval for a node to the placement.
     * @param {number} fileIndex - The file index.
     * @param {number} nodeIndex - The octree node index.
     * @param {number} lodIndex - The LOD index for this node.
     */
    addInterval(fileIndex, nodeIndex, lodIndex) {
        const placement = this.filePlacements[fileIndex];
        if (placement) {
            const nodes = this.octree.nodes;
            const node = nodes[nodeIndex];
            const lod = node.lods[lodIndex];

            // Create interval as Vec2(start, end) where end = start + count - 1
            const startIndex = lod.offset;
            const endIndex = lod.offset + lod.count - 1;
            const interval = new Vec2(startIndex, endIndex);
            placement.intervals.set(nodeIndex, interval);
        }
    }

    /**
     * Removes an interval for a node from the placement.
     * @param {number} fileIndex - The file index.
     * @param {number} nodeIndex - The octree node index.
     */
    removeInterval(fileIndex, nodeIndex) {
        const placement = this.filePlacements[fileIndex];
        if (placement) {
            placement.intervals.delete(nodeIndex);
        }
    }

    /**
     * Updates the octree instance each frame.
     *
     * @param {GSplatManager} manager - The manager.
     */
    update(manager) {
        if (this.pending.size) {
            // clear temp array
            _tempCompletedUrls.length = 0;

            // collect completed pending loads to avoid modifying set during iteration
            for (const fileIndex of this.pending) {
                const fileUrl = this.octree.files[fileIndex];
                // Check if the asset has finished loading and store it if so
                this.octree.ensureFileResource(fileUrl, this.assetLoader);

                // add placement if resource is now available and still needed
                if (this.fileRefCount[fileIndex] > 0 && this.addFilePlacement(fileIndex, manager)) {
                    _tempCompletedUrls.push(fileIndex);
                }
            }

            // Remove completed items from pending
            for (const fileIndex of _tempCompletedUrls) {
                this.pending.delete(fileIndex);
            }
        }
    }
}

export { GSplatOctreeInstance };
