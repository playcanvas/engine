import { SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';
import glslDownsamplePS from '../../scene/shader-lib/glsl/chunks/render-pass/frag/downsample.js';
import wgslDownsamplePS from '../../scene/shader-lib/wgsl/chunks/render-pass/frag/downsample.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

/**
 * Render pass implementation of a down-sample filter.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassDownsample extends RenderPassShaderQuad {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Texture} sourceTexture - The source texture to downsample.
     * @param {object} [options] - The options for the render pass.
     * @param {boolean} [options.boxFilter] - Whether to use a box filter for downsampling.
     * @param {Texture|null} [options.premultiplyTexture] - The texture to premultiply the source texture
     * with. Only supported when boxFilter is true.
     * @param {string} [options.premultiplySrcChannel] - The source channel to premultiply.
     * @param {boolean} [options.removeInvalid] - Whether to remove invalid pixels from the output.
     * @param {boolean} [options.prefilter] - Whether to apply a soft-knee high pass to the output,
     * scaling down what sits below {@link RenderPassDownsample#prefilterThreshold}. Used by the
     * first bloom downsample to limit bloom to the brightest parts of the scene. Enabling this
     * generates a separate shader variant, so leave it off when the threshold is zero.
     */
    constructor(device, sourceTexture, options = {}) {
        super(device);
        this.sourceTexture = sourceTexture;
        this.premultiplyTexture = options.premultiplyTexture;

        /**
         * Whether the high pass is compiled into this pass' shader.
         *
         * @type {boolean}
         * @readonly
         */
        this.prefilter = options.prefilter ?? false;

        /**
         * Brightness below which the high pass scales the output down, in the units of the source
         * texture. Ignored unless the pass was created with the `prefilter` option.
         *
         * @type {number}
         */
        this.prefilterThreshold = 0;

        /**
         * Width of the quadratic transition below {@link RenderPassDownsample#prefilterThreshold}.
         *
         * @type {number}
         */
        this.prefilterKnee = 0;

        // register shader chunks
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('downsamplePS', glslDownsamplePS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('downsamplePS', wgslDownsamplePS);

        const boxFilter = options.boxFilter ?? false;
        const key = `${boxFilter ? 'Box' : ''}-${options.premultiplyTexture ? 'Premultiply' : ''}-${options.premultiplySrcChannel ?? ''}-${options.removeInvalid ? 'RemoveInvalid' : ''}-${this.prefilter ? 'Prefilter' : ''}`;

        const defines = new Map();
        if (boxFilter) defines.set('BOXFILTER', '');
        if (options.premultiplyTexture) defines.set('PREMULTIPLY', '');
        if (options.removeInvalid) defines.set('REMOVE_INVALID', '');
        if (this.prefilter) defines.set('PREFILTER', '');
        defines.set('{PREMULTIPLY_SRC_CHANNEL}', options.premultiplySrcChannel ?? 'x');

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: `DownSampleShader:${key}`,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: 'downsamplePS',
            fragmentDefines: defines
        });

        this.sourceTextureId = device.scope.resolve('sourceTexture');
        this.premultiplyTextureId = device.scope.resolve('premultiplyTexture');
        this.sourceInvResolutionId = device.scope.resolve('sourceInvResolution');
        this.sourceInvResolutionValue = new Float32Array(2);
        this.prefilterThresholdKneeId = device.scope.resolve('prefilterThresholdKnee');
        this.prefilterThresholdKneeValue = new Float32Array(2);
    }

    setSourceTexture(value) {
        this._sourceTexture = value;

        // change resize source
        this.options.resizeSource = value;
    }

    execute() {
        this.sourceTextureId.setValue(this.sourceTexture);
        if (this.premultiplyTexture) {
            this.premultiplyTextureId.setValue(this.premultiplyTexture);
        }

        this.sourceInvResolutionValue[0] = 1.0 / this.sourceTexture.width;
        this.sourceInvResolutionValue[1] = 1.0 / this.sourceTexture.height;
        this.sourceInvResolutionId.setValue(this.sourceInvResolutionValue);

        if (this.prefilter) {
            this.prefilterThresholdKneeValue[0] = this.prefilterThreshold;
            this.prefilterThresholdKneeValue[1] = this.prefilterKnee;
            this.prefilterThresholdKneeId.setValue(this.prefilterThresholdKneeValue);
        }

        super.execute();
    }
}

export { RenderPassDownsample };
