import { QuadRender } from './quad-render.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { CULLFACE_NONE, FRONTFACE_CCW } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';

/**
 * @import { Shader } from '../../platform/graphics/shader.js'
 * @import { StencilParameters } from '../../platform/graphics/stencil-parameters.js'
 * @import { Vec4 } from '../../core/math/vec4.js'
 */

/**
 * A render pass which draws a quad with a shader into its render target. This is how most image
 * processing is done, such as post effects, blurs, or generating a texture, as the shader then
 * runs once for each pixel the quad covers. The pass creates the quad for its
 * {@link RenderPassShaderQuad#shader}, sets the render states, and draws the quad when it executes.
 * It can be used directly, by setting its shader, or as a base class of a pass which creates the
 * shader and sets its parameters. For a single draw, such as generating a texture once,
 * {@link drawQuadWithShader} draws a quad with a shader without setting up a pass.
 *
 * ## The shader
 *
 * The vertex shader receives the corners of the quad in an attribute using
 * {@link SEMANTIC_POSITION}. The `quadVS` shader chunk implements it, and passes the uv
 * coordinates of the quad to the fragment shader in the `uv0` varying. Create the shader with
 * {@link ShaderUtils.createShader}, with the fragment shader in both GLSL and WGSL, so the pass
 * works on both WebGL2 and WebGPU. The pass does not destroy its shader, as shaders are shared.
 *
 * ## The shader parameters
 *
 * The textures and uniforms of the shader are set on the scope of the graphics device, see
 * {@link GraphicsDevice#scope}. Resolve them once, when the pass is created, and set their values
 * in an override of {@link FramePass#execute}, right before the quad is drawn by calling
 * `super.execute()`. Other passes can set parameters with the same names, so values set earlier
 * might not be the values the quad is drawn with.
 *
 * ## Render states and the drawn area
 *
 * By default, the quad covers the whole render target, and is drawn without blending, depth test
 * or face culling, replacing what the render target contains. As the content is then not needed,
 * clearing the render target with {@link RenderPass#setClearColor} saves loading it. To combine
 * the quad with the content instead, set a {@link RenderPassShaderQuad#blendState}, and to test
 * it against the depth or the stencil of the render target, set a
 * {@link RenderPassShaderQuad#depthState} or the stencil parameters. To draw into a part of the
 * render target only, set its {@link RenderPassShaderQuad#viewport}.
 *
 * ## Drawing several quads
 *
 * To draw many quads which differ only by the data each reads for its index, such as sprites, set
 * {@link RenderPassShaderQuad#numInstances} to draw them in a single instanced draw. To draw
 * several quads with different parameters, for example one for each light, override
 * {@link FramePass#execute}, and for each quad set its parameters, or its viewport, and call
 * `super.execute()`, which draws it with the render states of the pass.
 *
 * @example
 * ```javascript
 * // A pass drawing a texture into its render target, multiplied by a color
 * class TintPass extends RenderPassShaderQuad {
 *     constructor(device, sourceTexture) {
 *         super(device);
 *         this.name = 'TintPass';
 *         this.sourceTexture = sourceTexture;
 *         this.tint = new Float32Array([1, 0.5, 0.5]);
 *
 *         this.shader = ShaderUtils.createShader(device, {
 *             uniqueName: 'TintShader',
 *             attributes: { aPosition: SEMANTIC_POSITION },
 *             vertexChunk: 'quadVS',
 *             fragmentGLSL: `
 *                 uniform sampler2D sourceTexture;
 *                 uniform vec3 tint;
 *                 varying vec2 uv0;
 *
 *                 void main() {
 *                     vec4 color = texture2D(sourceTexture, uv0);
 *                     gl_FragColor = vec4(color.rgb * tint, color.a);
 *                 }
 *             `,
 *             fragmentWGSL: `
 *                 var sourceTexture: texture_2d<f32>;
 *                 var sourceTextureSampler: sampler;
 *                 uniform tint: vec3f;
 *                 varying uv0: vec2f;
 *
 *                 @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
 *                     var output: FragmentOutput;
 *                     let color = textureSample(sourceTexture, sourceTextureSampler, input.uv0);
 *                     output.color = vec4f(color.rgb * uniform.tint, color.a);
 *                     return output;
 *                 }
 *             `
 *         });
 *
 *         // resolve the shader parameters once
 *         this.sourceTextureId = device.scope.resolve('sourceTexture');
 *         this.tintId = device.scope.resolve('tint');
 *     }
 *
 *     execute() {
 *         // set the parameters right before the quad is drawn
 *         this.sourceTextureId.setValue(this.sourceTexture);
 *         this.tintId.setValue(this.tint);
 *         super.execute();
 *     }
 * }
 *
 * const pass = new TintPass(device, sourceTexture);
 * pass.init(renderTarget);
 *
 * // the quad covers the whole render target, so clear it instead of loading its content
 * pass.setClearColor(Color.BLACK);
 * pass.render();
 * ```
 * @example
 * // Use the pass directly, to draw a shader into a 256x256 tile of a texture atlas. The atlas
 * // is loaded and not cleared, so its other tiles keep their content.
 * const pass = new RenderPassShaderQuad(device);
 * pass.name = 'AtlasTile';
 * pass.shader = tileShader;
 * pass.init(atlasRenderTarget);
 *
 * pass.viewport = new Vec4(256, 0, 256, 256);
 * pass.render();
 *
 * // blend a second shader over the same tile
 * pass.shader = overlayShader;
 * pass.blendState = BlendState.ALPHABLEND;
 * pass.render();
 *
 * pass.destroy();
 *
 * @category Graphics
 */
