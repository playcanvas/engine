import { Color } from '../../../core/math/color.js';
import { Vec3 } from '../../../core/math/vec3.js';
import glslComposeGradingPS from './glsl/compose-ps.js';
import wgslComposeGradingPS from './wgsl/compose-ps.js';
import { CameraFrameEffect } from '../../render-passes/camera-frame-effect.js';
import { COMPOSESLOT_HDR } from '../../render-passes/constants.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

/**
 * The color grading effect, a postprocessing technique used to adjust the visual tone of an image.
 * This effect modifies brightness, contrast, saturation, and overall color balance to achieve a
 * specific aesthetic or mood.
 *
 * It also includes a channel mixer, which builds each output channel from a weighted mix of the
 * red, green and blue input channels. Use it to convert to black and white with custom channel
 * weights, swap channels, or simulate color vision deficiencies. The mixer is applied first,
 * followed by the tint, brightness, saturation and contrast.
 *
 * Applied in linear HDR space, before tone mapping. As the channel mixer is linear, its result
 * does not depend on the exposure, so it works the same with {@link AutoExposureEffect}.
 *
 * Every {@link CameraFrame} constructs and registers one, available as {@link CameraFrame#grading}.
 *
 * @category Graphics
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

    /**
     * The channel mixer weights of the red output channel: how much of the red, green and blue
     * input channels it is made of, -2 to 2 range per component. Defaults to (1, 0, 0).
     *
     * @type {Vec3}
     * @example
     * // swap the red and blue channels
     * cameraFrame.grading.mixerRed.set(0, 0, 1);
     * cameraFrame.grading.mixerBlue.set(1, 0, 0);
     */
    mixerRed = new Vec3(1, 0, 0);

    /**
     * The channel mixer weights of the green output channel: how much of the red, green and blue
     * input channels it is made of, -2 to 2 range per component. Defaults to (0, 1, 0).
     *
     * @type {Vec3}
     */
    mixerGreen = new Vec3(0, 1, 0);

    /**
     * The channel mixer weights of the blue output channel: how much of the red, green and blue
     * input channels it is made of, -2 to 2 range per component. Defaults to (0, 0, 1).
     *
     * @type {Vec3}
     * @example
     * // black and white, with the same weights in all three output channels
     * const grading = cameraFrame.grading;
     * grading.mixerRed.set(0.5, 0.4, 0.1);
     * grading.mixerGreen.copy(grading.mixerRed);
     * grading.mixerBlue.copy(grading.mixerRed);
     */
    mixerBlue = new Vec3(0, 0, 1);

    /** @private */
    _bcs = new Float32Array(3);

    /** @private */
    _mixerRed = new Float32Array(3);

    /** @private */
    _mixerGreen = new Float32Array(3);

    /** @private */
    _mixerBlue = new Float32Array(3);

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device, 'grading', {
            slot: COMPOSESLOT_HDR,
            glsl: glslComposeGradingPS,
            wgsl: wgslComposeGradingPS
        });

    }

    update() {
        const bcs = this._bcs;
        bcs[0] = this.brightness;
        bcs[1] = this.contrast;
        bcs[2] = this.saturation;
        this.setUniform('brightnessContrastSaturation', bcs);

        // the tint scales each output channel of the mixer, so it is folded into its rows
        const { tint } = this;
        this._setMixerRow('gradingMixerRed', this._mixerRed, this.mixerRed, tint.r);
        this._setMixerRow('gradingMixerGreen', this._mixerGreen, this.mixerGreen, tint.g);
        this._setMixerRow('gradingMixerBlue', this._mixerBlue, this.mixerBlue, tint.b);
    }

    /**
     * @param {string} name - The name of the uniform.
     * @param {Float32Array} dst - The array holding the uniform value.
     * @param {Vec3} row - The mixer weights of the output channel.
     * @param {number} tint - The tint of the output channel.
     * @private
     */
    _setMixerRow(name, dst, row, tint) {
        dst[0] = row.x * tint;
        dst[1] = row.y * tint;
        dst[2] = row.z * tint;
        this.setUniform(name, dst);
    }
}

export { GradingEffect };
