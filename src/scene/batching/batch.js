import { BoundingBox } from '../../core/shape/bounding-box.js';

/**
 * Holds information about batched mesh instances. Created in {@link BatchManager#create}.
 */
class Batch {
    /** @private */
    _aabb = new BoundingBox();

    /**
     * An array of original mesh instances, from which this batch was generated.
     *
     * @type {import('../mesh-instance.js').MeshInstance[]}
     */
    origMeshInstances;

    /**
     * A single combined mesh instance, the result of batching.
     *
     * @type {import('../mesh-instance.js').MeshInstance}
     */
    meshInstance = null;

    /**
     * Whether this batch is dynamic (supports transforming mesh instances at runtime).
     *
     * @type {boolean}
     */
    dynamic;

    /**
     * Link this batch to a specific batch group. This is done automatically with default batches.
     *
     * @type {number}
     */
    batchGroupId;

    /**
     * Create a new Batch instance.
     *
     * @param {import('../mesh-instance.js').MeshInstance[]} meshInstances - The mesh instances to
     * be batched.
     * @param {boolean} dynamic - Whether this batch is dynamic (supports transforming mesh
     * instances at runtime).
     * @param {number} batchGroupId - Link this batch to a specific batch group. This is done
     * automatically with default batches.
     */
    constructor(meshInstances, dynamic, batchGroupId) {
        this.origMeshInstances = meshInstances;
        this.dynamic = dynamic;
        this.batchGroupId = batchGroupId;
    }

    // Removes the batch meshes from all layers and destroys it
    destroy(scene, layers) {
        if (this.meshInstance) {
            this.removeFromLayers(scene, layers);
            this.meshInstance.destroy();
            this.meshInstance = null;
        }
    }

    addToLayers(scene, layers) {
        for (let i = 0; i < layers.length; i++) {
            const layer = scene.layers.getLayerById(layers[i]);
            if (layer) {
                layer.addMeshInstances([this.meshInstance]);
            }
        }
    }

    removeFromLayers(scene, layers) {
        for (let i = 0; i < layers.length; i++) {
            const layer = scene.layers.getLayerById(layers[i]);
            if (layer) {
                layer.removeMeshInstances([this.meshInstance]);
            }
        }
    }

    // Updates bounding box for a batch
    updateBoundingBox() {
        this._aabb.copy(this.origMeshInstances[0].aabb);
        for (let i = 1; i < this.origMeshInstances.length; i++) {
            this._aabb.add(this.origMeshInstances[i].aabb);
        }
        this.meshInstance.aabb = this._aabb;
        this.meshInstance._aabbVer = 0;
    }
}

export { Batch };
