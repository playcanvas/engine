import { BoundingBox } from '../../shape/bounding-box.js';

/**
 * @class
 * @name Batch
 * @classdesc Holds information about batched mesh instances. Created in {@link BatchManager#create}.
 * @param {pc.MeshInstance[]} meshInstances - The mesh instances to be batched.
 * @param {boolean} dynamic - Whether this batch is dynamic (supports transforming mesh instances at runtime).
 * @param {number} batchGroupId - Link this batch to a specific batch group. This is done automatically with default batches.
 * @property {pc.MeshInstance[]} origMeshInstances An array of original mesh instances, from which this batch was generated.
 * @property {pc.MeshInstance} meshInstance A single combined mesh instance, the result of batching.
 * @property {pc.Model} model A handy model object.
 * @property {boolean} dynamic Whether this batch is dynamic (supports transforming mesh instances at runtime).
 * @property {number} [batchGroupId] Link this batch to a specific batch group. This is done automatically with default batches.
 */
class Batch {
    constructor(meshInstances, dynamic, batchGroupId) {
        this.origMeshInstances = meshInstances;
        this._aabb = new BoundingBox();
        this.meshInstance = null;
        this.model = null;
        this.dynamic = dynamic;
        this.batchGroupId = batchGroupId;
    }
}

export { Batch };
