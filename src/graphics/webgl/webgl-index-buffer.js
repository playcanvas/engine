import { INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32 } from '../constants.js';
import { WebglBuffer } from "./webgl-buffer.js";

/**
 * A WebGL implementation of the IndexBuffer.
 *
 * @ignore
 */
class WebglIndexBuffer extends WebglBuffer {
    constructor(indexBuffer) {
        super();

        const gl = indexBuffer.device.gl;
        const format = indexBuffer.format;
        if (format === INDEXFORMAT_UINT8) {
            this.glFormat = gl.UNSIGNED_BYTE;
        } else if (format === INDEXFORMAT_UINT16) {
            this.glFormat = gl.UNSIGNED_SHORT;
        } else if (format === INDEXFORMAT_UINT32) {
            this.glFormat = gl.UNSIGNED_INT;
        }
    }

    unlock(indexBuffer) {

        const device = indexBuffer.device;
        super.unlock(device, indexBuffer.usage, device.gl.ELEMENT_ARRAY_BUFFER, indexBuffer.storage);
    }
}

export { WebglIndexBuffer };
