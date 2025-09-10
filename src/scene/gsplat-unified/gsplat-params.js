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
     * Internal dirty flag to trigger update of gsplat managers when some params change.
     *
     * @ignore
     * @type {boolean}
     */
    dirty = false;

    /**
     * @type {boolean}
     * @private
     */
    _colorizeLod = false;

    /**
     * Enables colorization by selected LOD level when rendering GSplat objects. Defaults to false.
     * Marks params dirty on change.
     *
     * @type {boolean}
     */
    set colorizeLod(value) {
        if (this._colorizeLod !== value) {
            this._colorizeLod = value;
            this.dirty = true;
        }
    }

    /**
     * Gets colorize-by-LOD flag.
     *
     * @returns {boolean} Current enabled state.
     */
    get colorizeLod() {
        return this._colorizeLod;
    }

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
     * @type {number}
     * @private
     */
    _lodBehindPenalty = 1;

    /**
     * Multiplier applied to effective distance for nodes behind the camera when determining LOD.
     * Value 1 means no penalty; higher values drop LOD faster for nodes behind the camera.
     *
     * Note: when using a penalty > 1, it often makes sense to set a positive
     * {@link GSplatParams#lodUpdateAngle} so LOD is re-evaluated on camera rotation,
     * not just translation.
     *
     * @type {number}
     */
    set lodBehindPenalty(value) {
        if (this._lodBehindPenalty !== value) {
            this._lodBehindPenalty = value;
            this.dirty = true;
        }
    }

    /**
     * Gets behind-camera LOD penalty multiplier.
     *
     * @returns {number} Current multiplier value.
     */
    get lodBehindPenalty() {
        return this._lodBehindPenalty;
    }
}

export { GSplatParams };
