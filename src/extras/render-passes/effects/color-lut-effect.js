import { Debug } from '../../../core/debug.js';
import { FILTER_LINEAR } from '../../../platform/graphics/constants.js';
import glslComposeColorLutPS from '../../../scene/shader-lib/glsl/chunks/render-pass/frag/compose/compose-color-lut.js';
import wgslComposeColorLutPS from '../../../scene/shader-lib/wgsl/chunks/render-pass/frag/compose/compose-color-lut.js';
import { CameraFrameEffect } from '../camera-frame-effect.js';
import { COMPOSESLOT_LDR } from '../constants.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../../platform/graphics/texture.js'
 */

// warns, in debug builds, when a LUT texture is not configured the way it is sampled
const validateLut = (texture, name) => {
    const required = [];
    if (texture.width !== 256 || texture.height !== 16) required.push('size: 256x16');
    if (!texture.srgb) required.push('srgb: true');
    if (texture.mipmaps) required.push('mipmaps: false');
    if (texture.minFilter !== FILTER_LINEAR) required.push('minFilter: FILTER_LINEAR');
    if (texture.magFilter !== FILTER_LINEAR) required.push('magFilter: FILTER_LINEAR');
    if (required.length) {
        Debug.warnOnce(`CameraFrame.colorLUT.${name}: texture '${texture.name ?? ''}' should be configured with: ${required.join('; ')}.`, texture);
    }
};

/**
 * The color lookup table (LUT) effect, a postprocessing technique used to apply a color
 * transformation to the image. Two LUTs are supported, which makes it easy to crossfade between two
 * graded looks.
 *
 * Applied in display-referred space, after tone mapping, and before the vignette.
 *
 * Every {@link CameraFrame} constructs and registers one, available as {@link CameraFrame#colorLUT}.
 *
 * @category Graphics
 */
class ColorLutEffect extends CameraFrameEffect {
    /**
     * The primary LUT texture. This must be a 256×16 2D "horizontal strip" texture representing
     * an unwrapped 16×16×16 3D LUT in Unreal Engine layout: 16 horizontal slices along the blue
     * axis, with each slice mapping red to the X-axis and green to the Y-axis. Note that HALD LUTs
     * (e.g. from ImageMagick) and Unity LUTs use different layouts and are not compatible. The
     * texture must be loaded with `srgb: true` (LUTs are authored in sRGB display space — the
     * Unreal / Photoshop workflow stores sRGB-encoded values indexed by sRGB-encoded coordinates),
     * `mipmaps: false` (sampled at LOD 0 only), and `minFilter: FILTER_LINEAR` /
     * `magFilter: FILTER_LINEAR` (bilinear filtering between LUT entries is required to avoid
     * visible banding). The engine emits a debug-build warning if any of these are misconfigured.
     * Defaults to null, making the effect disabled.
     *
     * @type {Texture|null}
     */
    texture = null;

    /**
     * The strength of the primary LUT, blended against the original color, 0-1 range. Defaults
     * to 1.
     *
     * @type {number}
     */
    intensity = 1;

    /**
     * The optional secondary LUT texture, same format and requirements as
     * {@link ColorLutEffect#texture}. When set, both LUTs are sampled and the two graded results
     * are crossfaded according to {@link ColorLutEffect#blend}. Defaults to null.
     *
     * @type {Texture|null}
     */
    texture2 = null;

    /**
     * The strength of the secondary LUT, blended against the original color, 0-1 range. Only
     * used when {@link ColorLutEffect#texture2} is set. Defaults to 1.
     *
     * @type {number}
     */
    intensity2 = 1;

    /**
     * Crossfade between the two graded results, 0-1 range. 0 shows only the primary LUT, 1 shows
     * only the secondary LUT, intermediate values produce a linear-space mix. Only used when
     * {@link ColorLutEffect#texture2} is set. Defaults to 0.
     *
     * @type {number}
     */
    blend = 0;

    /** @private */
    _params = new Float32Array(3);

    /**
     * The textures last validated, so each is checked once when assigned. Debug builds only.
     *
     * @private
     */
    _validated = [null, null];

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device, 'colorLut', {
            slot: COMPOSESLOT_LDR,
            glsl: glslComposeColorLutPS,
            wgsl: wgslComposeColorLutPS
        });

    }

    /**
     * Gets whether the effect contributes to the frame. It is disabled until a
     * {@link ColorLutEffect#texture} is assigned.
     *
     * @type {boolean}
     */
    get active() {
        return this.enabled && !!this.texture;
    }

    update() {
        // the secondary LUT is a variant of the shader, sampled only while assigned
        this.setDefine('COLOR_LUT2', !!this.texture2);

        Debug.call(() => {
            const textures = [this.texture, this.texture2];
            textures.forEach((texture, index) => {
                if (texture && texture !== this._validated[index]) {
                    validateLut(texture, index ? 'texture2' : 'texture');
                }
                this._validated[index] = texture;
            });
        });

        const params = this._params;
        params[0] = this.intensity;
        params[1] = this.intensity2;
        params[2] = this.blend;
        this.setUniform('colorLUTParams', params);
        this.setUniform('colorLUT', this.texture);
        if (this.texture2) {
            this.setUniform('colorLUT2', this.texture2);
        }
    }
}

export { ColorLutEffect };
