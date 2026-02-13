import {
    PIXELFORMAT_R32U, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA16U, PIXELFORMAT_RGBA32U, PIXELFORMAT_RG32U
} from '../../platform/graphics/constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { GSplatFormat } from '../gsplat/gsplat-format.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

/**
 * Parameters for GSplat unified system.
 *
 * @category Graphics
 */
class GSplatParams {
    /**
     * @type {ShaderMaterial}
     * @private
     */
    _material = new ShaderMaterial();

    /**
     * Format descriptor for work buffer streams.
     *
     * @type {GSplatFormat}
     * @private
     */
    _format;

    /**
     * Creates a new GSplatParams instance.
     *
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        // Check device capabilities for color format - use RGBA16U fallback if RGBA16F not supported
        const colorFormat = device.getRenderableHdrFormat([PIXELFORMAT_RGBA16F]) || PIXELFORMAT_RGBA16U;

        // Work buffer textures format:
        // - dataColor (RGBA16F/RGBA16U): RGBA color with alpha
        // - dataTransformA (RGBA32U): worldCenter.xyz (3×32-bit floats as uint) + worldRotation.xy (2×16-bit halfs)
        // - dataTransformB (RG32U): worldRotation.z + worldScale.xyz (4×16-bit halfs, w derived via sqrt)
        this._format = new GSplatFormat(device, [
            { name: 'dataColor', format: colorFormat },
            { name: 'dataTransformA', format: PIXELFORMAT_RGBA32U },
            { name: 'dataTransformB', format: PIXELFORMAT_RG32U }
        ], {
            readGLSL: '#include "gsplatContainerPackedReadVS"',
            readWGSL: '#include "gsplatContainerPackedReadVS"'
        });
        this._format.allowStreamRemoval = true;
    }

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
     * Enables GPU-based sorting using compute shaders. WebGPU only.
     *
     * @type {boolean}
     * @ignore
     */
    gpuSorting = false;

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
     * @type {boolean}
     * @private
     */
    _enableIds = false;

    /**
     * Enables or disables per-component ID storage in the work buffer. When enabled, each GSplat
     * component gets a unique ID written to the work buffer. This ID is used by the picking
     * system to identify which component was picked, but is also available to custom shaders for
     * effects like highlighting, animation, or any per-component differentiation.
     *
     * @type {boolean}
     */
    set enableIds(value) {
        if (value && !this._enableIds) {
            this._enableIds = true;
            if (!this._format.getStream('pcId')) {
                this._format.addExtraStreams([
                    { name: 'pcId', format: PIXELFORMAT_R32U }
                ]);
            }
        } else if (!value && this._enableIds) {
            this._enableIds = false;
            this._format.removeExtraStreams(['pcId']);
        }
    }

    /**
     * Gets the ID storage enabled state.
     *
     * @type {boolean}
     */
    get enableIds() {
        return this._enableIds;
    }

    /**
     * @type {boolean}
     * @private
     */
    _culling = false;

    /**
     * Enables or disables GPU frustum culling. When enabled, octree nodes outside the camera
     * frustum are culled on the GPU before rendering. WebGPU only.
     *
     * @type {boolean}
     * @ignore
     */
    set culling(value) {
        if (value && !this._culling) {
            this._culling = true;
            if (!this._format.getStream('pcNodeIndex')) {
                this._format.addExtraStreams([
                    { name: 'pcNodeIndex', format: PIXELFORMAT_R32U }
                ]);
            }
        } else if (!value && this._culling) {
            this._culling = false;
            this._format.removeExtraStreams(['pcNodeIndex']);
        }
    }

