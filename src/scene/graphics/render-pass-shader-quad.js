import { QuadRender } from './quad-render.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { CULLFACE_NONE, FRONTFACE_CCW } from '../../platform/graphics/constants.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';

/**
 * @import { Shader } from '../../platform/graphics/shader.js'
 * @import { StencilParameters } from '../../platform/graphics/stencil-parameters.js'
 * @import { Vec4 } from '../../core/math/vec4.js'
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
     * @type {Shader|null}
     */
    _shader = null;

    /**
     * @type {QuadRender|null}
     */
    quadRender = null;

    /**
     * The cull mode to use when rendering the quad. Defaults to {@link CULLFACE_NONE}.
     */
    cullMode = CULLFACE_NONE;

    /**
     * The front face to use when rendering the quad. Defaults to {@link FRONTFACE_CCW}.
     */
    frontFace = FRONTFACE_CCW;

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
     * Optional viewport rectangle (x, y, width, height). If set, the quad renders only to this
     * region and the original viewport is restored after rendering.
     *
     * @type {Vec4|undefined}
     */
    viewport;

    /**
     * Optional scissor rectangle (x, y, width, height). If set, pixels outside this region are
     * discarded. Only used when viewport is also set. Defaults to the viewport if not specified.
     *
     * @type {Vec4|undefined}
     */
    scissor;

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
        device.setFrontFace(this.frontFace);
        device.setDepthState(this.depthState);
        device.setStencilState(this.stencilFront, this.stencilBack);

        this.quadRender?.render(this.viewport, this.scissor);
    }
}

export { RenderPassShaderQuad };
