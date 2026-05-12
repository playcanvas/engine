/**
 * @import { XrBridge } from '../xr-bridge.js'
 * @import { GraphicsDevice } from '../graphics-device.js'
 * @import { Texture } from '../texture.js'
 */

import { Vec2 } from '../../../core/math/vec2.js';

/**
 * WebGPU graphics implementation for {@link XrBridge}.
 *
 * @ignore
 */
class WebgpuXrBridge {
    /**
     * @type {XRGPUBinding|null}
     * @private
     */
    _binding = null;

    /**
     * @type {XRProjectionLayer|null}
     * @private
     */
    _layer = null;

    /**
     * Last known immersive color buffer size in pixels (updated in {@link WebgpuXrBridge#beginFrame}).
     *
     * @type {Vec2}
     * @private
     */
    _cachedFramebufferSize = new Vec2();

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
        this._binding = null;
        this._layer = null;
        this._cachedFramebufferSize.set(0, 0);
        device.xrColorTexture = null;
        device.xrColorTextureViewFormat = null;
    }

    /**
     * @param {XRFrame} frame - Current XR frame.
     * @param {XRReferenceSpace|null} referenceSpace - Active reference space for the XR session.
     */
    beginFrame(frame, referenceSpace) {
        const device = this.xrBridge.device;

        device.xrColorTexture = null;
        device.xrColorTextureViewFormat = null;

        if (!this._binding || !this._layer || !referenceSpace) {
            return;
        }

        const pose = frame.getViewerPose(referenceSpace);
        if (!pose || !pose.views?.length) {
            return;
        }

        /** @type {XRGPUSubImage|null} */
        let firstSub = null;
        for (let i = 0; i < pose.views.length; i++) {
            try {
                const sub = this._binding.getViewSubImage(this._layer, pose.views[i]);
                // TODO: stereo / multiview WebGPU — drive per-eye color (e.g. texture-array projection layer);
                // v1 only keeps the first view for xrColorTexture (see createProjectionLayer TODO).
                if (i === 0) {
                    firstSub = sub;
                }
            } catch (e) {
                this.xrBridge._onBindingError?.(e);
                return;
            }
        }

        if (firstSub?.colorTexture) {
            device.xrColorTexture = firstSub.colorTexture;
            device.xrColorTextureViewFormat = firstSub.colorTexture.format;
            this._cachedFramebufferSize.set(firstSub.colorTexture.width, firstSub.colorTexture.height);
        }
    }

    endFrame() {
        const device = this.xrBridge.device;
        if (device) {
            device.xrColorTexture = null;
            device.xrColorTextureViewFormat = null;
        }
    }

    /**
     * @returns {any} // `XRProjectionLayer | null`; using `any` to avoid exporting WebXR GPU types in published typings.
     */
    get presentationLayer() {
        return this._layer;
    }

    /**
     * @returns {any} // `XRGPUBinding | null`; using `any` to avoid exporting WebXR GPU types in published typings.
     */
    get graphicsBinding() {
        return this._binding;
    }

    /**
     * @param {XRFrame} frame - Current XR frame.
     * @param {Vec2} out - Width in {@link Vec2#x}, height in {@link Vec2#y}.
     */
    getFramebufferSize(_frame, out) {
        const layer = this._layer;
        if (layer) {
            const lw = layer.textureWidth ?? layer.width;
            const lh = layer.textureHeight ?? layer.height;
            if (lw > 0 && lh > 0) {
                out.set(lw, lh);
                return;
            }
        }
        if (this._cachedFramebufferSize.x > 0 && this._cachedFramebufferSize.y > 0) {
            out.copy(this._cachedFramebufferSize);
            return;
        }
        out.set(0, 0);
    }

    /**
     * @param {XRFrame} frame - Current XR frame.
     * @param {XRView} xrView - WebXR view.
     * @returns {XRViewport} Viewport for this view, or zeros if unavailable.
     */
    getViewport(_frame, xrView) {
        if (this._binding && this._layer) {
            try {
                const sub = this._binding.getViewSubImage(this._layer, xrView);
                if (sub?.viewport) {
                    return sub.viewport;
                }
            } catch {
            }
        }
        return /** @type {XRViewport} */ ({ x: 0, y: 0, width: 0, height: 0 });
    }

    /**
     * @param {XRSession} session - XR session.
     * @param {object} options - Presentation options.
     * @param {number} options.framebufferScaleFactor - Resolved framebuffer scale factor.
     * @param {number} options.depthNear - Depth near plane.
     * @param {number} options.depthFar - Depth far plane.
     * @param {Function} [options.onBindingError] - Called if XRGPUBinding construction fails.
     */
    attachPresentation(session, options) {
        const XRGPUBindingCtor = globalThis.XRGPUBinding;
        if (typeof XRGPUBindingCtor === 'undefined') {
            this.xrBridge._onBindingError?.(new Error('XRGPUBinding is not available in this browser.'));
            return;
        }

        const device = this.xrBridge.device;
        const wgpu = device.wgpu;

        try {
            this._binding = new XRGPUBindingCtor(session, wgpu);
        } catch (ex) {
            this.xrBridge._onBindingError?.(ex);
            return;
        }

        const colorFormat = this._binding.getPreferredColorFormat();

        this._layer = this._binding.createProjectionLayer({
            colorFormat,
            // TODO: Support textureType 'texture-array' for stereo array layouts (multiview / per-eye slices).
            textureType: 'texture',
            scaleFactor: options.framebufferScaleFactor
        });

        session.updateRenderState({
            layers: [this._layer],
            depthNear: options.depthNear,
            depthFar: options.depthFar
        });
    }

    /**
     * Copies the XR passthrough camera image for the given XRCamera into a PlayCanvas
     * {@link Texture} using `copyTextureToTexture`. No-ops if `XRGPUBinding.getCameraImage` is
     * unavailable or returns nothing this frame.
     *
     * @param {any} xrCamera - The XR camera whose image should be copied (XRCamera from WebXR API).
     * @param {Texture} texture - Destination engine texture.
     */
    syncCameraColorTexture(xrCamera, texture) {
        if (!this._binding?.getCameraImage) {
            return;
        }

        const src = this._binding.getCameraImage(xrCamera);
        if (!src) {
            return;
        }

        const dst = texture.impl?.gpuTexture;
        if (!dst) {
            return;
        }

        const device = this.xrBridge.device;
        const encoder = device.commandEncoder;
        if (!encoder) {
            return;
        }

        const width = xrCamera.width;
        const height = xrCamera.height;

        encoder.copyTextureToTexture(
            { texture: src },
            { texture: dst },
            [width, height, 1]
        );
    }

    /**
     * Clears the WebXR WebGPU binding reference (projection layer remains until session end).
     */
    releasePresentation() {
        this._binding = null;
    }

    /**
     * Clears WebXR WebGPU binding and projection layer references and removes immersive layers from
     * the session (mirrors {@link WebglXrBridge#onGraphicsDeviceLost} clearing the base layer).
     */
    onGraphicsDeviceLost() {
        const bridge = this.xrBridge;
        const session = bridge._session;

        if (!session) {
            return;
        }

        const rs = session.renderState;
        const device = bridge.device;

        this._binding = null;
        this._layer = null;
        this._cachedFramebufferSize.set(0, 0);
        device.xrColorTexture = null;
        device.xrColorTextureViewFormat = null;

        session.updateRenderState({
            layers: [],
            depthNear: rs.depthNear,
            depthFar: rs.depthFar
        });
    }

    /**
     * Recreates WebXR WebGPU presentation after GPU restore; fires `"error"` on the bridge
     * {@link XrBridge#eventHandler} if re-attachment fails.
     */
    onGraphicsDeviceRestored() {
        const bridge = this.xrBridge;

        if (!bridge._session) {
            return;
        }

        const eventHandler = bridge.eventHandler;

        setTimeout(() => {
            if (!bridge._session) {
                return;
            }

            try {
                const rs = bridge._session.renderState;
                bridge.attachPresentation(bridge._session, {
                    framebufferScaleFactor: bridge._framebufferScaleFactor,
                    depthNear: rs.depthNear,
                    depthFar: rs.depthFar,
                    onBindingError: bridge._onBindingError
                });
            } catch (ex) {
                eventHandler.fire('error', ex);
            }
        }, 0);
    }
}

export { WebgpuXrBridge };
