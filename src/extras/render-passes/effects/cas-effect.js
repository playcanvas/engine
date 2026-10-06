import { math } from '../../../core/math/math.js';
import { PIXELFORMAT_RGBA8 } from '../../../platform/graphics/constants.js';
import glslComposeCasPS from '../../../scene/shader-lib/glsl/chunks/render-pass/frag/compose/compose-cas.js';
import wgslComposeCasPS from '../../../scene/shader-lib/wgsl/chunks/render-pass/frag/compose/compose-cas.js';
import { CameraFrameEffect } from '../camera-frame-effect.js';
import { COMPOSESLOT_SCENE } from '../constants.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

/**
 * The sharpening effect, using contrast adaptive sharpening (CAS). This can be used to increase the
 * sharpness of the rendered image, often to counteract the blurriness of the TAA effect, or of
 * rendering to a lower resolution render target.
 *
 * Applied to the scene image, ahead of the other effects.
 *
 * Every {@link CameraFrame} constructs and registers one, whose sharpness is set through
 * {@link CameraFrame#rendering}, and which is available as `cameraFrame.getEffect('cas')`.
 *
 * @category Graphics
 */
class CasEffect extends CameraFrameEffect {
    /**
     * The sharpening intensity, 0-1 range. Defaults to 0, making it disabled.
     *
     * @type {number}
     */
    sharpness = 0;

    /** @private */
    _sharpnessId;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device, 'cas', {
            slot: COMPOSESLOT_SCENE,
            glsl: glslComposeCasPS,
            wgsl: wgslComposeCasPS
        });

        this._sharpnessId = device.scope.resolve('sharpness');

        // CAS works on an LDR image; until the scene format is known, assume an HDR one
        this.setDefine('CAS_HDR', true);
    }

    /**
     * Gets whether the effect contributes to the frame. A zero sharpness disables it, the
     * sharpness being the effect's on/off control.
     *
     * @type {boolean}
     */
    get active() {
        return this.enabled && this.sharpness > 0;
    }

    frameUpdate() {
        // an HDR scene is mapped to LDR around the sharpening
        const format = this.cameraFrame?.hdrFormat;
        if (format !== undefined) {
            this.setDefine('CAS_HDR', format !== PIXELFORMAT_RGBA8);
        }
    }

    update() {
        this._sharpnessId.setValue(math.lerp(-0.125, -0.2, this.sharpness));
    }
}

export { CasEffect };
