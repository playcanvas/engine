import { BUFFER_DYNAMIC, BUFFER_GPUDYNAMIC, BUFFER_STATIC, BUFFER_STREAM } from './graphics.js';

var id = 0;

/**
 * @class
 * @name pc.VertexBuffer
 * @classdesc A vertex buffer is the mechanism via which the application specifies vertex
 * data to the graphics hardware.
 * @description Creates a new vertex buffer object.
 * @param {pc.GraphicsDevice} graphicsDevice - The graphics device used to manage this vertex buffer.
 * @param {pc.VertexFormat} format - The vertex format of this vertex buffer.
 * @param {number} numVertices - The number of vertices that this vertex buffer will hold.
 * @param {number} [usage] - The usage type of the vertex buffer (see pc.BUFFER_*).
 * @param {ArrayBuffer} [initialData] - Initial data.
 */
function VertexBuffer(graphicsDevice, format, numVertices, usage, initialData) {
    // By default, vertex buffers are static (better for performance since buffer data can be cached in VRAM)
    this.usage = usage || BUFFER_STATIC;
    this.format = format;
    this.numVertices = numVertices;
    this.id = id++;

    // Calculate the size. If format contains verticesByteSize (non-interleaved format), use it
    this.numBytes = format.verticesByteSize ? format.verticesByteSize : format.size * numVertices;
    graphicsDevice._vram.vb += this.numBytes;

    // Create the WebGL vertex buffer object
    this.device = graphicsDevice;

    // Allocate the storage
    if (initialData) {
        this.setData(initialData);
    } else {
        this.storage = new ArrayBuffer(this.numBytes);
    }

    this.device.buffers.push(this);
}

Object.assign(VertexBuffer.prototype, {
    /**
     * @function
     * @name pc.VertexBuffer#destroy
     * @description Frees resources associated with this vertex buffer.
     */
    destroy: function () {
        var device = this.device;
        var idx = device.buffers.indexOf(this);
        if (idx !== -1) {
            device.buffers.splice(idx, 1);
        }

        if (this.bufferId) {

            // clear up bound vertex buffers
            var gl = device.gl;
            device.boundVao = null;
            gl.bindVertexArray(null);

            // delete buffer
            gl.deleteBuffer(this.bufferId);
            device._vram.vb -= this.storage.byteLength;
            this.bufferId = null;
        }
    },

    /**
     * @function
     * @name pc.VertexBuffer#getFormat
     * @description Returns the data format of the specified vertex buffer.
     * @returns {pc.VertexFormat} The data format of the specified vertex buffer.
     */
    getFormat: function () {
        return this.format;
    },

    /**
     * @function
     * @name pc.VertexBuffer#getUsage
     * @description Returns the usage type of the specified vertex buffer. This indicates
     * whether the buffer can be modified once and used many times (pc.BUFFER_STATIC),
     * modified repeatedly and used many times (pc.BUFFER_DYNAMIC) or modified once
     * and used at most a few times (pc.BUFFER_STREAM).
     * @returns {number} The usage type of the vertex buffer (see pc.BUFFER_*).
     */
    getUsage: function () {
        return this.usage;
    },

    /**
     * @function
     * @name pc.VertexBuffer#getNumVertices
     * @description Returns the number of vertices stored in the specified vertex buffer.
     * @returns {number} The number of vertices stored in the vertex buffer.
     */
    getNumVertices: function () {
        return this.numVertices;
    },

    /**
     * @function
     * @name pc.VertexBuffer#lock
     * @description Returns a mapped memory block representing the content of the vertex buffer.
     * @returns {ArrayBuffer} An array containing the byte data stored in the vertex buffer.
     */
    lock: function () {
        return this.storage;
    },

    /**
     * @function
     * @name pc.VertexBuffer#unlock
     * @description Notifies the graphics engine that the client side copy of the vertex buffer's
     * memory can be returned to the control of the graphics driver.
     */
    unlock: function () {
        // Upload the new vertex data
        var gl = this.device.gl;

        if (!this.bufferId) {
            this.bufferId = gl.createBuffer();
        }

        var glUsage;
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

        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferId);
        gl.bufferData(gl.ARRAY_BUFFER, this.storage, glUsage);
    },

    /**
     * @function
     * @name pc.VertexBuffer#setData
     * @description Copies data into vertex buffer's memory.
     * @param {ArrayBuffer} [data] - Source data to copy.
     * @returns {boolean} True if function finished successfuly, false otherwise.
     */
    setData: function (data) {
        if (data.byteLength !== this.numBytes) {
            console.error("VertexBuffer: wrong initial data size: expected " + this.numBytes + ", got " + data.byteLength);
            return false;
        }
        this.storage = data;
        this.unlock();
        return true;
    }
});

export { VertexBuffer };
