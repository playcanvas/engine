import { Debug } from '../../core/debug.js';
import { TRACEID_VRAM_VB } from '../../core/constants.js';
import { BUFFER_STATIC } from './constants.js';

/**
 * @import { GraphicsDevice } from './graphics-device.js'
 * @import { VertexFormat } from './vertex-format.js'
 */

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
     * Lazily evaluated cache of {@link VertexBuffer#vaoKeyPart}.
     *
     * @type {string|null}
     * @private
     */
    _vaoKeyPart = null;

    /**
     * Create a new VertexBuffer instance.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device used to manage this vertex
     * buffer.
     * @param {VertexFormat} format - The vertex format of this vertex buffer.
     * @param {number} numVertices - The number of vertices that this vertex buffer will hold.
     * @param {object} [options] - Object for passing optional arguments.
     * @param {number} [options.usage] - The usage type of the vertex buffer (see BUFFER_*).
     * Defaults to BUFFER_STATIC.
     * @param {ArrayBuffer|ArrayBufferView} [options.data] - Initial data. Can be an
     * `ArrayBuffer` or a typed array (for example a `Float32Array`). The data is
     * stored by reference and is not copied, so a typed array that is a view into a larger buffer
     * is kept as-is. If left unspecified, the vertex buffer will be initialized to zeros.
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

        this.device.buffers.add(this);
    }

    /**
     * This buffer's contribution to the key of the device's vertex array object cache. It identifies
     * both the buffer and its format, and is delimited so that the parts of several buffers can be
     * concatenated without ambiguity.
     *
     * Evaluated lazily, as it is only needed by buffers taking part in a draw which uses more than
     * one vertex buffer, and most buffers never do. The format of a vertex buffer never changes, so
     * the value is safe to cache.
     *
     * @type {string}
     * @ignore
     */
    get vaoKeyPart() {
        this._vaoKeyPart ??= `${this.id}_${this.format.renderingHash}_`;
        return this._vaoKeyPart;
    }

    /**
     * Frees resources associated with this vertex buffer.
     */
    destroy() {

        // stop tracking the vertex buffer
        const device = this.device;
        device.buffers.delete(this);

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
     * Called when the rendering context is restored. Recreates the GPU buffer and uploads from
     * {@link VertexBuffer#lock|lock} storage.
     *
     * @ignore
     */
    restoreContext() {
        this.unlock();
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
     * @returns {ArrayBuffer|ArrayBufferView} The memory that stores the buffer's vertices. This
     * matches whatever was supplied as the initial data: an {@link ArrayBuffer} when none was
     * provided, otherwise the {@link ArrayBuffer} or typed array that was passed in. Use
     * {@link ArrayBuffer.isView} to distinguish the two before accessing it.
     */
    lock() {
        return this.storage;
    }

    /**
     * Uploads the client side copy of the vertex buffer to the GPU. When called without arguments,
     * uploads the entire buffer. An explicit range uploads only those bytes at the same GPU offset.
     * The first upload always initializes the entire GPU buffer, regardless of the requested range.
     * A zero byte length does nothing, including before the first upload.
     *
     * Partial uploads do not resize the buffer or change its CPU storage. The caller must upload
     * every modified range before expecting those changes on the GPU. Context restoration uploads
     * the entire CPU storage. Invalid ranges are ignored in all builds and report an assertion
     * in debug builds.
     *
     * @param {number} [byteOffset] - Offset in bytes from the start of the buffer's storage.
     * Defaults to 0. Must be a non-negative integer and a multiple of 4 on all graphics backends.
     * @param {number} [byteLength] - Number of bytes to upload. Defaults to the remaining bytes
     * after byteOffset. The length must be a non-negative integer and the range must fit within
     * the buffer. Partial ranges require a length that is a multiple of 4. Full-buffer uploads
     * support any byte length, whether the range is explicit or the arguments are omitted.
     * @example
     * // After modifying bytes 16 through 31 of the CPU storage:
     * vertexBuffer.unlock(16, 16);
     */
    unlock(byteOffset, byteLength) {
        if (byteOffset !== undefined || byteLength !== undefined) {
            byteOffset ??= 0;
            byteLength ??= this.numBytes - byteOffset;

            const fullRange = byteOffset === 0 && byteLength === this.numBytes;
            const valid = Number.isInteger(byteOffset) && byteOffset >= 0 && byteOffset % 4 === 0 &&
                Number.isInteger(byteLength) && byteLength >= 0 && (fullRange || byteLength % 4 === 0) &&
                byteOffset + byteLength <= this.numBytes;
            Debug.assert(valid, 'Buffer upload range must contain non-negative integers and fit within the buffer; partial ranges must be aligned to 4 bytes');

            if (!valid || byteLength === 0) {
                return;
            }
        }

        this.impl.unlock(this, byteOffset, byteLength);
    }

    /**
     * Sets the data of the vertex buffer and uploads it to the GPU.
     *
     * @param {ArrayBuffer|ArrayBufferView} [data] - Source data. Can be an {@link ArrayBuffer} or
     * a typed array. Stored by reference, not copied.
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
