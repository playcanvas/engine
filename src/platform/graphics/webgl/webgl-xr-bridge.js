/**
 * @import { XrBridge } from '../xr-bridge.js'
 * @import { GraphicsDevice } from '../graphics-device.js'
 * @import { Texture } from '../texture.js'
 * @import { Vec2 } from '../../../core/math/vec2.js'
 */

/**
 * WebGL graphics implementation for {@link XrBridge}.
 *
 * @ignore
 */
class WebglXrBridge {
    /**
     * @type {XRWebGLLayer|null}
     * @private
     */
    _presentationLayer = null;

    /**
     * @type {XRWebGLBinding|null}
     * @private
     */
    _graphicsBinding = null;

    /**
     * Read framebuffer used to blit the XR camera image into the engine texture.
     *
     * @type {WebGLFramebuffer|null}
     * @private
     */
    _cameraFbSource = null;

    /**
     * Draw framebuffer used to blit the XR camera image into the engine texture.
     *
     * @type {WebGLFramebuffer|null}
     * @private
     */
    _cameraFbDest = null;

    /**
     * @param {XrBridge} xrBridge - The XR bridge.
     */
    constructor(xrBridge) {
        /** @type {XrBridge} */
        this.xrBridge = xrBridge;
    }

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    destroy(device) {
        this._graphicsBinding = null;
        this._presentationLayer = null;
        this._deleteCameraFramebuffers(device);
    }

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @private
     */
    _deleteCameraFramebuffers(device) {
        if (this._cameraFbSource) {
            const gl = device.gl;
            gl.deleteFramebuffer(this._cameraFbSource);
            this._cameraFbSource = null;
            gl.deleteFramebuffer(this._cameraFbDest);
            this._cameraFbDest = null;
        }
    }

    /**
     * Sets the WebGL default framebuffer to the XR session's base layer framebuffer.
     * When there is no base layer (for example after GPU device loss), falls back to the
     * canvas framebuffer by assigning null.
     *
     * @param {XRFrame} frame - Current XR frame.
     * @param {XRReferenceSpace|null} _referenceSpace - Active XR reference space.
     */
    beginFrame(frame, _referenceSpace) {
        const baseLayer = frame.session.renderState.baseLayer;
        this.xrBridge.device.defaultFramebuffer = baseLayer ? baseLayer.framebuffer : null;
    }

    /**
     * Resets the WebGL default framebuffer to the canvas (null).
     */
    endFrame() {
        this.xrBridge.device.defaultFramebuffer = null;
    }

    /**
     * @returns {XRWebGLLayer|null} The active XR output layer, if any.
     */
    get presentationLayer() {
        return this._presentationLayer;
    }

    /**
     * @returns {XRWebGLBinding|null} The WebXR GL binding for GPU camera/depth paths, if any.
     */
    get graphicsBinding() {
        return this._graphicsBinding;
    }

    /**
     * @param {XRFrame} frame - Current XR frame.
     * @param {Vec2} out - Width in {@link Vec2#x}, height in {@link Vec2#y}.
     */
    getFramebufferSize(frame, out) {
        const baseLayer = frame.session.renderState.baseLayer;
        if (!baseLayer) {
            out.set(0, 0);
            return;
        }
        out.set(baseLayer.framebufferWidth, baseLayer.framebufferHeight);
    }

    /**
     * @param {XRFrame} frame - Current XR frame.
     * @param {XRView} xrView - WebXR view.
     * @returns {XRViewport} Viewport from the session base layer, or zeros if the base layer is unavailable.
     */
    getViewport(frame, xrView) {
        const baseLayer = frame.session.renderState.baseLayer;
        if (!baseLayer) {
            return /** @type {XRViewport} */ ({ x: 0, y: 0, width: 0, height: 0 });
        }
        return baseLayer.getViewport(xrView);
    }

