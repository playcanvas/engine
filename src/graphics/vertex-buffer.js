import { Debug } from '../core/debug.js';
import { BUFFER_STATIC } from './constants.js';

/** @typedef {import('./graphics-device.js').GraphicsDevice} GraphicsDevice */
/** @typedef {import('./vertex-format.js').VertexFormat} VertexFormat */

let id = 0;

/**
 * A vertex buffer is the mechanism via which the application specifies vertex data to the graphics
 * hardware.
 */
class VertexBuffer {
    /**
     * Create a new VertexBuffer instance.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device used to manage this vertex
     * buffer.
     * @param {VertexFormat} format - The vertex format of this vertex buffer.
     * @param {number} numVertices - The number of vertices that this vertex buffer will hold.
     * @param {number} [usage] - The usage type of the vertex buffer (see BUFFER_*). Defaults to BUFFER_STATIC.
     * @param {ArrayBuffer} [initialData] - Initial data.
     */
    constructor(graphicsDevice, format, numVertices, usage = BUFFER_STATIC, initialData) {
        // By default, vertex buffers are static (better for performance since buffer data can be cached in VRAM)
        this.device = graphicsDevice;
        this.format = format;
        this.numVertices = numVertices;
        this.usage = usage;

        this.id = id++;

        this.impl = graphicsDevice.createVertexBufferImpl(this, format);

        // marks vertex buffer as instancing data
        this.instancing = false;

        // Calculate the size. If format contains verticesByteSize (non-interleaved format), use it
        this.numBytes = format.verticesByteSize ? format.verticesByteSize : format.size * numVertices;
        graphicsDevice._vram.vb += this.numBytes;

        // Allocate the storage
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

        this.impl.destroy(device);

        // TODO: double check this works correctly
        device._vram.vb -= this.storage.byteLength;
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
     * @returns {VertexFormat} The data format of the specified vertex buffer.
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
