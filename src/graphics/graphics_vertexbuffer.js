pc.extend(pc.gfx, function () {
    /**
     * @name pc.gfx.VertexBuffer
     * @class A vertex buffer is the mechanism via which the application specifies vertex 
     * data to the graphics hardware.
     * @param {pc.gfx.VertexFormat} format The vertex format of this vertex buffer.
     * @param {Number} numVertices The number of vertices that this vertex buffer will hold.
     * @param {Number} [usage] The usage type of the vertex buffer (see pc.gfx.BUFFER_*).
     */
    var VertexBuffer = function (format, numVertices, usage) {
        // Initialize optional parameters
        // By default, vertex buffers are static (better for performance since buffer data can be cached in VRAM)
        this.usage = usage || pc.gfx.BUFFER_STATIC;

        // Store the vertex format
        this.format = format;

        // Store the number of vertices
        this.numVertices = numVertices;

        // Calculate the size
        this.numBytes = format.size * numVertices;

        // Create the WebGL program ID
        this.gl = pc.gfx.Device.getCurrent().gl;

        var gl = this.gl;
        this.bufferId = gl.createBuffer();

        // Allocate the storage
        this.storage = new ArrayBuffer(this.numBytes);
    };

    VertexBuffer.prototype = {
        /**
         * @function
         * @name pc.gfx.VertexBuffer#destroy
         * @description Frees resources associated with this vertex buffer.
         * @author Will Eastcott
         */
        destroy: function () {
            var gl = this.gl;
            gl.deleteBuffer(this.bufferId);
        },

        /**
         * @function
         * @name pc.gfx.VertexBuffer#getFormat
         * @description Returns the data format of the specified vertex buffer.
         * @returns {pc.gfx.VertexFormat} The data format of the specified vertex buffer.
         * @author Will Eastcott
         */
        getFormat: function () {
            return this.format;
        },

        /**
         * @function
         * @name pc.gfx.VertexBuffer#getUsage
         * @description Returns the usage type of the specified vertex buffer. This indicates
         * whether the buffer can be modified once and used many times (pc.gfx.BUFFER_STATIC), 
         * modified repeatedly and used many times (pc.gfx.BUFFER_DYNAMIC) or modified once 
         * and used at most a few times (pc.gfx.BUFFER_STREAM).
         * @returns {Number} The usage type of the vertex buffer (see pc.gfx.BUFFER_*).
         * @author Will Eastcott
         */
        getUsage: function () {
            return this.usage;
        },

        /**
         * @function
         * @name pc.gfx.VertexBuffer#getNumVertices
         * @description Returns the number of vertices stored in the specified vertex buffer.
         * @returns {number} The number of vertices stored in the vertex buffer.
         * @author Will Eastcott
         */
        getNumVertices: function () {
            return this.numVertices;
        },

        /**
         * @function
         * @name pc.gfx.VertexBuffer#lock
         * @description Returns a mapped memory block representing the content of the vertex buffer.
         * @returns {ArrayBuffer} An array containing the byte data stored in the vertex buffer.
         * @author Will Eastcott
         */
        lock: function () {
            return this.storage;
        },

        /**
         * @function
         * @name pc.gfx.VertexBuffer#unlock
         * @description Notifies the graphics engine that the client side copy of the vertex buffer's
         * memory can be returned to the control of the graphics driver.
         * @author Will Eastcott
         */
        unlock: function () {
            // Upload the new vertex data
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

            gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferId);
            gl.bufferData(gl.ARRAY_BUFFER, this.storage, glUsage);
        }
    };

    return {
        VertexBuffer: VertexBuffer
    }; 
}());