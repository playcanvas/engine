import { Debug, DebugHelper } from '../../core/debug.js';
import { Vec4 } from '../../core/math/vec4.js';

import { CULLFACE_NONE } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { QuadRender } from './quad-render.js';

const _tempRect = new Vec4();

/**
 * Draws a screen-space quad using a specific shader.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device used to draw
 * the quad.
 * @param {import('../../platform/graphics/render-target.js').RenderTarget|undefined} target - The destination render
 * target. If undefined, target is the frame buffer.
 * @param {import('../../platform/graphics/shader.js').Shader} shader - The shader used for rendering the quad. Vertex
 * shader should contain `attribute vec2 vertex_position`.
 * @param {import('../../core/math/vec4.js').Vec4} [rect] - The viewport rectangle of the quad, in
 * pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
 * @param {import('../../core/math/vec4.js').Vec4} [scissorRect] - The scissor rectangle of the
 * quad, in pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
 * @param {boolean} [useBlend] - True to enable blending. Defaults to false, disabling blending.
 */
function drawQuadWithShader(device, target, shader, rect, scissorRect, useBlend = false) {

    // a valid target or a null target (framebuffer) are supported
    Debug.assert(target !== undefined);

    DebugGraphics.pushGpuMarker(device, "drawQuadWithShader");

    const oldDepthTest = device.getDepthTest();
    const oldDepthWrite = device.getDepthWrite();
    const oldCullMode = device.getCullMode();
    const oldWR = device.writeRed;
    const oldWG = device.writeGreen;
    const oldWB = device.writeBlue;
    const oldWA = device.writeAlpha;

    device.setDepthTest(false);
    device.setDepthWrite(false);
    device.setCullMode(CULLFACE_NONE);
    device.setColorWrite(true, true, true, true);
    if (!useBlend) device.setBlending(false);

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
    const renderPass = new RenderPass(device, () => {
        quad.render(rect, scissorRect);
    });
    DebugHelper.setName(renderPass, `RenderPass-drawQuadWithShader${target ? `-${target.name}` : ''}`);
    renderPass.init(target);
    renderPass.colorOps.clear = false;
    renderPass.depthStencilOps.clearDepth = false;

    // TODO: this is temporary, till the webgpu supports setDepthTest
    if (device.isWebGPU) {
        renderPass.depthStencilOps.clearDepth = true;
    }

    renderPass.render();
    quad.destroy();

    device.setDepthTest(oldDepthTest);
    device.setDepthWrite(oldDepthWrite);
    device.setCullMode(oldCullMode);
    device.setColorWrite(oldWR, oldWG, oldWB, oldWA);

    DebugGraphics.popGpuMarker(device);
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
 * @param {import('../../platform/graphics/shader.js').Shader} [shader] - The shader used for rendering the texture.
 * Defaults to {@link GraphicsDevice#getCopyShader}.
 * @param {import('../../core/math/vec4.js').Vec4} [rect] - The viewport rectangle to use for the
 * texture, in pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
 * @param {import('../../core/math/vec4.js').Vec4} [scissorRect] - The scissor rectangle to use for
 * the texture, in pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
 * @param {boolean} [useBlend] - True to enable blending. Defaults to false, disabling blending.
 */
function drawTexture(device, texture, target, shader, rect, scissorRect, useBlend = false) {
    Debug.assert(!device.isWebGPU, 'pc.drawTexture is not currently supported on WebGPU platform.');
    shader = shader || device.getCopyShader();
    device.constantTexSource.setValue(texture);
    drawQuadWithShader(device, target, shader, rect, scissorRect, useBlend);
}

export { drawQuadWithShader, drawTexture };
