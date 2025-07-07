/**
 * Container to store info about LOD blocks for a gsplat
 *
 * @ignore
 */
class GSplatLodBlocks {
    /**
     * Each 3 consecutive numbers represent the count of splats at level 0, 1, and 2 for a block
     *
     * @type {Uint32Array | undefined}
     */
    blocksLodInfo;

    /**
     * Each 3 consecutive numbers represent the center of the block (x, y, z)
     *
     * @type {Float32Array | undefined}
     */
    blocksCenter;

    /**
     * Number of splats per LOD block.
     *
     * @type {number}
     */
    blockSize = 4096;

    get numBlocks() {
        return this.blocksCenter ? this.blocksCenter.length / 3 : 0;
    }
}

export { GSplatLodBlocks };
