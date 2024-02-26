import { Debug } from "../../../core/debug.js";
import { DebugGraphics } from "../debug-graphics.js";

// Maximum number of times a duplicate error message is logged.
const MAX_DUPLICATES = 5;

/**
 * Internal WebGPU debug system. Note that the functions only execute in the debug build, and are
 * stripped out in other builds.
 *
 * @ignore
 */
class WebgpuDebug {
    static _scopes = [];

    static _markers = [];

    /** @type {Map<string,number>} */
    static _loggedMessages = new Map();

    /**
     * Start a validation error scope.
     *
     * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The graphics
     * device.
     */
    static validate(device) {
        device.wgpu.pushErrorScope('validation');
        WebgpuDebug._scopes.push('validation');
        WebgpuDebug._markers.push(DebugGraphics.toString());
    }

    /**
     * Start an out-of-memory error scope.
     *
     * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The graphics
     * device.
     */
    static memory(device) {
        device.wgpu.pushErrorScope('out-of-memory');
        WebgpuDebug._scopes.push('out-of-memory');
        WebgpuDebug._markers.push(DebugGraphics.toString());
    }

    /**
     * Start an internal error scope.
     *
     * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The graphics
     * device.
     */
    static internal(device) {
        device.wgpu.pushErrorScope('internal');
        WebgpuDebug._scopes.push('internal');
        WebgpuDebug._markers.push(DebugGraphics.toString());
    }

    /**
     * End the previous error scope, and print errors if any.
     *
     * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The graphics
     * device.
     * @param {...any} args - Additional parameters that form the error message.
     */
    static end(device, ...args) {
        const header = WebgpuDebug._scopes.pop();
        const marker = WebgpuDebug._markers.pop();
        Debug.assert(header, 'Non matching end.');

        device.wgpu.popErrorScope().then((error) => {
            if (error) {
                const count = WebgpuDebug._loggedMessages.get(error.message) ?? 0;
                if (count < MAX_DUPLICATES) {
                    const tooMany = count === MAX_DUPLICATES - 1 ? ' (Too many errors, ignoring this one from now)' : '';
                    WebgpuDebug._loggedMessages.set(error.message, count + 1);
                    console.error(`WebGPU ${header} error: ${error.message}`, tooMany, "while rendering", marker, ...args);
                }
            }
        });
    }
}

export { WebgpuDebug };
