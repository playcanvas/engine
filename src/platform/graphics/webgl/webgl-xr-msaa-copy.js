import { PRIMITIVE_TRIANGLES, SEMANTIC_POSITION } from '../constants.js';
import { BlendState } from '../blend-state.js';
import { DepthState } from '../depth-state.js';
import { RenderTarget } from '../render-target.js';
import { Shader } from '../shader.js';
import { ShaderDefinitionUtils } from '../shader-definition-utils.js';
import { Texture } from '../texture.js';

/**
 * @import { WebglGraphicsDevice } from './webgl-graphics-device.js'
 */

const _quadPrimitive = {
    type: PRIMITIVE_TRIANGLES,
    base: 0,
    count: 6,
    indexed: true
};

const vsSrc = /* glsl */`
    attribute vec2 vertex_position;
    varying vec2 pcTexCoord;
    void main() {
        gl_Position = vec4(vertex_position, 0.0, 1.0);
        pcTexCoord = vertex_position * 0.5 + 0.5;
    }
`;

const fsSrc = /* glsl */`
    uniform sampler2D pcSource;
    varying vec2 pcTexCoord;
    void main() {
        gl_FragColor = texture2D(pcSource, pcTexCoord);
    }
`;

/**
 * Helper that resolves the MSAA color buffer into the WebXR session framebuffer on platforms where
 * direct `blitFramebuffer` into the XR opaque FBO does not work correctly (e.g. visionOS).
 *
 * The operation is two-stage:
 *  1. Resolve step: MSAA renderbuffer → engine-owned scratch `Texture` via `blitFramebuffer` (this
 *      blit is into an ordinary app-owned texture, which works on all platforms).
 *  2. A single fullscreen quad draw into the XR FBO
 *
 * The instance lives on {@link WebglGraphicsDevice} and is created lazily the first time the copy
 * is needed.
 *
 * @ignore
 */
class WebglXrMsaaCopy {
    /**
     * @type {WebglGraphicsDevice}
     * @private
     */
    _device;

    /**
     * @type {Shader|null}
     * @private
     */
    _shader = null;

    /**
     * @type {Texture|null}
     * @private
     */
    _scratchTex = null;

    /**
     * @type {RenderTarget|null}
     * @private
     */
    _scratchRt = null;

    /**
     * @type {import('../../../platform/graphics/scope-id.js').ScopeId|null}
     * @private
     */
    _sourceId = null;

    /**
     * @param {WebglGraphicsDevice} device - The WebGL graphics device.
     */
    constructor(device) {
        this._device = device;
    }

    /**
     * Returns the copy shader, creating it on first call.
     *
     * @returns {Shader} The shader.
     * @private
     */
    _getShader() {
        if (!this._shader) {
            const device = this._device;
            this._shader = new Shader(device, ShaderDefinitionUtils.createDefinition(device, {
                name: 'XrMsaaCopy',
                attributes: { vertex_position: SEMANTIC_POSITION },
                vertexCode: vsSrc,
                fragmentCode: fsSrc
            }));

            this._sourceId = device.scope.resolve('pcSource');
        }

        return this._shader;
    }

    /**
     * Ensure the scratch single-sample texture and its render target exist and match the given
     * dimensions. Reallocates if the size has changed (rare: only when XR layer resolution
     * changes).
     *
     * @param {number} width - Full SBS framebuffer width in pixels.
     * @param {number} height - Framebuffer height in pixels.
     * @private
     */
    _ensureScratch(width, height) {
        const device = this._device;

        // Destroy if the size no longer matches.
        if (this._scratchTex && (this._scratchTex.width !== width || this._scratchTex.height !== height)) {
            this._scratchRt.destroy();
            this._scratchRt = null;
            this._scratchTex.destroy();
            this._scratchTex = null;
        }

        // Create if not present.
        if (!this._scratchTex) {
            this._scratchTex = Texture.createDataTexture2D(device, 'XrMsaaScratch', width, height, device.backBufferFormat);
            this._scratchRt = new RenderTarget({
                colorBuffer: this._scratchTex,
                depth: false,
                stencil: false
            });
        }

        // Initialize the underlying GL FBO. Handles both first-time creation (a freshly
        // constructed RenderTarget has initialized === false) and context-loss restore (engine
        // restores Texture/Shader automatically, but this RT bypasses startRenderPass so its
        // FBO must be re-created explicitly here).
        if (!this._scratchRt.impl.initialized) {
            this._scratchRt.impl.init(device, this._scratchRt);
        }
    }

    /**
     * Resolve MSAA color into the XR session framebuffer via a scratch texture and a fullscreen quad.
     *
     * @param {WebGLFramebuffer} msaaReadFbo - Multisampled source framebuffer.
     * @param {WebGLFramebuffer} xrDrawFbo - XR base layer framebuffer.
     * @param {number} width - Full SBS framebuffer width in pixels.
     * @param {number} height - Framebuffer height in pixels.
     */
    copy(msaaReadFbo, xrDrawFbo, width, height) {
        this._ensureScratch(width, height);

        const device = this._device;
        const gl = device.gl;

        // 1) Resolve MSAA → scratch (ordinary app-owned texture — works on all platforms).
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msaaReadFbo);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._scratchRt.impl._glFrameBuffer);
        gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);

        // 2) Copy resolved SBS texture 1:1 into the XR FBO with a single fullscreen quad.
        device.setDrawStates(BlendState.NOBLEND, DepthState.NODEPTH);
        device.setFramebuffer(xrDrawFbo);
        device.setShader(this._getShader());
        // clearVertexBuffer() is required: setVertexBuffer() pushes onto the array rather than
        // replacing, so stale VBs from the preceding scene draw must be cleared first.
        device.clearVertexBuffer();
        device.setVertexBuffer(device.quadVertexBuffer);
        this._sourceId.setValue(this._scratchTex);

        // Save and set fullscreen viewport/scissor, then restore.
        const { vx, vy, vw, vh, sx, sy, sw, sh } = device;
        device.setViewport(0, 0, width, height);
        device.setScissor(0, 0, width, height);

        device.draw(_quadPrimitive, device.quadIndexBuffer);

        device.setViewport(vx, vy, vw, vh);
        device.setScissor(sx, sy, sw, sh);

        // Restore active framebuffer to the MSAA FBO (matches expectation of callers).
        device.setFramebuffer(msaaReadFbo);
    }

    /**
     * Destroy all GPU resources owned by this instance.
     */
    destroy() {
        this._shader?.destroy();
        this._shader = null;
        this._scratchRt?.destroy();
        this._scratchRt = null;
        this._scratchTex?.destroy();
        this._scratchTex = null;
        this._sourceId = null;
    }
}

export { WebglXrMsaaCopy };
