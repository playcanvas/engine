import { BoundingBox } from '../../shape/bounding-box.js';

/**
 * @class
 * @name Batch
 * @classdesc Holds information about batched mesh instances. Created in {@link BatchManager#create}.
 * @param {MeshInstance[]} meshInstances - The mesh instances to be batched.
 * @param {boolean} dynamic - Whether this batch is dynamic (supports transforming mesh instances at runtime).
 * @param {number} batchGroupId - Link this batch to a specific batch group. This is done automatically with default batches.
 * @property {MeshInstance[]} origMeshInstances An array of original mesh instances, from which this batch was generated.
 * @property {MeshInstance} meshInstance A single combined mesh instance, the result of batching.
 * @property {boolean} dynamic Whether this batch is dynamic (supports transforming mesh instances at runtime).
 * @property {number} [batchGroupId] Link this batch to a specific batch group. This is done automatically with default batches.
 */
class Batch {
    constructor(meshInstances, dynamic, batchGroupId) {
        this.origMeshInstances = meshInstances;
        this._aabb = new BoundingBox();
        this.meshInstance = null;
        this.dynamic = dynamic;
        this.batchGroupId = batchGroupId;
    }

    // Removes the batch meshes from all layers and destroys it
    destroy(scene, layers) {
        if (this.meshInstance) {
            this.removeFromLayers(scene, layers);
            this.meshInstance.destroy();
        }
    }

    addToLayers(scene, layers) {
        for (let i = 0; i < layers.length; i++) {
            var layer = scene.layers.getLayerById(layers[i]);
            if (layer) {
                layer.addMeshInstances([this.meshInstance]);
            }
        }
    }

    removeFromLayers(scene, layers) {
        for (let i = 0; i < layers.length; i++) {
            var layer = scene.layers.getLayerById(layers[i]);
            if (layer) {
                layer.removeMeshInstances([this.meshInstance]);
            }
        }
    }

    // Updates bounding box for a batch
    updateBoundingBox() {
        this._aabb.copy(this.origMeshInstances[0].aabb);
        for (var i = 1; i < this.origMeshInstances.length; i++) {
            this._aabb.add(this.origMeshInstances[i].aabb);
        }
        this.meshInstance.aabb = this._aabb;
        this.meshInstance._aabbVer = 0;
    }
}

export { Batch };
