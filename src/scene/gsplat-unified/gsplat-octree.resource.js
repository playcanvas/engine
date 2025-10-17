import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { GSplatOctree } from './gsplat-octree.js';

class GSplatOctreeResource {
    /** @type {BoundingBox} */
    aabb = new BoundingBox();

    /** @type {GSplatOctree} */
    octree;

    /**
     * @param {string} assetFileUrl - The file URL of the container asset.
     * @param {object} data - Parsed JSON data.
     */
    constructor(assetFileUrl, data) {
        this.octree = new GSplatOctree(assetFileUrl, data);
        this.aabb.setMinMax(new Vec3(data.tree.bound.min), new Vec3(data.tree.bound.max));
    }
}

export { GSplatOctreeResource };
