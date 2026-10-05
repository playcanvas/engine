import { Color } from '../../../core/math/color.js';
import glslComposeGradingPS from '../../../scene/shader-lib/glsl/chunks/render-pass/frag/compose/compose-grading.js';
import wgslComposeGradingPS from '../../../scene/shader-lib/wgsl/chunks/render-pass/frag/compose/compose-grading.js';
import { CameraFrameEffect } from '../camera-frame-effect.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */
import { COMPOSESLOT_HDR } from '../constants.js';

/**
 * The color grading effect, a postprocessing technique used to adjust the visual tone of an image.
 * This effect modifies brightness, contrast, saturation, and overall color balance to achieve a
 * specific aesthetic or mood.
 *
 * Applied in linear HDR space, before tone mapping.
 *
 * @ignore
 */
class GradingEffect extends CameraFrameEffect {
    /**
     * Whether grading is enabled. Defaults to false.
     *
     * @type {boolean}
     */
    enabled = false;

    /**
     * The brightness of the grading effect, 0-3 range. Defaults to 1.
     *
     * @type {number}
     */
    brightness = 1;

    /**
     * The contrast of the grading effect, 0.5-1.5 range. Defaults to 1.
     *
     * @type {number}
     */
    contrast = 1;

    /**
     * The saturation of the grading effect, 0-2 range. Defaults to 1.
     *
     * @type {number}
     */
    saturation = 1;

    /**
     * The tint color of the grading effect. Defaults to white.
     *
     * @type {Color}
     */
    tint = new Color(1, 1, 1, 1);

    /** @private */
    _bcs = new Float32Array(3);

    /** @private */
    _tint = new Float32Array(3);

    /** @private */
    _bcsId;

    /** @private */
    _tintId;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device, 'grading', {
            slot: COMPOSESLOT_HDR,
            glsl: glslComposeGradingPS,
            wgsl: wgslComposeGradingPS
        });

        const { scope } = device;
        this._bcsId = scope.resolve('brightnessContrastSaturation');
        this._tintId = scope.resolve('tint');
    }

    update() {
        const bcs = this._bcs;
        bcs[0] = this.brightness;
        bcs[1] = this.contrast;
        bcs[2] = this.saturation;
        this._bcsId.setValue(bcs);

        const { tint, _tint } = this;
        _tint[0] = tint.r;
        _tint[1] = tint.g;
        _tint[2] = tint.b;
        this._tintId.setValue(_tint);
    }
}

export { GradingEffect };
