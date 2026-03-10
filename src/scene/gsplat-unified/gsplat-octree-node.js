import { BoundingBox } from '../../core/shape/bounding-box.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';

/**
 * @typedef {Object} GSplatOctreeNodeLod
 * @property {string} file - The file path
 * @property {number} fileIndex - The file index in the octree files array
 * @property {number} offset - The offset in the file
 * @property {number} count - The count of items
 */

const tmpMin = new Vec3();
const tmpMax = new Vec3();

class GSplatOctreeNode {
    /**
     * @type {GSplatOctreeNodeLod[]}
     */
    lods;

    /**
     * @type {BoundingBox}
     */
    bounds = new BoundingBox();

    /**
     * Precomputed bounding sphere derived from the AABB. Stored as (center.x, center.y,
     * center.z, radius) for efficient GPU frustum culling.
     *
     * @type {Vec4}
     */
    boundingSphere = new Vec4();

    /**
     * @param {GSplatOctreeNodeLod[]} lods - The LOD data for this node
     * @param {Object} [boundData] - The bounding box data with min and max arrays
     */
    constructor(lods, boundData) {
        this.lods = lods;

        // bounds
        tmpMin.set(boundData.min[0], boundData.min[1], boundData.min[2]);
        tmpMax.set(boundData.max[0], boundData.max[1], boundData.max[2]);
        this.bounds.setMinMax(tmpMin, tmpMax);

        // precompute bounding sphere from AABB
        const center = this.bounds.center;
        const he = this.bounds.halfExtents;
        const radius = Math.sqrt(he.x * he.x + he.y * he.y + he.z * he.z);
        this.boundingSphere.set(center.x, center.y, center.z, radius);
    }
}

export { GSplatOctreeNode };
