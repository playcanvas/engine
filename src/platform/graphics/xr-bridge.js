/**
 * @import { GraphicsDevice } from './graphics-device.js'
 * @import { EventHandler } from '../../core/event-handler.js'
 * @import { EventHandle } from '../../core/event-handle.js'
 * @import { Vec2 } from '../../core/math/vec2.js'
 */

/**
 * Bridges WebXR presentation to the graphics device backend.
 *
 * @ignore
 */
class XrBridge {
    /**
     * @type {GraphicsDevice}
     */
    device;

    /**
     * Receives XR presentation-related events (for example {@link EventHandler#fire} with name `"error"`).
     *
     * @type {EventHandler}
     */
    eventHandler;

    /**
     * @type {object}
     */
    impl;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtDeviceLost = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtDeviceRestored = null;

    /**
     * Active XR session for presentation (shared across graphics backends).
     *
     * @type {XRSession|null}
     * @private
     */
    _session = null;

    /**
     * Resolved framebuffer scale from the last {@link XrBridge#attachPresentation}.
     *
     * @type {number}
     * @private
     */
    _framebufferScaleFactor = 1;

    /**
     * Callback when backend GPU binding construction fails.
     *
     * @type {Function|undefined}
     * @private
     */
    _onBindingError;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {EventHandler} eventHandler - Target for firing XR-related errors.
     */
    constructor(device, eventHandler) {
        this.device = device;
        this.eventHandler = eventHandler;
        this.impl = device.createXrBridgeImpl(this);

        this._evtDeviceLost = device.on('devicelost', this._onDeviceLost, this);
        this._evtDeviceRestored = device.on('devicerestored', this._onDeviceRestored, this);
    }

    destroy() {
        const device = this.device;
        if (device) {
            this._evtDeviceLost?.off();
            this._evtDeviceLost = null;
            this._evtDeviceRestored?.off();
            this._evtDeviceRestored = null;

            this.impl.endFrame();
            this.impl.destroy(device);
            this.impl = null;

            this._session = null;
            this._framebufferScaleFactor = 1;
            this._onBindingError = undefined;

            this.device = null;
            this.eventHandler = null;
        }
    }

    /** @private */
    _onDeviceLost() {
        this.impl.onGraphicsDeviceLost();
    }

    /** @private */
    _onDeviceRestored() {
        this.impl.onGraphicsDeviceRestored();
    }

    /**
     * @param {XRSession} session - XR session.
     * @param {object} options - Presentation options (backend-specific; includes framebufferScaleFactor, depthNear, depthFar).
     */
    attachPresentation(session, options) {
        this._session = session;
        this._framebufferScaleFactor = options.framebufferScaleFactor;
        this._onBindingError = options.onBindingError;

        this.impl.attachPresentation(session, options);
    }

    releasePresentation() {
        this.impl.releasePresentation();
    }

    /**
     * Called once per XR frame before rendering to set the backend render target for this frame.
     *
     * @param {XRFrame} frame - Current XR frame.
     */
    beginFrame(frame) {
        this.impl.beginFrame(frame);
    }

    /**
     * Resets the backend render target after the XR session ends.
     */
    endFrame() {
        this.impl.endFrame();
    }

    /**
     * Writes immersive framebuffer size in pixels for this frame (backend-specific source)
     * into {@link Vec2#x} (width) and {@link Vec2#y} (height).
     *
     * @param {XRFrame} frame - Current XR frame.
     * @param {Vec2} out - Receives width and height; reused by the caller to avoid per-frame allocation.
     */
    getFramebufferSize(frame, out) {
        this.impl.getFramebufferSize(frame, out);
    }

    /**
     * Viewport rectangle for an XR view within the immersive framebuffer (or per-view texture).
     *
     * @param {XRFrame} frame - Current XR frame.
     * @param {XRView} xrView - WebXR view.
     * @returns {XRViewport} Viewport for this view.
     */
    getViewport(frame, xrView) {
        return this.impl.getViewport(frame, xrView);
    }

    /**
     * @returns {XRLayer|null} Backend output layer (e.g. XRWebGLLayer), if any.
     */
    get presentationLayer() {
        return this.impl.presentationLayer ?? null;
    }

    /**
     * @returns {XRWebGLBinding|null} Backend graphics binding for camera/depth, if any.
     */
    get graphicsBinding() {
        return this.impl.graphicsBinding ?? null;
    }
}

export { XrBridge };
