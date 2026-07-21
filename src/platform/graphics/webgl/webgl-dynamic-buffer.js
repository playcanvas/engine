import { DynamicBuffer } from '../dynamic-buffer.js';

/**
 * @import { WebglGraphicsDevice } from './webgl-graphics-device.js'
 */

/**
 * A WebGL implementation of a dynamic buffer - a single whole uniform buffer that is handed out
 * from a pool for one frame at a time. The data is written into a CPU-side backing array and
 * uploaded with `bufferData` (a full respecify), which orphans the previous storage and lets the
 * driver hand back fresh storage - so reusing a buffer never stalls on in-flight draws. As each use
 * gets its own buffer, the offset into it is always zero.
 *
 * @ignore
 */
class WebglDynamicBuffer extends DynamicBuffer {
    /**
     * The GL buffer object (mirrors WebgpuDynamicBuffer.buffer). Created lazily on the first
     * upload, so it is also recreated automatically after a context loss nulls it.
     *
     * @type {WebGLBuffer|null}
     */
    bufferId = null;

    /**
     * CPU-side backing for the whole buffer, written to during the uniform buffer update and
     * uploaded by {@link upload}.
     *
     * @type {Int32Array}
     */
    storage;

    /**
     * Byte size of the buffer.
     *
     * @type {number}
     */
    size;

    /**
     * @param {WebglGraphicsDevice} device - The graphics device.
     * @param {number} size - The byte size of the buffer.
     */
    constructor(device, size) {
        super(device);

        this.size = size;
        this.storage = new Int32Array(size / 4);

        device._vram.ub += size;
    }

    destroy(device) {
        if (this.bufferId) {
            device.gl.deleteBuffer(this.bufferId);
            this.bufferId = null;
        }
        device._vram.ub -= this.size;
    }

    /**
     * Called when the rendering context is lost. The GL buffer is gone with the context, so drop
     * the handle; the next upload recreates it. The CPU storage and pooling are preserved.
     */
    loseContext() {
        this.bufferId = null;
    }

    /**
     * Upload the CPU backing to the GL buffer, creating the buffer on first use (or after a context
     * loss). Uses `bufferData` (full respecify) so the driver orphans the previous storage - this
     * avoids a pipeline stall when the buffer is reused while the previous frame's draws may still
     * be reading it.
     */
    upload() {
        const gl = this.device.gl;
        if (!this.bufferId) {
            this.bufferId = gl.createBuffer();
        }
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.bufferId);
        gl.bufferData(gl.UNIFORM_BUFFER, this.storage, gl.STREAM_DRAW);
    }
}

export { WebglDynamicBuffer };
