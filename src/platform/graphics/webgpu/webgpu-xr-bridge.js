/**
 * @import { XrBridge } from '../xr-bridge.js'
 * @import { GraphicsDevice } from '../graphics-device.js'
 * @import { Vec2 } from '../../../core/math/vec2.js'
 */

/**
 * WebGPU graphics implementation for {@link XrBridge}.
 *
 * @ignore
 */
class WebgpuXrBridge {
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
    }

    /**
     * @param {XRFrame} _frame - Current XR frame.
     */
    beginFrame(_frame) {
    }

    endFrame() {
    }

    /**
     * @returns {null} WebGPU XR presentation is not implemented yet.
     */
    get presentationLayer() {
        return null;
    }

    /**
     * @returns {null} WebGPU XR binding is not implemented yet.
     */
    get graphicsBinding() {
        return null;
    }

    /**
     * @param {XRFrame} _frame - Current XR frame.
     * @param {Vec2} out - Placeholder until WebGPU XR presentation is implemented.
     */
    getFramebufferSize(_frame, out) {
        out.set(0, 0);
    }

    /**
     * @param {XRFrame} _frame - Current XR frame.
     * @param {XRView} _xrView - WebXR view.
     * @returns {XRViewport} Stub until WebGPU XR presentation is implemented.
     */
    getViewport(_frame, _xrView) {
        return null;
    }

    attachPresentation(_session, _options) {
    }

    releasePresentation() {
    }

    onGraphicsDeviceLost() {
    }

    onGraphicsDeviceRestored() {
    }
}

export { WebgpuXrBridge };
