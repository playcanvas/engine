import { BUFFER_DYNAMIC } from '../constants.js';
import { WebglBuffer } from './webgl-buffer.js';

/**
 * A WebGL implementation of the UniformBuffer.
 *
 * @ignore
 */
class WebglUniformBuffer extends WebglBuffer {
    unlock(uniformBuffer) {
        const device = uniformBuffer.device;
        const gl = device.gl;

        // upload the uniform buffer data to a GL UNIFORM_BUFFER, allocating it on the first call
        super.unlock(device, BUFFER_DYNAMIC, gl.UNIFORM_BUFFER, uniformBuffer.storageInt32);
    }
}

export { WebglUniformBuffer };
