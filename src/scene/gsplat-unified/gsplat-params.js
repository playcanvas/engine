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
     * Enables radial sorting based on distance from camera (for cubemap rendering). When false,
     * uses directional sorting along camera forward vector. Defaults to false.
     *
     * Note: Radial sorting helps reduce sorting artifacts when the camera rotates (looks around),
     * while linear sorting is better at minimizing artifacts when the camera translates (moves).
     *
     * @type {boolean}
     */
    radialSorting = false;

    /**
     * Enables debug rendering of AABBs for GSplat octree nodes. Defaults to false.
     *
     * @type {boolean}
     */
    debugNodeAabbs = false;

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
     * @type {number}
     */
    get lodBehindPenalty() {
        return this._lodBehindPenalty;
    }

    /**
     * @type {number}
     * @private
     */
    _lodRangeMin = 0;

    /**
     * Minimum allowed LOD index (inclusive). Defaults to 0.
     *
     * @type {number}
     */
    set lodRangeMin(value) {
        if (this._lodRangeMin !== value) {
            this._lodRangeMin = value;
            this.dirty = true;
        }
    }

    /**
     * Gets minimum allowed LOD index (inclusive).
     *
     * @type {number}
     */
    get lodRangeMin() {
        return this._lodRangeMin;
    }

    /**
     * @type {number}
     * @private
     */
    _lodRangeMax = 10;

    /**
     * Maximum allowed LOD index (inclusive). Defaults to 10.
     *
     * @type {number}
     */
    set lodRangeMax(value) {
        if (this._lodRangeMax !== value) {
            this._lodRangeMax = value;
            this.dirty = true;
        }
    }

    /**
     * Gets maximum allowed LOD index (inclusive).
     *
     * @type {number}
     */
    get lodRangeMax() {
        return this._lodRangeMax;
    }

    /**
     * @type {number}
     * @private
     */
    _lodUnderfillLimit = 0;

    /**
     * Maximum number of LOD levels allowed below the optimal level when the optimal data is not
     * resident in memory. The system may temporarily use a coarser LOD within this limit until the
     * optimal LOD is available. Defaults to 0, which disables fallback (always load optimal).
     * Higher values allow faster loading by using lower-quality data.
     *
     * @type {number}
     */
    set lodUnderfillLimit(value) {
        if (this._lodUnderfillLimit !== value) {
            this._lodUnderfillLimit = value;
            this.dirty = true;
        }
    }

    /**
     * Gets the maximum allowed underfill LOD range.
     *
     * @type {number}
     */
    get lodUnderfillLimit() {
        return this._lodUnderfillLimit;
    }

    /**
     * @type {import('../../platform/graphics/texture.js').Texture|null}
     * @private
     */
    _colorRamp = null;

    /**
     * Gradient texture for elevation-based coloring in overdraw visualization mode.
     * When set, enables overdraw mode with additive blending. When null, uses normal rendering.
     * Texture should be (width x 1) size. World Y coordinate (0-20 range) maps to texture U coordinate.
     * Defaults to null.
     *
     * @type {import('../../platform/graphics/texture.js').Texture|null}
     */
    set colorRamp(value) {
        if (this._colorRamp !== value) {
            this._colorRamp = value;
            this.dirty = true;
        }
    }

    /**
     * Gets the color ramp texture for overdraw visualization.
     *
     * @type {import('../../platform/graphics/texture.js').Texture|null}
     */
    get colorRamp() {
        return this._colorRamp;
    }

    /**
     * Intensity multiplier for overdraw visualization mode. Value of 1 uses alpha of 1/32,
     * allowing approximately 32 overdraws to reach full brightness with additive blending.
     * Higher values increase brightness per splat. Defaults to 1.
     *
     * @type {number}
     */
    colorRampIntensity = 1;
}

export { GSplatParams };
