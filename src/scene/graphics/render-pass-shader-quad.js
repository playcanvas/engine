import { QuadRender } from "./quad-render.js";
import { BlendState } from "../../platform/graphics/blend-state.js";
import { CULLFACE_NONE, SEMANTIC_POSITION } from "../../platform/graphics/constants.js";
import { DepthState } from "../../platform/graphics/depth-state.js";
import { RenderPass } from "../../platform/graphics/render-pass.js";
import { createShaderFromCode } from "../shader-lib/utils.js";

/**
 * A render pass that implements rendering a quad with a shader, and exposes controls over the
 * render state. This is typically used as a base class for render passes that render a quad with
 * a shader, but can be used directly as well by specifying a shader.
 *
 * @ignore
 */
class RenderPassShaderQuad extends RenderPass {
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
     * @type {import('../../platform/graphics/stencil-parameters.js').StencilParameters|null}
     */
    stencilFront = null;

    /**
     * Stencil parameters for back faces to use when rendering the quad. Defaults to null.
     *
     * @type {import('../../platform/graphics/stencil-parameters.js').StencilParameters|null}
     */
    stencilBack = null;

    /**
     * A simple vertex shader used to render a quad, which requires 'vec2 aPosition' in the vertex
     * buffer, and generates uv coordinates uv0 for use in the fragment shader.
     *
     * @type {string}
     */
    static quadVertexShader = `
        attribute vec2 aPosition;
        varying vec2 uv0;
        void main(void)
        {
            gl_Position = vec4(aPosition, 0.0, 1.0);
            uv0 = getImageEffectUV((aPosition.xy + 1.0) * 0.5);
        }
    `;

    /**
     * Sets the shader used to render the quad.
     *
     * @type {import('../../platform/graphics/shader.js').Shader}
     * @ignore
     */
    set shader(shader) {

        // destroy old
        this.quadRender?.destroy();
        this.quadRender = null;
        this._shader?.destroy();

        // handle new
        this._shader = shader;
        if (shader)
            this.quadRender = new QuadRender(shader);
    }

    get shader() {
        return this._shader;
    }

    /**
     * Creates a quad shader from the supplied fragment shader code.
     *
     * @param {string} name - A name of the shader.
     * @param {string} fs - Fragment shader source code.
     * @param {object} [shaderDefinitionOptions] - Additional options that will be added to the
     * shader definition.
     * @param {boolean} [shaderDefinitionOptions.useTransformFeedback] - Whether to use transform
     * feedback. Defaults to false.
     * @param {string | string[]} [shaderDefinitionOptions.fragmentOutputTypes] - Fragment shader
     * output types, which default to vec4. Passing a string will set the output type for all color
     * attachments. Passing an array will set the output type for each color attachment.
     * @returns {object} Returns the created shader.
     */
    createQuadShader(name, fs, shaderDefinitionOptions = {}) {
        return createShaderFromCode(
            this.device,
            RenderPassShaderQuad.quadVertexShader,
            fs,
            name,
            { aPosition: SEMANTIC_POSITION },
            shaderDefinitionOptions
        );
    }

    destroy() {
        this.shader?.destroy();
        this.shader = null;
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
