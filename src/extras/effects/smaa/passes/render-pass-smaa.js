import { SEMANTIC_POSITION } from '../../../../platform/graphics/constants.js';
import { RenderPassShaderQuad } from '../../../../scene/graphics/render-pass-shader-quad.js';
import { ShaderUtils } from '../../../../scene/shader-lib/shader-utils.js';

/**
 * @import { GraphicsDevice } from '../../../../platform/graphics/graphics-device.js'
 * @import { ScopeId } from '../../../../platform/graphics/scope-id.js'
 * @import { Texture } from '../../../../platform/graphics/texture.js'
 * @import { FramePassSmaa } from './frame-pass-smaa.js'
 */

/**
 * One of the passes of SMAA, rendering a full screen quad with the textures and the parameters it
 * reads.
 *
 * @ignore
 */
class RenderPassSmaa extends RenderPassShaderQuad {
    /**
     * The frame pass the pass belongs to, holding the scene and the parameters.
     *
     * @type {FramePassSmaa}
     */
    smaa;

    /**
     * The textures the pass reads, and the uniforms they are bound to.
     *
     * @type {{ scopeId: ScopeId, texture: Texture|null }[]}
     * @private
     */
    _textures = [];

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {FramePassSmaa} smaa - The frame pass the pass belongs to.
     * @param {string} name - The name of the pass, which its shader is named after.
     * @param {string} chunk - The name of the fragment shader chunk.
     */
    constructor(device, smaa, name, chunk) {
        super(device);
        this.name = `RenderPassSmaa${name}`;
        this.smaa = smaa;
        this.shader = ShaderUtils.createShader(device, {
            uniqueName: `SmaaShader${name}`,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: chunk
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
        this.smaa.bindParameters();
        super.execute();
    }

    destroy() {
        this._textures.length = 0;
        super.destroy();
    }
}

export { RenderPassSmaa };