    /**
     * Gets the culling enabled state.
     *
     * @type {boolean}
     * @ignore
     */
    get culling() {
        return this._culling;
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
     * @type {number}
     * @private
     */
    _splatBudget = 0;

    /**
     * Target number of splats across all GSplats in the scene. When set > 0,
     * the system adjusts LOD levels globally to stay within this budget.
     * Set to 0 to disable budget enforcement and use LOD distances only (default).
     *
     * @type {number}
     */
    set splatBudget(value) {
        if (this._splatBudget !== value) {
            this._splatBudget = value;
            this.dirty = true;
        }
    }

    /**
     * Gets the target number of splats across all GSplats in the scene.
     *
     * @type {number}
     */
    get splatBudget() {
        return this._splatBudget;
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
     * @type {Texture|null}
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

    /**
     * Enables debug colorization to visualize when spherical harmonics are evaluated.
     * When true, each update pass renders with a random color to visualize the behavior
     * of colorUpdateDistance and colorUpdateAngle thresholds. Defaults to false.
     *
     * @type {boolean}
     */
    colorizeColorUpdate = false;

    /**
     * Distance threshold in world units for triggering spherical harmonics color updates.
     * Used to control how often SH evaluation occurs based on camera translation.
     * Only affects resources with spherical harmonics data. Set to 0 to update on
     * every frame where camera moves. Defaults to 0.2.
     *
     * @type {number}
     */
    colorUpdateDistance = 0.2;

    /**
     * Angle threshold in degrees for triggering spherical harmonics color updates.
     * Used to control how often SH evaluation occurs based on camera rotation.
     * Only affects resources with spherical harmonics data. Set to 0 to update on
     * every frame where camera rotates. Defaults to 2.
     *
     * @type {number}
     */
    colorUpdateAngle = 2;

    /**
     * Scale factor applied to colorUpdateDistance for each LOD level.
     * Each LOD level multiplies the threshold by this value raised to the power of lodIndex.
     * For example, with scale=2: LOD 0 uses 1x threshold, LOD 1 uses 2x, LOD 2 uses 4x.
     * Higher values relax thresholds more aggressively for distant geometry. Defaults to 2.
     *
     * @type {number}
     */
    colorUpdateDistanceLodScale = 2;

    /**
     * Scale factor applied to colorUpdateAngle for each LOD level.
     * Each LOD level multiplies the threshold by this value raised to the power of lodIndex.
     * For example, with scale=2: LOD 0 uses 1x threshold, LOD 1 uses 2x, LOD 2 uses 4x.
     * Higher values relax thresholds more aggressively for distant geometry. Defaults to 2.
     *
     * @type {number}
     */
    colorUpdateAngleLodScale = 2;

    /**
     * Number of update ticks before unloading unused streamed resources. When a streamed resource's
     * reference count reaches zero, it enters a cooldown period before being unloaded. This allows
     * recently used data to remain in memory for quick reuse if needed again soon. Set to 0 to
     * unload immediately when unused. Defaults to 100.
     *
     * @type {number}
     */
    cooldownTicks = 100;

    /**
     * A material template that can be customized by the user. Any defines, parameters, or shader
     * chunks set on this material will be automatically applied to all GSplat components rendered
     * in unified mode. After making changes, call {@link Material#update} to for the changes to be applied
     * on the next frame.
     *
     * @type {ShaderMaterial}
     * @example
     * // Set a custom parameter on all GSplat materials
     * app.scene.gsplat.material.setParameter('alphaClip', 0.4);
     * app.scene.gsplat.material.update();
     */
    get material() {
        return this._material;
    }

    /**
     * Format descriptor for work buffer streams. Describes the textures used by the work buffer
     * for intermediate storage during unified rendering. Users can add extra streams via
     * {@link GSplatFormat#addExtraStreams} for custom per-splat data.
     *
     * @type {GSplatFormat}
     * @example
     * // Add a custom stream to store per-splat component IDs
     * app.scene.gsplat.format.addExtraStreams([{
     *     name: 'splatId',
     *     format: pc.PIXELFORMAT_R32U
     * }]);
     */
    get format() {
        return this._format;
    }

    /**
     * Called at the end of the frame to clear dirty flags.
     *
     * @ignore
     */
    frameEnd() {
        this._material.dirty = false;
        this.dirty = false;
    }
}

export { GSplatParams };
