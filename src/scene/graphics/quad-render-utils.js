import { Debug } from '../../core/debug.js';
import { Vec4 } from '../../core/math/vec4.js';

import { QuadRender } from './quad-render.js';
import { RenderPassQuad } from './render-pass-quad.js';

const _tempRect = new Vec4();

/**
 * Draws a screen-space quad using a specific shader.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device used to draw
 * the quad.
 * @param {import('../../platform/graphics/render-target.js').RenderTarget|null} target - The destination render
 * target. If undefined, target is the frame buffer.
 * @param {import('../../platform/graphics/shader.js').Shader} shader - The shader used for rendering the quad. Vertex
 * shader should contain `attribute vec2 vertex_position`.
 * @param {import('../../core/math/vec4.js').Vec4} [rect] - The viewport rectangle of the quad, in
 * pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
 * @param {import('../../core/math/vec4.js').Vec4} [scissorRect] - The scissor rectangle of the
 * quad, in pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
 * @category Graphics
 */
function drawQuadWithShader(device, target, shader, rect, scissorRect) {

    // a valid target or a null target (framebuffer) are supported
    Debug.assert(target !== undefined);

    const useBlend = arguments[5];
    Debug.call(() => {
        if (useBlend !== undefined) {
            Debug.warnOnce('pc.drawQuadWithShader no longer accepts useBlend parameter, and blending state needs to be set up using GraphicsDevice.setBlendState.');
        }
    });

    // prepare the quad for rendering with the shader
    const quad = new QuadRender(shader);

    // by default render to the whole render target
    if (!rect) {
        rect = _tempRect;
        rect.x = 0;
        rect.y = 0;
        rect.z = target ? target.width : device.width;
        rect.w = target ? target.height : device.height;
    }

    // prepare a render pass to render the quad to the render target
    const renderPass = new RenderPassQuad(device, quad, rect, scissorRect);
    renderPass.init(target);
    renderPass.colorOps.clear = false;
    renderPass.depthStencilOps.clearDepth = false;

    // TODO: This is a workaround for the case where post-effects are used together with multi-sampled framebuffer. Last post-effect
    // renders into multi-sampled framebuffer (render pass A), which is typically followed by further rendering to this framebuffer,
    // in a separate render pass B (e.g. rendering UI). Those two render passes need to be merged into one, as they both render into
    // the same framebuffer. The workaround here is to store multi-sampled color buffer, instead of only resolving it, which is wasted
    // memory bandwidth. Without this we end up with a black result (or just UI), as multi-sampled color buffer is never written to.
    if (device.isWebGPU && target === null && device.samples > 1) {
        renderPass.colorOps.store = true;
    }

    renderPass.render();

    quad.destroy();
}

/**
 * Draws a texture in screen-space. Mostly used by post-effects.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device used to draw
 * the texture.
 * @param {import('../../platform/graphics/texture.js').Texture} texture - The source texture to be drawn. Accessible as
 * `uniform sampler2D * source` in shader.
 * @param {import('../../platform/graphics/render-target.js').RenderTarget} [target] - The destination render target.
 * Defaults to the frame buffer.
 * @param {import('../../platform/graphics/shader.js').Shader} [shader] - The optional custom shader used for rendering the texture.
 * @param {import('../../core/math/vec4.js').Vec4} [rect] - The viewport rectangle to use for the
 * texture, in pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
 * @param {import('../../core/math/vec4.js').Vec4} [scissorRect] - The scissor rectangle to use for
 * the texture, in pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
 * @category Graphics
 */
function drawTexture(device, texture, target, shader, rect, scissorRect) {
    Debug.assert(!device.isWebGPU, 'pc.drawTexture is not currently supported on WebGPU platform.');

    const useBlend = arguments[6];
    Debug.call(() => {
        if (useBlend !== undefined) {
            Debug.warnOnce('pc.drawTexture no longer accepts useBlend parameter, and blending state needs to be set up using GraphicsDevice.setBlendState.');
        }
    });

    shader = shader || device.getCopyShader();
    device.constantTexSource.setValue(texture);
    drawQuadWithShader(device, target, shader, rect, scissorRect);
}

export { drawQuadWithShader, drawTexture };
