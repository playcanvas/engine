import { Debug } from '../../core/debug.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';

/**
 * @import { MeshInstance } from '../mesh-instance.js'
 * @import { Scene } from '../scene.js'
 */

/**
 * Holds information about batched mesh instances. Created in {@link BatchManager#create}.
 *
 * @category Graphics
 */
class Batch {
    /** @private */
    _aabb = new BoundingBox();

    /**
     * An array of original mesh instances, from which this batch was generated.
     *
     * @type {MeshInstance[]}
     */
    origMeshInstances;

    /**
     * A single combined mesh instance, the result of batching.
     *
     * @type {MeshInstance}
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
     * @param {MeshInstance[]} meshInstances - The mesh instances to be batched.
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

    /**
     * Removes the batch from the layers and destroys it.
     *
     * @param {Scene} scene - The scene.
     * @param {number[]} layers - The layers to remove the batch from.
     */
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

    /**
     * @deprecated
     * @ignore
     * @type {undefined}
     */
    get model() {
        Debug.removed('pc.Batch#model was removed. Use pc.Batch#meshInstance to access batched mesh instead.');
        return undefined;
    }
}

export { Batch };
