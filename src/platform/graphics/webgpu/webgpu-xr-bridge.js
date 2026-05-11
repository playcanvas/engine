/**
 * @import { XrBridge } from '../xr-bridge.js'
 * @import { GraphicsDevice } from '../graphics-device.js'
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
