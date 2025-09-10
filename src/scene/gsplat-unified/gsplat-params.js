/**
 * Parameters for GSplat unified system.
 *
 * @category Graphics
 */
class GSplatParams {
    /**
     * Enables debug rendering of AABBs for GSplat objects. Defaults to false.
     *
     * @type {boolean}
     */
    debugAabbs = false;

    /**
     * Enables colorization by selected LOD level when rendering GSplat objects. Defaults to false.
     *
     * @type {boolean}
     */
    colorizeLod = false;

    /**
     * Distance threshold in world units to trigger LOD updates for camera and gsplat instances.
     * Defaults to 1.
     *
     * @type {number}
     */
    lodUpdateThreshold = 1;
}

export { GSplatParams };
