import { BoundingBox } from '../../core/shape/bounding-box.js';
import { GSplatOctree } from './gsplat-octree.js';

class GSplatOctreeResource {
    /** @type {BoundingBox} */
    aabb = new BoundingBox();

    /** @type {GSplatOctree} */
    octree;

    constructor(data) {
        this.octree = new GSplatOctree(data);

        // handle aabb
    }
}

export { GSplatOctreeResource };