class RenderPassShaderQuad extends RenderPass {
    /**
     * @type {Shader|null}
     * @private
     */
    _shader = null;

    /**
     * The quad rendering the shader, created when the shader is set.
     *
     * @type {QuadRender|null}
     * @ignore
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
     * The number of instances of the quad to draw, using instanced drawing, or undefined to draw a
     * single quad without instancing. Each instance can read its index, `gl_InstanceID` in GLSL
     * and `pcInstanceIndex` in WGSL, to fetch the data of its quad, for example to place it.
     * Defaults to undefined.
     *
     * @type {number|undefined}
     */
    numInstances;

    /**
     * Sets the shader used to render the quad, or null to render nothing. The vertex shader
     * receives the quad corners in an attribute using {@link SEMANTIC_POSITION}, and the `quadVS`
     * shader chunk can be used for it.
     *
     * @type {Shader|null}
     */
    set shader(shader) {

        // keep the quad of the shader, as a pass rendering repeatedly can set it each time
        if (shader === this._shader) {
            return;
        }

        // destroy old
        this.quadRender?.destroy();
        this.quadRender = null;

        // handle new
        this._shader = shader;
        if (shader) {
            this.quadRender = new QuadRender(shader);
        }
    }

    /**
     * Gets the shader used to render the quad.
     *
     * @type {Shader|null}
     */
    get shader() {
        return this._shader;
    }

    /**
     * Releases the resources used to render the quad. The shader is not destroyed, as shaders are
     * shared, for example between passes created with the same unique name.
     */
    destroy() {
        this.shader = null;
        super.destroy();
    }

    execute() {
        const device = this.device;

        // render state
        device.setDrawStates(this.blendState, this.depthState, this.cullMode, this.frontFace, this.stencilFront, this.stencilBack);

        const quadRender = this.quadRender;
        if (quadRender) {
            DebugGraphics.pushGpuMarker(device, `${this.name}:${this._shader?.name}`);
            quadRender.render(this.viewport, this.scissor, this.numInstances);
            DebugGraphics.popGpuMarker(device);
        }
    }
}

export { RenderPassShaderQuad };
