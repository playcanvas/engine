import glslComposeFringingPS from '../../../scene/shader-lib/glsl/chunks/render-pass/frag/compose/compose-fringing.js';
import wgslComposeFringingPS from '../../../scene/shader-lib/wgsl/chunks/render-pass/frag/compose/compose-fringing.js';
import { CameraFrameEffect } from '../camera-frame-effect.js';
import { COMPOSESLOT_SCENE } from '../constants.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

/**
 * The fringing effect, a chromatic aberration phenomenon where the red, green, and blue color
 * channels diverge increasingly with greater distance from the center of the screen.
 *
 * Applied to the scene image, ahead of the other effects, so that they act on the separated
 * channels.
 *
 * Every {@link CameraFrame} constructs and registers one, available as {@link CameraFrame#fringing}.
 *
 * @category Graphics
 */
class FringingEffect extends CameraFrameEffect {
    /**
     * The intensity of the fringing effect, 0-100 range. Defaults to 0, making it disabled.
     *
     * @type {number}
     */
    intensity = 0;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device, 'fringing', {
            slot: COMPOSESLOT_SCENE,
            glsl: glslComposeFringingPS,
            wgsl: wgslComposeFringingPS
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
        // relative to a fixed texture resolution, so the separation is the same at any resolution
        this.setUniform('fringingIntensity', this.intensity / 1024);
    }
}

export { FringingEffect };
