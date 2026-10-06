import glslComposeColorEnhancePS from '../../../scene/shader-lib/glsl/chunks/render-pass/frag/compose/compose-color-enhance.js';
import wgslComposeColorEnhancePS from '../../../scene/shader-lib/wgsl/chunks/render-pass/frag/compose/compose-color-enhance.js';
import { CameraFrameEffect } from '../camera-frame-effect.js';
import { COMPOSESLOT_HDR } from '../constants.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

/**
 * The color enhancement effect, a postprocessing technique that provides HDR-aware adjustments for
 * shadows, highlights, midtones, vibrance, and dehaze. Shadows and highlights allow selective
 * adjustment of dark and bright areas of the image, vibrance is a smart saturation that boosts
 * less-saturated colors more than already-saturated ones, and dehaze removes atmospheric haze to
 * increase clarity and contrast.
 *
 * Applied in linear HDR space, before tone mapping and before the color grading.
 *
 * Every {@link CameraFrame} constructs and registers one, available as
 * {@link CameraFrame#colorEnhance}.
 *
 * @category Graphics
 */
class ColorEnhanceEffect extends CameraFrameEffect {
    /**
     * Whether color enhancement is enabled. Defaults to false.
     *
     * @type {boolean}
     */
    enabled = false;

    /**
     * The shadow adjustment, -3 to 3 range. Uses an exponential curve where -3 gives 0.125x, 0
     * gives 1x, and +3 gives 8x brightness on dark areas. Defaults to 0.
     *
     * @type {number}
     */
    shadows = 0;

    /**
     * The highlight adjustment, -3 to 3 range. Uses an exponential curve where -3 gives 0.125x, 0
     * gives 1x, and +3 gives 8x brightness on bright areas. Defaults to 0.
     *
     * @type {number}
     */
    highlights = 0;

    /**
     * The vibrance (smart saturation), -1 to 1 range. Positive values boost saturation of
     * less-saturated colors more than already-saturated ones. Negative values desaturate.
     * Defaults to 0.
     *
     * @type {number}
     */
    vibrance = 0;

    /**
     * The midtone adjustment, -1 to 1 range. Positive values brighten midtones, negative values
     * darken midtones, with shadows and highlights more strongly preserved than by a linear
     * exposure change. Defaults to 0.
     *
     * @type {number}
     */
    midtones = 0;

    /**
     * The dehaze adjustment, -1 to 1 range. Positive values remove atmospheric haze, increasing
     * clarity and contrast. Negative values add a haze effect. Defaults to 0.
     *
     * @type {number}
     */
    dehaze = 0;

    /** @private */
    _params = new Float32Array(4);

    /** @private */
    _paramsId;

    /** @private */
    _midtonesId;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device, 'colorEnhance', {
            slot: COMPOSESLOT_HDR,
            glsl: glslComposeColorEnhancePS,
            wgsl: wgslComposeColorEnhancePS
        });

        const { scope } = device;
        this._paramsId = scope.resolve('colorEnhanceParams');
        this._midtonesId = scope.resolve('colorEnhanceMidtones');
    }

    update() {
        const params = this._params;
        params[0] = this.shadows;
        params[1] = this.highlights;
        params[2] = this.vibrance;
        params[3] = this.dehaze;
        this._paramsId.setValue(params);
        this._midtonesId.setValue(this.midtones);
    }
}

export { ColorEnhanceEffect };
