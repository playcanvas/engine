/**
 * Constants for describing usage pattern of a vertex buffer.
 * @enum {number}
 */
pc.gfx.VertexBufferUsage = {
    /** The data store contents will be modified repeatedly and used many times. */
    DYNAMIC: 0,
    /** The data store contents will be modified once and used many times. */
    STATIC: 1
};

pc.extend(pc.gfx, function () {
    /**
     * @name pc.gfx.VertexBuffer
     * @class A vertex buffer is the mechanism via which the application specifies vertex 
     * data to the graphics hardware.
     * @param {pc.gfx.VertexFormat} format
     * @param {Number} numVertices
     */
    var VertexBuffer = function (format, numVertices, usage) {
        // Initialize optional parameters
        // By default, vertex buffers are static (better for performance since buffer data can be cached in VRAM)
        usage = usage || pc.gfx.VertexBufferUsage.STATIC;

        var gl = pc.gfx.Device.getCurrent().gl;
        
        this.usage = (usage === pc.gfx.VertexBufferUsage.DYNAMIC) ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
        
        // Store the vertex format
        this.format = format;

        // Store the number of vertices
        this.numVertices = numVertices;

        // Calculate the size
        this.numBytes = format.size * numVertices;

        // Create the WebGL program ID
        this.bufferId = gl.createBuffer();

        // Allocate the storage
        this.storage = new ArrayBuffer(this.numBytes);
    };

    /**
     * @function
     * @name pc.gfx.VertexBuffer#getFormat
     * @description Returns the data format of the specified vertex buffer.
     * @returns {pc.gfx.VertexFormat} The data format of the specified vertex buffer.
     * @author Will Eastcott
     */
    VertexBuffer.prototype.getFormat = function () {
        return this.format;
    };

    /**
     * @function
     * @name pc.gfx.VertexBuffer#getUsage
     * @description Returns the usage type of the specified vertex buffer. This indicates
     * whether the buffer can be written to once (pc.gfx.VertexBufferUsage.STATIC) or
     * multiple times (pc.gfx.VertexBufferUsage.DYNAMIC).
     * @returns {pc.gfx.VertexBufferUsage} The usage type of the vertex buffer.
     * @author Will Eastcott
     */
    VertexBuffer.prototype.getUsage = function () {
        return this.usage;
    };

    /**
     * @function
     * @name pc.gfx.VertexBuffer#getNumVertices
     * @description Returns the number of vertices stored in the specified vertex buffer.
     * @returns {number} The number of vertices stored in the vertex buffer.
     * @author Will Eastcott
     */
    VertexBuffer.prototype.getNumVertices = function () {
        return this.numVertices;
    };

    /**
     * @function
     * @name pc.gfx.VertexBuffer#lock
     * @description Returns a mapped memory block representing the content of the vertex buffer.
     * @returns {ArrayBuffer} An array containing the byte data stored in the vertex buffer.
     * @author Will Eastcott
     */
    VertexBuffer.prototype.lock = function () {
        return this.storage;
    };

    /**
     * @function
     * @name pc.gfx.VertexBuffer#unlock
     * @description Notifies the graphics engine that the client side copy of the vertex buffer's
     * memory can be returned to the control of the graphics driver.
     * @author Will Eastcott
     */
    VertexBuffer.prototype.unlock = function () {
        // Upload the new vertex data
        var gl = pc.gfx.Device.getCurrent().gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferId);
        gl.bufferData(gl.ARRAY_BUFFER, this.storage, this.usage);
    };

    return {
        VertexBuffer: VertexBuffer
    }; 
}());