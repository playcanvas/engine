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
    lodUpdateDistance = 1;

    /**
     * Angle threshold in degrees to trigger LOD updates based on camera rotation. Set to 0 to
     * disable rotation-based updates. Defaults to 0.
     *
     * @type {number}
     */
    lodUpdateAngle = 0;

    /**
     * Multiplier applied to effective distance for nodes behind the camera when determining
     * LOD. Value 1 means no penalty; higher values drop LOD faster for nodes behind the camera.
     *
     * Note: when using a penalty > 1, it often makes sense to set a positive
     * {@link GSplatParams#lodUpdateAngle} so LOD is re-evaluated on camera rotation, not just
     * translation.
     *
     * @type {number}
     */
    lodBehindPenalty = 1;
}

export { GSplatParams };
