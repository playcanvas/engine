import { SEMANTIC_POSITION } from '../../../../platform/graphics/constants.js';
import { RenderPassShaderQuad } from '../../../../scene/graphics/render-pass-shader-quad.js';
import { ShaderUtils } from '../../../../scene/shader-lib/shader-utils.js';

/**
 * @import { FramePassLuminanceHistogram } from './frame-pass-luminance-histogram.js'
 * @import { GraphicsDevice } from '../../../../platform/graphics/graphics-device.js'
 * @import { ScopeId } from '../../../../platform/graphics/scope-id.js'
 * @import { Texture } from '../../../../platform/graphics/texture.js'
 */

/**
 * One step of measuring the luminance histogram, rendering a full screen quad with the textures and
 * the parameters it reads - see FramePassLuminanceHistogram.
 *
 * @ignore
 */
class RenderPassHistogramStep extends RenderPassShaderQuad {
    /**
     * The frame pass the step belongs to, holding the parameters.
     *
     * @type {FramePassLuminanceHistogram}
     */
    histogram;

    /**
     * The textures the pass reads, and the uniforms they are bound to.
     *
     * @type {{ scopeId: ScopeId, texture: Texture|null }[]}
     * @private
     */
    _textures = [];

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {FramePassLuminanceHistogram} histogram - The frame pass the step belongs to.
     * @param {string} name - The name of the step, which its shader is named after.
     * @param {string} chunk - The name of the fragment shader chunk.
     * @param {string} outputType - The type of the fragment shader output.
     * @param {Map<string, string>} defines - The defines of the fragment shader, the sizes it loops
     * over.
     */
    constructor(device, histogram, name, chunk, outputType, defines) {
        super(device);
        this.name = `RenderPassHistogram${name}`;
        this.histogram = histogram;

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: `LuminanceHistogramShader${name}`,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: chunk,
            fragmentDefines: defines,
            fragmentOutputTypes: outputType
        });
    }

    /**
     * Sets the texture bound to a uniform when the pass renders.
     *
     * @param {string} name - The name of the uniform.
     * @param {Texture|null} texture - The texture.
     */
    setTexture(name, texture) {
        let entry = this._textures.find(item => item.scopeId.name === name);
        if (!entry) {
            entry = { scopeId: this.device.scope.resolve(name), texture: null };
            this._textures.push(entry);
        }
        entry.texture = texture;
    }

    execute() {
        const textures = this._textures;
        for (let i = 0; i < textures.length; i++) {
            textures[i].scopeId.setValue(textures[i].texture);
        }
        this.histogram.bindParameters();
        super.execute();
    }

    destroy() {
        this._textures.length = 0;
        super.destroy();
    }
}

export { RenderPassHistogramStep };
