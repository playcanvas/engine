import { CULLFACE_NONE, PRIMITIVE_TRISTRIP, SEMANTIC_POSITION, TYPE_FLOAT32 } from './constants.js';
import { VertexBuffer } from './vertex-buffer.js';
import { VertexFormat } from './vertex-format.js';
import { VertexIterator } from './vertex-iterator.js';

// Draws shaded full-screen quad in a single call
let _postEffectQuadVB = null;
const _postEffectQuadDraw = {
    type: PRIMITIVE_TRISTRIP,
    base: 0,
    count: 4,
    indexed: false
};

/**
 * @function
 * @name drawQuadWithShader
 * @description Draws a screen-space quad using a specific shader. Mostly used by post-effects.
 * @param {GraphicsDevice} device - The graphics device used to draw the quad.
 * @param {RenderTarget|undefined} target - The destination render target. If undefined, target is the frame buffer.
 * @param {Shader} shader - The shader used for rendering the quad. Vertex shader should contain `attribute vec2 vertex_position`.
 * @param {Vec4} [rect] - The viewport rectangle of the quad, in pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
 * @param {Vec4} [scissorRect] - The scissor rectangle of the quad, in pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
 * @param {boolean} [useBlend] - True to enable blending. Defaults to false, disabling blending.
 */
function drawQuadWithShader(device, target, shader, rect, scissorRect, useBlend = false) {
    if (_postEffectQuadVB === null) {
        const vertexFormat = new VertexFormat(device, [{
            semantic: SEMANTIC_POSITION,
            components: 2,
            type: TYPE_FLOAT32
        }]);
        _postEffectQuadVB = new VertexBuffer(device, vertexFormat, 4);

        const iterator = new VertexIterator(_postEffectQuadVB);
        iterator.element[SEMANTIC_POSITION].set(-1.0, -1.0);
        iterator.next();
        iterator.element[SEMANTIC_POSITION].set(1.0, -1.0);
        iterator.next();
        iterator.element[SEMANTIC_POSITION].set(-1.0, 1.0);
        iterator.next();
        iterator.element[SEMANTIC_POSITION].set(1.0, 1.0);
        iterator.end();
    }

    const oldRt = device.renderTarget;
    device.setRenderTarget(target);
    device.updateBegin();

    let x, y, w, h;
    let sx, sy, sw, sh;
    if (!rect) {
        w = target ? target.width : device.width;
        h = target ? target.height : device.height;
        x = 0;
        y = 0;
    } else {
        x = rect.x;
        y = rect.y;
        w = rect.z;
        h = rect.w;
    }

    if (!scissorRect) {
        sx = x;
        sy = y;
        sw = w;
        sh = h;
    } else {
        sx = scissorRect.x;
        sy = scissorRect.y;
        sw = scissorRect.z;
        sh = scissorRect.w;
    }

    const oldVx = device.vx;
    const oldVy = device.vy;
    const oldVw = device.vw;
    const oldVh = device.vh;
    device.setViewport(x, y, w, h);
    const oldSx = device.sx;
    const oldSy = device.sy;
    const oldSw = device.sw;
    const oldSh = device.sh;
    device.setScissor(sx, sy, sw, sh);

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

    device.setVertexBuffer(_postEffectQuadVB, 0);
    device.setShader(shader);

    device.draw(_postEffectQuadDraw);

    device.setDepthTest(oldDepthTest);
    device.setDepthWrite(oldDepthWrite);
    device.setCullMode(oldCullMode);
    device.setColorWrite(oldWR, oldWG, oldWB, oldWA);

    device.updateEnd();

    device.setRenderTarget(oldRt);
    device.updateBegin();

    device.setViewport(oldVx, oldVy, oldVw, oldVh);
    device.setScissor(oldSx, oldSy, oldSw, oldSh);
}

function destroyPostEffectQuad() {
    if (_postEffectQuadVB) {
        _postEffectQuadVB.destroy();
        _postEffectQuadVB = null;
    }
}

/**
 * @function
 * @name drawTexture
 * @description Draws a texture in screen-space. Mostly used by post-effects.
 * @param {GraphicsDevice} device - The graphics device used to draw the texture.
 * @param {Texture} texture - The source texture to be drawn. Accessible as `uniform sampler2D source` in shader.
 * @param {RenderTarget} [target] - The destination render target. Defaults to the frame buffer.
 * @param {Shader} [shader] - The shader used for rendering the texture. Defaults to {@link GraphicsDevice#getCopyShader}.
 * @param {Vec4} [rect] - The viewport rectangle to use for the texture, in pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
 * @param {Vec4} [scissorRect] - The scissor rectangle to use for the texture, in pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
 * @param {boolean} [useBlend] - True to enable blending. Defaults to false, disabling blending.
 */
function drawTexture(device, texture, target, shader, rect, scissorRect, useBlend = false) {
    shader = shader || device.getCopyShader();
    device.constantTexSource.setValue(texture);
    drawQuadWithShader(device, target, shader, rect, scissorRect, useBlend);
}

export { destroyPostEffectQuad, drawQuadWithShader, drawTexture };
