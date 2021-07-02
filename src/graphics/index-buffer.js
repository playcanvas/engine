import {
    BUFFER_DYNAMIC, BUFFER_GPUDYNAMIC, BUFFER_STATIC, BUFFER_STREAM,
    INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32
} from './constants.js';

/**
 * @class
 * @name IndexBuffer
 * @classdesc An index buffer stores index values into a {@link VertexBuffer}.
 * Indexed graphical primitives can normally utilize less memory that unindexed
 * primitives (if vertices are shared).
 *
 * Typically, index buffers are set on {@link Mesh} objects.
 * @description Creates a new index buffer.
 * @example
 * // Create an index buffer holding 3 16-bit indices. The buffer is marked as
 * // static, hinting that the buffer will never be modified.
 * var indices = new UInt16Array([0, 1, 2]);
 * var indexBuffer = new pc.IndexBuffer(graphicsDevice,
 *                                      pc.INDEXFORMAT_UINT16,
 *                                      3,
 *                                      pc.BUFFER_STATIC,
 *                                      indices);
 * @param {GraphicsDevice} graphicsDevice - The graphics device used to
 * manage this index buffer.
 * @param {number} format - The type of each index to be stored in the index
 * buffer. Can be:
 *
 * * {@link INDEXFORMAT_UINT8}
 * * {@link INDEXFORMAT_UINT16}
 * * {@link INDEXFORMAT_UINT32}
 * @param {number} numIndices - The number of indices to be stored in the index
 * buffer.
 * @param {number} [usage] - The usage type of the vertex buffer. Can be:
 *
 * * {@link BUFFER_DYNAMIC}
 * * {@link BUFFER_STATIC}
 * * {@link BUFFER_STREAM}
 *
 * Defaults to {@link BUFFER_STATIC}.
 * @param {ArrayBuffer} [initialData] - Initial data. If left unspecified, the
 * index buffer will be initialized to zeros.
 */
class IndexBuffer {
    constructor(graphicsDevice, format, numIndices, usage = BUFFER_STATIC, initialData) {
        // By default, index buffers are static (better for performance since buffer data can be cached in VRAM)
        this.device = graphicsDevice;
        this.format = format;
        this.numIndices = numIndices;
        this.usage = usage;

        const gl = this.device.gl;

        // Allocate the storage
        let bytesPerIndex;
        if (format === INDEXFORMAT_UINT8) {
            bytesPerIndex = 1;
            this.glFormat = gl.UNSIGNED_BYTE;
        } else if (format === INDEXFORMAT_UINT16) {
            bytesPerIndex = 2;
            this.glFormat = gl.UNSIGNED_SHORT;
        } else if (format === INDEXFORMAT_UINT32) {
            bytesPerIndex = 4;
            this.glFormat = gl.UNSIGNED_INT;
        }
        this.bytesPerIndex = bytesPerIndex;

        this.numBytes = this.numIndices * bytesPerIndex;

        if (initialData) {
            this.setData(initialData);
        } else {
            this.storage = new ArrayBuffer(this.numBytes);
        }

        graphicsDevice._vram.ib += this.numBytes;

        this.device.buffers.push(this);
    }

    /**
     * @function
     * @name IndexBuffer#destroy
     * @description Frees resources associated with this index buffer.
     */
    destroy() {
        const device = this.device;
        const idx = device.buffers.indexOf(this);
        if (idx !== -1) {
            device.buffers.splice(idx, 1);
        }

        if (this.bufferId) {
            const gl = this.device.gl;
            gl.deleteBuffer(this.bufferId);
            this.device._vram.ib -= this.storage.byteLength;
            this.bufferId = null;

            if (this.device.indexBuffer === this) {
                this.device.indexBuffer = null;
            }
        }
    }

    // called when context was lost, function releases all context related resources
    loseContext() {
        this.bufferId = undefined;
    }

    /**
     * @function
     * @name IndexBuffer#getFormat
     * @description Returns the data format of the specified index buffer.
     * @returns {number} The data format of the specified index buffer. Can be:
     *
     * * {@link INDEXFORMAT_UINT8}
     * * {@link INDEXFORMAT_UINT16}
     * * {@link INDEXFORMAT_UINT32}
     */
    getFormat() {
        return this.format;
    }

    /**
     * @function
     * @name IndexBuffer#getNumIndices
     * @description Returns the number of indices stored in the specified index buffer.
     * @returns {number} The number of indices stored in the specified index buffer.
     */
    getNumIndices() {
        return this.numIndices;
    }

    /**
     * @function
     * @name IndexBuffer#lock
     * @description Gives access to the block of memory that stores the buffer's indices.
     * @returns {ArrayBuffer} A contiguous block of memory where index data can be written to.
     */
    lock() {
        return this.storage;
    }

    /**
     * @function
     * @name IndexBuffer#unlock
     * @description Signals that the block of memory returned by a call to the lock function is
     * ready to be given to the graphics hardware. Only unlocked index buffers can be set on the
     * currently active device.
     */
    unlock() {
        // Upload the new index data
        const gl = this.device.gl;

        if (!this.bufferId) {
            this.bufferId = gl.createBuffer();
        }

        let glUsage;
        switch (this.usage) {
            case BUFFER_STATIC:
                glUsage = gl.STATIC_DRAW;
                break;
            case BUFFER_DYNAMIC:
                glUsage = gl.DYNAMIC_DRAW;
                break;
            case BUFFER_STREAM:
                glUsage = gl.STREAM_DRAW;
                break;
            case BUFFER_GPUDYNAMIC:
                if (this.device.webgl2) {
                    glUsage = gl.DYNAMIC_COPY;
                } else {
                    glUsage = gl.STATIC_DRAW;
                }
                break;
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufferId);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.storage, glUsage);
    }

    setData(data) {
        if (data.byteLength !== this.numBytes) {
            // #if _DEBUG
            console.error("IndexBuffer: wrong initial data size: expected " + this.numBytes + ", got " + data.byteLength);
            // #endif
            return false;
        }

        this.storage = data;
        this.unlock();
        return true;
    }

    _lockTypedArray() {
        const lock = this.lock();
        const indices = this.format === INDEXFORMAT_UINT32 ? new Uint32Array(lock) :
            (this.format === INDEXFORMAT_UINT16 ? new Uint16Array(lock) : new Uint8Array(lock));
        return indices;
    }

    // Copies count elements from data into index buffer.
    // optimized for performance from both typed array as well as array
    writeData(data, count) {
        const indices = this._lockTypedArray();

        // if data contains more indices than needed, copy from its subarray
        if (data.length > count) {

            // if data is typed array
            if (ArrayBuffer.isView(data)) {
                data = data.subarray(0, count);
                indices.set(data);
            } else {
                // data is array, copy right amount manually
                for (let i = 0; i < count; i++)
                    indices[i] = data[i];
            }
        } else {
            // copy whole data
            indices.set(data);
        }

        this.unlock();
    }

    // copies index data from index buffer into provided data array
    readData(data) {
        // note: there is no need to unlock this buffer, as we are only reading from it
        const indices = this._lockTypedArray();
        const count = this.numIndices;

        if (ArrayBuffer.isView(data)) {
            // destination data is typed array
            data.set(indices);
        } else {
            // data is array, copy right amount manually
            data.length = 0;
            for (let i = 0; i < count; i++)
                data[i] = indices[i];
        }

        return count;
    }
}

export { IndexBuffer };
