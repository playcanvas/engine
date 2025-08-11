/**
 * @typedef {Object} GSplatOctreeNodeLod
 * @property {string} file - The file path
 * @property {number} fileIndex - The file index in the octree files array
 * @property {number} offset - The offset in the file
 * @property {number} count - The count of items
 */

class GSplatOctreeNode {
    /**
     * @type {GSplatOctreeNodeLod[]}
     */
    lods;

    constructor(lods) {
        this.lods = lods;
    }
}

export { GSplatOctreeNode };
