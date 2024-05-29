import { Debug } from '../../core/debug.js';
import { TRACEID_VRAM_VB } from '../../core/constants.js';
import { BUFFER_STATIC } from './constants.js';

let id = 0;

/**
 * A vertex buffer is the mechanism via which the application specifies vertex data to the graphics
 * hardware.
 *
 * @category Graphics
 */
class VertexBuffer {
    usage = BUFFER_STATIC;

    /**
     * Create a new VertexBuffer instance.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
     * used to manage this vertex buffer.
     * @param {import('./vertex-format.js').VertexFormat} format - The vertex format of this vertex
     * buffer.
     * @param {number} numVertices - The number of vertices that this vertex buffer will hold.
     * @param {object} [options] - Object for passing optional arguments.
     * @param {number} [options.usage] - The usage type of the vertex buffer (see BUFFER_*).
     * Defaults to BUFFER_STATIC.
     * @param {ArrayBuffer} [options.data] - Initial data.
     * @param {boolean} [options.storage] - Defines if the vertex buffer can be used as a storage
     * buffer by a compute shader. Defaults to false. Only supported on WebGPU.
     */
    constructor(graphicsDevice, format, numVertices, options) {

        Debug.assert(arguments.length <= 4 && (!options || typeof options === 'object'), 'incorrect arguments');

        // By default, vertex buffers are static (better for performance since buffer data can be cached in VRAM)
        this.usage = options?.usage ?? BUFFER_STATIC;

        this.device = graphicsDevice;
        this.format = format;
        this.numVertices = numVertices;

        this.id = id++;

        this.impl = graphicsDevice.createVertexBufferImpl(this, format, options);

        // Calculate the size. If format contains verticesByteSize (non-interleaved format), use it
        this.numBytes = format.verticesByteSize ? format.verticesByteSize : format.size * numVertices;
        this.adjustVramSizeTracking(graphicsDevice._vram, this.numBytes);

        // Allocate the storage
        const initialData = options?.data;
        if (initialData) {
            this.setData(initialData);
        } else {
            this.storage = new ArrayBuffer(this.numBytes);
        }

        this.device.buffers.push(this);
    }

    /**
     * Frees resources associated with this vertex buffer.
     */
    destroy() {

        // stop tracking the vertex buffer
        const device = this.device;
        const idx = device.buffers.indexOf(this);
        if (idx !== -1) {
            device.buffers.splice(idx, 1);
        }

        if (this.impl.initialized) {
            this.impl.destroy(device);
            this.adjustVramSizeTracking(device._vram, -this.storage.byteLength);
        }
    }

    adjustVramSizeTracking(vram, size) {
        Debug.trace(TRACEID_VRAM_VB, `${this.id} size: ${size} vram.vb: ${vram.vb} => ${vram.vb + size}`);
        vram.vb += size;
    }

    /**
     * Called when the rendering context was lost. It releases all context related resources.
     *
     * @ignore
     */
    loseContext() {
        this.impl.loseContext();
    }

    /**
     * Returns the data format of the specified vertex buffer.
     *
     * @returns {import('./vertex-format.js').VertexFormat} The data format of the specified vertex
     * buffer.
     */
    getFormat() {
        return this.format;
    }

    /**
     * Returns the usage type of the specified vertex buffer. This indicates whether the buffer can
     * be modified once and used many times {@link BUFFER_STATIC}, modified repeatedly and used
     * many times {@link BUFFER_DYNAMIC} or modified once and used at most a few times
     * {@link BUFFER_STREAM}.
     *
     * @returns {number} The usage type of the vertex buffer (see BUFFER_*).
     */
    getUsage() {
        return this.usage;
    }

    /**
     * Returns the number of vertices stored in the specified vertex buffer.
     *
     * @returns {number} The number of vertices stored in the vertex buffer.
     */
    getNumVertices() {
        return this.numVertices;
    }

    /**
     * Returns a mapped memory block representing the content of the vertex buffer.
     *
     * @returns {ArrayBuffer} An array containing the byte data stored in the vertex buffer.
     */
    lock() {
        return this.storage;
    }

    /**
     * Notifies the graphics engine that the client side copy of the vertex buffer's memory can be
     * returned to the control of the graphics driver.
     */
    unlock() {

        // Upload the new vertex data
        this.impl.unlock(this);
    }

    /**
     * Copies data into vertex buffer's memory.
     *
     * @param {ArrayBuffer} [data] - Source data to copy.
     * @returns {boolean} True if function finished successfully, false otherwise.
     */
    setData(data) {
        if (data.byteLength !== this.numBytes) {
            Debug.error(`VertexBuffer: wrong initial data size: expected ${this.numBytes}, got ${data.byteLength}`);
            return false;
        }
        this.storage = data;
        this.unlock();
        return true;
    }
}

export { VertexBuffer };
