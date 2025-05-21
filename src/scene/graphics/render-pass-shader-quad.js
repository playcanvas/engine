import { QuadRender } from './quad-render.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { CULLFACE_NONE, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';

/**
 * @import { Shader } from '../../platform/graphics/shader.js'
 * @import { StencilParameters } from '../../platform/graphics/stencil-parameters.js'
 * @import { GraphicsDevice } from '../../../playcanvas.js';
 */

/**
 * A render pass that implements rendering a quad with a shader, and exposes controls over the
 * render state. This is typically used as a base class for render passes that render a quad with
 * a shader, but can be used directly as well by specifying a shader.
 *
 * @ignore
 */
class RenderPassShaderQuad extends RenderPass {
    /**
     * @type {Shader}
     */
    _shader = null;

    quadRender = null;

    /**
     * The cull mode to use when rendering the quad. Defaults to {@link CULLFACE_NONE}.
     */
    cullMode = CULLFACE_NONE;

    /**
     * A blend state to use when rendering the quad. Defaults to {@link BlendState.NOBLEND}.
     *
     * @type {BlendState}
     */
    blendState = BlendState.NOBLEND;

    /**
     * A depth state to use when rendering the quad. Defaults to {@link DepthState.NODEPTH}.
     *
     * @type {DepthState}
     */
    depthState = DepthState.NODEPTH;

    /**
     * Stencil parameters for front faces to use when rendering the quad. Defaults to null.
     *
     * @type {StencilParameters|null}
     */
    stencilFront = null;

    /**
     * Stencil parameters for back faces to use when rendering the quad. Defaults to null.
     *
     * @type {StencilParameters|null}
     */
    stencilBack = null;

    /**
     * Sets the shader used to render the quad.
     *
     * @type {Shader}
     * @ignore
     */
    set shader(shader) {

        // destroy old
        this.quadRender?.destroy();
        this.quadRender = null;

        // handle new
        this._shader = shader;
        if (shader) {
            this.quadRender = new QuadRender(shader);
        }
    }

    get shader() {
        return this._shader;
    }

    execute() {

        // render state
        const device = this.device;
        device.setBlendState(this.blendState);
        device.setCullMode(this.cullMode);
        device.setDepthState(this.depthState);
        device.setStencilState(this.stencilFront, this.stencilBack);

        this.quadRender.render();
    }
}

export { RenderPassShaderQuad };
