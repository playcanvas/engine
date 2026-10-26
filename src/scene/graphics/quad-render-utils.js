import { Debug } from '../../core/debug.js';
import { Vec4 } from '../../core/math/vec4.js';
import { RenderPassShaderQuad } from './render-pass-shader-quad.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { RenderTarget } from '../../platform/graphics/render-target.js'
 * @import { Shader } from '../../platform/graphics/shader.js'
 */

const _viewport = new Vec4();

/**
 * Draws a quad with a shader into a render target, covering the whole render target, or the
 * viewport rectangle. It draws immediately, outside of the frame graph: each call creates a
 * {@link RenderPassShaderQuad}, renders it, and destroys it, so it allocates on every call. This
 * suits a single draw, for example to generate a texture once. To draw a quad every frame, as part
 * of a frame, or with its own render states, use a {@link RenderPassShaderQuad} instead, which is
 * created once and reused.
 *
 * The content of the render target is loaded, and not cleared. The quad is drawn with the blend
 * state currently set on the graphics device, see {@link GraphicsDevice#setBlendState}, and
 * without depth test, face culling or stencil. The parameters of the shader are set on the scope
 * of the graphics device before the call, see {@link GraphicsDevice#scope}.
 *
 * @param {GraphicsDevice} device - The graphics device used to draw the quad.
 * @param {RenderTarget|null} target - The render target to draw into, or null to draw into the
 * back buffer.
 * @param {Shader} shader - The shader used for rendering the quad. Its vertex shader receives the
 * corners of the quad in an attribute using {@link SEMANTIC_POSITION}, which the `quadVS` shader
 * chunk implements, see {@link RenderPassShaderQuad}.
 * @param {Vec4} [rect] - The viewport rectangle of the quad, in pixels. Defaults to fullscreen:
 * `[0, 0, target.width, target.height]`.
 * @param {Vec4} [scissorRect] - The scissor rectangle of the quad, in pixels. Defaults to the
 * viewport rectangle.
 * @param {string} [name] - The render pass name used for GPU profiling and debugging. Defaults to
 * 'RenderPassQuad'.
 * @example
 * // generate a texture once, by drawing a shader into its render target
 * device.scope.resolve('uScale').setValue(4);
 * drawQuadWithShader(device, renderTarget, shader);
 * @category Graphics
 */
function drawQuadWithShader(device, target, shader, rect, scissorRect, name) {

    // a valid target or a null target (framebuffer) are supported
    Debug.assert(target !== undefined);

    const renderPass = new RenderPassShaderQuad(device);
    renderPass.name = name ?? 'RenderPassQuad';
    renderPass.shader = shader;
    renderPass.init(target);

    // the quad is drawn with the blend state currently set on the device
    renderPass.blendState = device.blendState;

    // by default render to the whole render target. The viewport is always set, as the pass uses the
    // scissor rectangle only together with it
    if (!rect) {
        rect = _viewport.set(0, 0, target ? target.width : device.width, target ? target.height : device.height);
    }
    renderPass.viewport = rect;
    renderPass.scissor = scissorRect;

    // TODO: This is a workaround for the case where post-effects are used together with multi-sampled framebuffer. Last post-effect
    // renders into multi-sampled framebuffer (render pass A), which is typically followed by further rendering to this framebuffer,
    // in a separate render pass B (e.g. rendering UI). Those two render passes need to be merged into one, as they both render into
    // the same framebuffer. The workaround here is to store multi-sampled color buffer, instead of only resolving it, which is wasted
    // memory bandwidth. Without this we end up with a black result (or just UI), as multi-sampled color buffer is never written to.
    if (device.isWebGPU && target === null && device.samples > 1) {
        renderPass.setStoreColor(true);
    }

    renderPass.render();
    renderPass.destroy();
}

export { drawQuadWithShader };
