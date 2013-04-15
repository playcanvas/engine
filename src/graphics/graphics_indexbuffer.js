pc.extend(pc.gfx, function () {
    /**
     * @name pc.gfx.IndexBuffer
     * @class An index buffer is the mechanism via which the application specifies vertex 
     * index data to the graphics hardware.
     * @param {Number} format The type of each index to be stored in the index buffer (see pc.gfx.INDEXFORMAT_*).
     * @param {Number} numIndices The number of indices to be stored in the index buffer.
     * @param {Number} [usage] The usage type of the vertex buffer (see pc.gfx.BUFFER_*).
     */
    var IndexBuffer = function (format, numIndices, usage) {
        // Initialize optional parameters
        // By default, index buffers are static (better for performance since buffer data can be cached in VRAM)
        this.usage = usage || pc.gfx.BUFFER_STATIC;

        // Store the index format
        this.format = format;

        // Store the number of indices
        this.numIndices = numIndices;

        // Create the WebGL buffer
        this.gl = pc.gfx.Device.getCurrent().gl;

        var gl = this.gl;
        this.bufferId = gl.createBuffer();

        // Allocate the storage
        var bytesPerIndex;
        if (format === pc.gfx.INDEXFORMAT_UINT8) {
            bytesPerIndex = 1;
            this.glFormat = gl.UNSIGNED_BYTE;
        } else if (format === pc.gfx.INDEXFORMAT_UINT16) {
            bytesPerIndex = 2;
            this.glFormat = gl.UNSIGNED_SHORT;
        } else if (format === pc.gfx.INDEXFORMAT_UINT32) {
            bytesPerIndex = 4;
            this.glFormat = gl.UNSIGNED_INT;
        }

        var numBytes = this.numIndices * bytesPerIndex;
        this.storage = new ArrayBuffer(numBytes);
    };

    IndexBuffer.prototype = {
        /**
         * @function
         * @name pc.gfx.IndexBuffer#destroy
         * @description Frees resources associated with this index buffer.
         * @author Will Eastcott
         */
        destroy: function () {
            var gl = this.gl;
            gl.deleteBuffer(this.bufferId);
        },

        /**
         * @function
         * @name pc.gfx.IndexBuffer#getFormat
         * @description Returns the data format of the specified index buffer.
         * @returns {Number} The data format of the specified index buffer (see pc.gfx.INDEXFORMAT_*).
         * @author Will Eastcott
         */
        getFormat: function () {
            return this.format;
        },

        /**
         * @function
         * @name pc.gfx.IndexBuffer#getNumIndices
         * @description Returns the number of indices stored in the specified index buffer.
         * @returns {Number} The number of indices stored in the specified index buffer.
         * @author Will Eastcott
         */
        getNumIndices: function () {
            return this.numIndices;
        },

        /**
         * @function
         * @name pc.gfx.IndexBuffer#lock
         * @description Gives access to the block of memory that stores the buffer's indices.
         * @returns {ArrayBuffer} A contiguous block of memory where index data can be written to.
         * @author Will Eastcott
         */
        lock: function () {
            return this.storage;
        },

        /**
         * @function
         * @name pc.gfx.IndexBuffer#unlock
         * @description Signals that the block of memory returned by a call to the lock function is 
         * ready to be given to the graphics hardware. Only unlocked index buffers can be set on the 
         * currently active device.
         * @author Will Eastcott
         */
        unlock: function () {
            // Upload the new index data
            var gl = this.gl;
            var glUsage;
            switch (this.usage) {
                case pc.gfx.BUFFER_STATIC:
                    glUsage = gl.STATIC_DRAW;
                    break;
                case pc.gfx.BUFFER_DYNAMIC:
                    glUsage = gl.DYNAMIC_DRAW;
                    break;
                case pc.gfx.BUFFER_STREAM:
                    glUsage = gl.STREAM_DRAW;
                    break;
            }

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufferId);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.storage, glUsage);
        }
    };

    return {
        IndexBuffer: IndexBuffer
    }; 
}());