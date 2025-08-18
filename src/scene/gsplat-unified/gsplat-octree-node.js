import { BoundingBox } from '../../core/shape/bounding-box.js';
import { Vec3 } from '../../core/math/vec3.js';

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
     * @param {GSplatOctreeNodeLod[]} lods - The LOD data for this node
     * @param {Object} [boundData] - The bounding box data with min and max arrays
     */
    constructor(lods, boundData) {
        this.lods = lods;

        // bounds
        tmpMin.set(boundData.min[0], boundData.min[1], boundData.min[2]);
        tmpMax.set(boundData.max[0], boundData.max[1], boundData.max[2]);
        this.bounds.setMinMax(tmpMin, tmpMax);
    }
}

export { GSplatOctreeNode };
