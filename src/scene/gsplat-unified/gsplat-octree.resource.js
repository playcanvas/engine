import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { GSplatOctree } from './gsplat-octree.js';

class GSplatOctreeResource {
    /** @type {BoundingBox} */
    aabb = new BoundingBox();

    /**
     * Version counter for centers array changes. Always 0 for octree resources (static).
     *
     * @type {number}
     * @ignore
     */
    centersVersion = 0;

    /** @type {GSplatOctree|null} */
    octree;

    /**
     * @param {string} assetFileUrl - The file URL of the container asset.
     * @param {object} data - Parsed JSON data.
     * @param {object} assetLoader - Asset loader instance (framework-level object).
     */
    constructor(assetFileUrl, data, assetLoader) {
        this.octree = new GSplatOctree(assetFileUrl, data);
        this.octree.assetLoader = assetLoader;
        this.aabb.setMinMax(new Vec3(data.tree.bound.min), new Vec3(data.tree.bound.max));
    }

    /**
     * Destroys the octree resource and cleans up all associated resources.
     */
    destroy() {
        this.octree?.destroy();
        this.octree = null;
    }
}

export { GSplatOctreeResource };
