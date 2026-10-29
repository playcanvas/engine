/**
 * @import { XrBridge } from '../xr-bridge.js'
 * @import { GraphicsDevice } from '../graphics-device.js'
 * @import { Texture } from '../texture.js'
 */

import { Debug, DebugHelper } from '../../../core/debug.js';
import { Vec2 } from '../../../core/math/vec2.js';

// how many frames in a row that cannot acquire a texture pass between attempts to make the
// projection layer again, after the first: about a second at a headset's frame rate
const LAYER_RETRY_FRAMES = 60;

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
     * The number of frames in a row that could not acquire a texture from the projection layer. The
     * layer is made again on the second of them, so a single failure does not make it again, and
     * then every LAYER_RETRY_FRAMES while they go on failing, until a frame acquires one.
     *
     * @type {number}
     * @private
     */
    _acquireFailures = 0;

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
        this._acquireFailures = 0;
        this._cachedFramebufferSize.set(0, 0);
        device._clearXrState();
    }

    /**
     * @param {XRFrame} frame - Current XR frame.
     * @param {XRReferenceSpace|null} referenceSpace - Active reference space for the XR session.
     */
    beginFrame(frame, referenceSpace) {
        const device = this.xrBridge.device;

        device._clearXrState();

        if (!this._binding || !this._layer || !referenceSpace) {
            return;
        }

        const pose = frame.getViewerPose(referenceSpace);
        if (!pose || !pose.views?.length) {
            return;
        }

        const subImages = device.xrSubImages;
        for (let i = 0; i < pose.views.length; i++) {
            let sub;
            try {
                sub = this._binding.getViewSubImage(this._layer, pose.views[i]);
            } catch (e) {
                this.xrBridge._onBindingError?.(e);
                // A runtime can lose the projection layer's textures, after which every
                // getViewSubImage fails to acquire one and nothing reaches the display: the Quest
                // Browser does when the headset sleeps and wakes. Once a second frame in a row fails,
                // a new binding and layer, as after a lost device, take effect from the next frame;
                // while they go on failing, or cannot be made, they are made again about once a
                // second rather than every frame.
                const failures = ++this._acquireFailures;
                if (failures === 2 || (failures > 2 && (failures - 2) % LAYER_RETRY_FRAMES === 0)) {
                    this._recreatePresentation();
                }
                return;
            }

            const colorTexture = sub?.colorTexture;
            if (!colorTexture) continue;

            // pull the per-view GPUTextureViewDescriptor from the sub-image when available; this is
            // required when the runtime returns a layered texture (texture-array) for stereo so each
            // eye binds the right slice
            let viewDescriptor = null;
            if (typeof sub.getViewDescriptor === 'function') {
                try {
                    const desc = sub.getViewDescriptor();
                    if (desc) {
                        viewDescriptor = { ...desc };
                    }
                } catch (e) {
                    // descriptor optional - fall through to default view
                }
            }

            // Workaround for Safari on visionOS (https://bugs.webkit.org/show_bug.cgi?id=327533):
            // the layer is created without a depthStencilFormat, so per the WebXR/WebGPU binding
            // spec it should have no depth texture and ignoreDepthValues should be true, and any
            // depth texture should be cleared to 1.0 every frame by the user agent. Safari hands
            // out a depth texture it does not clear, and its compositor reads it to reproject a
            // frame that misses its display time, so the engine clears it to the far plane. A
            // runtime that follows the spec provides no depth texture, so this does nothing there.
            // Remove once Safari is fixed.
            const depthTexture = sub.depthStencilTexture;
            if (depthTexture) {
                this._clearDepth(depthTexture, viewDescriptor?.baseArrayLayer ?? 0);
            }

            // Prefer the view descriptor's format when present: WebXR runtimes may use it to
            // declare a per-eye view-format (e.g. bgra8unorm-srgb over a bgra8unorm texture) so
            // shader writes are gamma-encoded for the compositor. Falling back to the texture's
            // own format would silently drop that reinterpretation.
            subImages.push({
                colorTexture,
                viewDescriptor,
                viewport: sub.viewport,
                viewFormat: viewDescriptor?.format ?? colorTexture.format
            });
        }

        // First view: seeds device.xr* for WebGPU frameStart (runs before per-eye rendering) and
        // caches texture size for getFramebufferSize when the projection layer omits dimensions.
        const first = subImages[0];
        if (first) {
            this._acquireFailures = 0;
            device.xrColorTexture = first.colorTexture;
            device.xrColorTextureViewFormat = first.viewFormat;
            // align the engine-level backbuffer format with the runtime's projection-layer format so
            // sRGB / gamma decisions (RenderTarget#isColorBufferSrgb) and scene color-grab match what
            // we actually render into; device._clearXrState reverts it to the canvas format at the
            // start of the next beginFrame and on session teardown
            device.setXrBackBufferFormat(first.viewFormat);
            this._cachedFramebufferSize.set(first.colorTexture.width, first.colorTexture.height);
        }
    }

    /**
     * Makes the WebXR WebGPU binding and projection layer again for the current session, with the
     * session's own framebuffer scale and the lost layer's fixed foveation, and destroys the lost
     * layer. The depth range is left as it is, as one changed earlier in the frame is not yet in
     * the session's render state. Reports, rather than throws, a failure to make them, which keeps
     * the lost binding and layer.
     *
     * @private
     */
    _recreatePresentation() {
        const bridge = this.xrBridge;
        const session = bridge._session;
        if (!session) {
            return;
        }

        const lost = this._layer;
        try {
            bridge.attachPresentation(session, {
                framebufferScaleFactor: bridge._framebufferScaleFactor,
                onBindingError: bridge._onBindingError
            });
        } catch (ex) {
            // this runs inside the XR frame, which an exception would abandon
            bridge._onBindingError?.(ex);
            return;
        }

        const layer = this._layer;
        if (layer !== lost) {
            // keep the fixed foveation the application set on the lost layer
            if ((lost.fixedFoveation ?? null) !== null && (layer.fixedFoveation ?? null) !== null) {
                layer.fixedFoveation = lost.fixedFoveation;
            }

            // free the lost layer's textures now rather than once it is garbage collected
            lost.destroy?.();
        }
    }

    /**
     * Clears an array layer of a view's depth texture to the far plane, along with its stencil if
     * it has one.
     *
     * @param {GPUTexture} texture - The view's depth texture.
     * @param {number} baseArrayLayer - The array layer of the view.
     * @private
     */
    _clearDepth(texture, baseArrayLayer) {
        /** @type {GPURenderPassDepthStencilAttachment} */
        const attachment = {
            view: texture.createView({
                dimension: '2d',
                baseMipLevel: 0,
                mipLevelCount: 1,
                baseArrayLayer,
                arrayLayerCount: 1
            }),
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
        };
        if (texture.format.includes('stencil')) {
            attachment.stencilLoadOp = 'clear';
            attachment.stencilStoreOp = 'store';
        }

        const passEncoder = this.xrBridge.device.getCommandEncoder().beginRenderPass({
            colorAttachments: [],
            depthStencilAttachment: attachment
        });
        DebugHelper.setLabel(passEncoder, 'XrDepthClear-PassEncoder');
        passEncoder.end();
    }

    endFrame() {
        const device = this.xrBridge.device;
        device?._clearXrState();
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
     * @param {XRFrame} _frame - Current XR frame.
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
     * @param {XRFrame} _frame - Current XR frame.
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
     * Makes the binding and projection layer and presents the layer. Both are kept only once both
     * are made, so a failure to make the layer leaves the bridge's binding and layer as they were.
     *
     * @param {XRSession} session - XR session.
     * @param {object} options - Presentation options.
     * @param {number} options.framebufferScaleFactor - Resolved framebuffer scale factor.
     * @param {number} [options.depthNear] - Depth near plane. The session's is left as it is when
     * omitted, as are both of its planes if either is.
     * @param {number} [options.depthFar] - Depth far plane.
     * @param {Function} [options.onBindingError] - Called with the binding's errors: failing to
     * construct it, failing to acquire a view's texture (on every frame that fails), and failing to
     * make the projection layer again after that.
     */
    attachPresentation(session, options) {
        const XRGPUBindingCtor = globalThis.XRGPUBinding;
        if (typeof XRGPUBindingCtor === 'undefined') {
            this.xrBridge._onBindingError?.(new Error('XRGPUBinding is not available in this browser.'));
            return;
        }

        const device = this.xrBridge.device;
        const wgpu = device.wgpu;

        let binding;
        try {
            binding = new XRGPUBindingCtor(session, wgpu);
        } catch (ex) {
            this.xrBridge._onBindingError?.(ex);
            return;
        }

        const colorFormat = binding.getPreferredColorFormat();

        const layerOpts = {
            colorFormat,
            scaleFactor: options.framebufferScaleFactor
        };

        // Prefer texture-array for stereo (per-eye array layers); some runtimes only support 'texture'.
        let layer;
        try {
            layer = binding.createProjectionLayer({
                ...layerOpts,
                textureType: 'texture-array'
            });
        } catch {
            layer = binding.createProjectionLayer({
                ...layerOpts,
                textureType: 'texture'
            });
        }

        this._binding = binding;
        this._layer = layer;

        const renderState = { layers: [layer] };
        if (options.depthNear !== undefined && options.depthFar !== undefined) {
            renderState.depthNear = options.depthNear;
            renderState.depthFar = options.depthFar;
        }
        session.updateRenderState(renderState);
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
        const encoder = device.getCommandEncoder();

        const width = xrCamera.width;
        const height = xrCamera.height;

        encoder.copyTextureToTexture(
            { texture: src },
            { texture: dst },
            [width, height, 1]
        );
    }

    /**
     * GPU XR depth texture binding is not implemented for WebGPU yet (`XRGPUBinding` has no depth API).
     *
     * @param {any} depthInfo - Depth information from WebXR (`getDepthInformation`); when `texture` is set, GPU depth was negotiated.
     * @param {Texture} _texture - Unused until WebGPU depth is implemented.
     * @param {number} _depthPixelFormat - Unused until WebGPU depth is implemented.
     */
    syncCameraDepthTexture(depthInfo, _texture, _depthPixelFormat) {
        if (depthInfo?.texture) {
            Debug.warnOnce('WebXR GPU depth textures are not supported on WebGPU in this engine build; use CPU depth or WebGL until XRGPUBinding exposes depth.');
        }
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
        this._acquireFailures = 0;
        this._cachedFramebufferSize.set(0, 0);
        device._clearXrState();

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
