Object.assign(pc, function () {
    'use strict';

    /**
     * @constructor
     * @name pc.IndexBuffer
     * @classdesc An index buffer is the mechanism via which the application specifies primitive
     * index data to the graphics hardware.
     * @description Creates a new index buffer.
     * @example
     * // Create an index buffer holding 3 16-bit indices
     * // The buffer is marked as static, hinting that the buffer will never be modified
     * var indexBuffer = new pc.IndexBuffer(graphicsDevice, pc.INDEXFORMAT_UINT16, 3, pc.BUFFER_STATIC);
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device used to manage this index buffer.
     * @param {Number} format The type of each index to be stored in the index buffer (see pc.INDEXFORMAT_*).
     * @param {Number} numIndices The number of indices to be stored in the index buffer.
     * @param {Number} [usage] The usage type of the vertex buffer (see pc.BUFFER_*).
     * @param {ArrayBuffer} [initialData] Initial data.
     */
    var IndexBuffer = function (graphicsDevice, format, numIndices, usage, initialData) {
        // By default, index buffers are static (better for performance since buffer data can be cached in VRAM)
        this.usage = usage || pc.BUFFER_STATIC;
        this.format = format;
        this.numIndices = numIndices;
        this.device = graphicsDevice;

        var gl = this.device.gl;

        // Allocate the storage
        var bytesPerIndex;
        if (format === pc.INDEXFORMAT_UINT8) {
            bytesPerIndex = 1;
            this.glFormat = gl.UNSIGNED_BYTE;
        } else if (format === pc.INDEXFORMAT_UINT16) {
            bytesPerIndex = 2;
            this.glFormat = gl.UNSIGNED_SHORT;
        } else if (format === pc.INDEXFORMAT_UINT32) {
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
    };

    Object.assign(IndexBuffer.prototype, {
        /**
         * @function
         * @name pc.IndexBuffer#destroy
         * @description Frees resources associated with this index buffer.
         */
        destroy: function () {
            var device = this.device;
            var idx = device.buffers.indexOf(this);
            if (idx !== -1) {
                device.buffers.splice(idx, 1);
            }

            if (this.bufferId) {
                var gl = this.device.gl;
                gl.deleteBuffer(this.bufferId);
                this.device._vram.ib -= this.storage.byteLength;
                this.bufferId = null;

                if (this.device.indexBuffer === this) {
                    this.device.indexBuffer = null;
                }
            }
        },

        /**
         * @function
         * @name pc.IndexBuffer#getFormat
         * @description Returns the data format of the specified index buffer.
         * @returns {Number} The data format of the specified index buffer (see pc.INDEXFORMAT_*).
         */
        getFormat: function () {
            return this.format;
        },

        /**
         * @function
         * @name pc.IndexBuffer#getNumIndices
         * @description Returns the number of indices stored in the specified index buffer.
         * @returns {Number} The number of indices stored in the specified index buffer.
         */
        getNumIndices: function () {
            return this.numIndices;
        },

        /**
         * @function
         * @name pc.IndexBuffer#lock
         * @description Gives access to the block of memory that stores the buffer's indices.
         * @returns {ArrayBuffer} A contiguous block of memory where index data can be written to.
         */
        lock: function () {
            return this.storage;
        },

        /**
         * @function
         * @name pc.IndexBuffer#unlock
         * @description Signals that the block of memory returned by a call to the lock function is
         * ready to be given to the graphics hardware. Only unlocked index buffers can be set on the
         * currently active device.
         */
        unlock: function () {
            // Upload the new index data
            var gl = this.device.gl;

            if (!this.bufferId) {
                this.bufferId = gl.createBuffer();
            }

            var glUsage;
            switch (this.usage) {
                case pc.BUFFER_STATIC:
                    glUsage = gl.STATIC_DRAW;
                    break;
                case pc.BUFFER_DYNAMIC:
                    glUsage = gl.DYNAMIC_DRAW;
                    break;
                case pc.BUFFER_STREAM:
                    glUsage = gl.STREAM_DRAW;
                    break;
                case pc.BUFFER_GPUDYNAMIC:
                    if (this.device.webgl2) {
                        glUsage = gl.DYNAMIC_COPY;
                    } else {
                        glUsage = gl.STATIC_DRAW;
                    }
                    break;
            }

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufferId);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.storage, glUsage);
        },

        setData: function (data) {
            if (data.byteLength !== this.numBytes) {
                console.error("IndexBuffer: wrong initial data size: expected " + this.numBytes + ", got " + data.byteLength);
                return false;
            }
            this.storage = data;
            this.unlock();
            return true;
        }
    });

    return {
        IndexBuffer: IndexBuffer
    };
}());