    /**
     * @param {XRSession} session - XR session.
     * @param {object} options - Presentation options.
     * @param {number} options.framebufferScaleFactor - Resolved framebuffer scale factor.
     * @param {number} options.depthNear - Depth near plane.
     * @param {number} options.depthFar - Depth far plane.
     * @param {Function} [options.onBindingError] - Called if XRWebGLBinding construction fails.
     */
    attachPresentation(session, options) {
        const device = this.xrBridge.device;

        this._presentationLayer = new XRWebGLLayer(session, device.gl, {
            alpha: true,
            depth: true,
            stencil: true,
            framebufferScaleFactor: options.framebufferScaleFactor,
            antialias: false
        });

        if (window.XRWebGLBinding) {
            try {
                this._graphicsBinding = new XRWebGLBinding(session, device.gl);
            } catch (ex) {
                this.xrBridge._onBindingError?.(ex);
            }
        }

        session.updateRenderState({
            baseLayer: this._presentationLayer,
            depthNear: options.depthNear,
            depthFar: options.depthFar
        });
    }

    /**
     * Matches {@link XrManager#end} clearing {@link XrManager#graphicsBinding} only.
     */
    releasePresentation() {
        this._graphicsBinding = null;
    }

    /**
     * Copies the XR passthrough camera image for the given XRCamera into a PlayCanvas
     * {@link Texture}, with a Y-flip to match engine UV conventions. No-ops if the graphics
     * binding is unavailable or the camera image is not ready this frame.
     *
     * @param {any} xrCamera - The XR camera whose image should be copied (XRCamera from WebXR API).
     * @param {Texture} texture - Destination engine texture (must be GPU-uploaded).
     */
    syncCameraColorTexture(xrCamera, texture) {
        if (!this._graphicsBinding) {
            return;
        }

        const device = this.xrBridge.device;
        const gl = device.gl;

        const src = this._graphicsBinding.getCameraImage(xrCamera);
        if (!src) {
            return;
        }

        if (!this._cameraFbSource) {
            // create frame buffer to read from
            this._cameraFbSource = gl.createFramebuffer();

            // create frame buffer to write to
            this._cameraFbDest = gl.createFramebuffer();
        }

        const width = xrCamera.width;
        const height = xrCamera.height;

        // set frame buffer to read from
        device.setFramebuffer(this._cameraFbSource);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, src, 0);

        // set frame buffer to write to
        device.setFramebuffer(this._cameraFbDest);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture.impl._glTexture, 0);

        // bind buffers
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this._cameraFbSource);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._cameraFbDest);

        // copy buffers with flip Y
        gl.blitFramebuffer(0, height, width, 0, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }

    onGraphicsDeviceLost() {
        const session = this.xrBridge._session;

        if (!session) {
            return;
        }

        const rs = session.renderState;

        this._graphicsBinding = null;
        this._presentationLayer = null;

        // FBO handles are invalid after context loss; just null them out without calling gl.delete
        this._cameraFbSource = null;
        this._cameraFbDest = null;

        session.updateRenderState({
            baseLayer: this._presentationLayer,
            depthNear: rs.depthNear,
            depthFar: rs.depthFar
        });
    }

    /**
     * Recreates presentation after GPU restore; fires `"error"` on the bridge {@link XrBridge#eventHandler} if restore fails.
     */
    onGraphicsDeviceRestored() {
        const bridge = this.xrBridge;

        if (!bridge._session) {
            return;
        }

        const device = bridge.device;
        const eventHandler = bridge.eventHandler;

        setTimeout(() => {
            if (!bridge._session) {
                return;
            }

            device.gl.makeXRCompatible()
            .then(() => {
                if (!bridge._session) {
                    return;
                }
                const rs = bridge._session.renderState;
                bridge.attachPresentation(bridge._session, {
                    framebufferScaleFactor: bridge._framebufferScaleFactor,
                    depthNear: rs.depthNear,
                    depthFar: rs.depthFar,
                    onBindingError: bridge._onBindingError
                });
            })
            .catch((ex) => {
                eventHandler.fire('error', ex);
            });
        }, 0);
    }
}

export { WebglXrBridge };
