import { Vec4 } from '../../core/math/vec4.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { drawQuadWithShader } from './quad-render-utils.js';

const _viewport = new Vec4();

/**
 * Base class for all post effects. Post effects take a a render target as input apply effects to
 * it and then render the result to an output render target or the screen if no output is
 * specified.
 */
class PostEffect {
    /**
     * Create a new PostEffect instance.
     *
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice -
     * The graphics device of the application.
     */
    constructor(graphicsDevice) {
        /**
         * The graphics device of the application.
         *
         * @type {import('../../platform/graphics/graphics-device.js').GraphicsDevice}
         */
        this.device = graphicsDevice;

        /**
         * The property that should to be set to `true` (by the custom post effect) if a depth map
         * is necessary (default is false).
         *
         * @type {boolean}
         */
        this.needsDepthBuffer = false;
    }

    /**
     * A simple vertex shader used to render a quad, which requires 'vec2 aPosition' in the vertex
     * buffer, and generates uv coordinates vUv0 for use in the fragment shader.
     *
     * @type {string}
     */
    static quadVertexShader = `
        attribute vec2 aPosition;
        varying vec2 vUv0;
        void main(void)
        {
            gl_Position = vec4(aPosition, 0.0, 1.0);
            vUv0 = getImageEffectUV((aPosition.xy + 1.0) * 0.5);
        }
    `;

    /**
     * Render the post effect using the specified inputTarget to the specified outputTarget.
     *
     * @param {import('../../platform/graphics/render-target.js').RenderTarget} inputTarget - The
     * input render target.
     * @param {import('../../platform/graphics/render-target.js').RenderTarget} outputTarget - The
     * output render target. If null then this will be the screen.
     * @param {import('../../core/math/vec4.js').Vec4} [rect] - The rect of the current camera. If
     * not specified, it will default to [0, 0, 1, 1].
     */
    render(inputTarget, outputTarget, rect) {
    }

    /**
     * Draw a screen-space rectangle in a render target, using a specified shader.
     *
     * @param {import('../../platform/graphics/render-target.js').RenderTarget} target - The output
     * render target.
     * @param {import('../../platform/graphics/shader.js').Shader} shader - The shader to be used for
     * drawing the rectangle.
     * @param {import('../../core/math/vec4.js').Vec4} [rect] - The normalized screen-space position
     * (rect.x, rect.y) and size (rect.z, rect.w) of the rectangle. Default is [0, 0, 1, 1].
     */
    drawQuad(target, shader, rect) {
        let viewport;
        if (rect) {
            // convert rect in normalized space to viewport in pixel space
            const w = target ? target.width : this.device.width;
            const h = target ? target.height : this.device.height;
            viewport = _viewport.set(rect.x * w, rect.y * h, rect.z * w, rect.w * h);
        }

        this.device.setBlendState(BlendState.DEFAULT);
        drawQuadWithShader(this.device, target, shader, viewport);
    }
}

export { PostEffect };
