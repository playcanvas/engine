import { Color } from '../../../core/math/color.js';
import glslComposeVignettePS from '../../../scene/shader-lib/glsl/chunks/render-pass/frag/compose/compose-vignette.js';
import wgslComposeVignettePS from '../../../scene/shader-lib/wgsl/chunks/render-pass/frag/compose/compose-vignette.js';
import { CameraFrameEffect } from '../camera-frame-effect.js';
import { COMPOSESLOT_LDR } from '../constants.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

/**
 * The vignette effect, a postprocessing technique that darkens the image edges, creating a gradual
 * falloff in brightness from the center outward. The effect can be also reversed, making the center
 * of the image darker than the edges, by specifying the outer distance smaller than the inner
 * distance.
 *
 * Applied in display-referred space, after tone mapping, so that the vignette colour is reached
 * exactly regardless of the tone mapping in use.
 *
 * Every {@link CameraFrame} constructs and registers one, available as {@link CameraFrame#vignette}.
 *
 * @category Graphics
 */
class VignetteEffect extends CameraFrameEffect {
    /**
     * The intensity of the vignette effect, 0-1 range. Defaults to 0, making it disabled.
     *
     * @type {number}
     */
    intensity = 0;

    /**
     * The inner distance of the vignette effect measured from the center of the screen, 0-3 range.
     * This is where the vignette effect starts. Value larger than 1 represents the value off
     * screen, which allows more control. Defaults to 0.5, representing half the distance from
     * center.
     *
     * @type {number}
     */
    inner = 0.5;

    /**
     * The outer distance of the vignette effect measured from the center of the screen, 0-3 range.
     * This is where the vignette reaches full intensity. Value larger than 1 represents the value
     * off screen, which allows more control. Defaults to 1, representing the full screen.
     *
     * @type {number}
     */
    outer = 1;

    /**
     * The curvature of the vignette effect, 0.01-10 range. The vignette is rendered using a
     * rectangle with rounded corners, and this parameter controls the curvature of the corners.
     * Value of 1 represents a circle. Smaller values make the corners more square, while larger
     * values make them more rounded. Defaults to 0.5.
     *
     * @type {number}
     */
    curvature = 0.5;

    /**
     * The color of the vignette effect. Defaults to black.
     *
     * @type {Color}
     */
    color = new Color(0, 0, 0);

    /** @private */
    _params = new Float32Array(4);

    /** @private */
    _color = new Float32Array(3);

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device, 'vignette', {
            slot: COMPOSESLOT_LDR,
            glsl: glslComposeVignettePS,
            wgsl: wgslComposeVignettePS,
            debugViews: ['vignette']
        });

    }

    /**
     * Gets whether the effect contributes to the frame. A zero intensity disables it, the
     * intensity being the effect's on/off control.
     *
     * @type {boolean}
     */
    get active() {
        return this.enabled && this.intensity > 0;
    }

    update() {
        const params = this._params;
        params[0] = this.inner;
        params[1] = this.outer;
        params[2] = this.curvature;
        params[3] = this.intensity;
        this.setUniform('vignetterParams', params);

        const { color, _color } = this;
        _color[0] = color.r;
        _color[1] = color.g;
        _color[2] = color.b;
        this.setUniform('vignetteColor', _color);
    }
}

export { VignetteEffect };
