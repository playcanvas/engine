/**
 * Constants for index buffer data format.
 * @enum {number}
 */
pc.gfx.IndexFormat = {
    /** 8-bit unsigned per index. */
    UINT8: 0,
    /** 16-bit unsigned per index. */
    UINT16: 1
};

pc.extend(pc.gfx, function () {
    /**
     * @name pc.gfx.IndexBuffer
     * @class An index buffer is the mechanism via which the application specifies vertex 
     * index data to the graphics hardware.
     * @param {pc.gfx.IndexFormat} format The type of each index to be stored in the index buffer.
     * @param {Number} numIndices The number of indices to be stored in the index buffer.
     */
    var IndexBuffer = function (format, numIndices) {
        // Store the index format
        this.format = format;

        // Store the number of indicies
        this.numIndices = numIndices;

        // Calculate the size
        var bytesPerIndex = (format === pc.gfx.IndexFormat.UINT8) ? 1 : 2;
        this.numBytes = this.numIndices * bytesPerIndex;

        // Create the WebGL program ID
        var gl = pc.gfx.Device.getCurrent().gl;
        this.bufferId = gl.createBuffer();

        // Allocate the storage
        this.storage = new ArrayBuffer(this.numBytes);
        this.typedStorage = (format === pc.gfx.IndexFormat.UINT8) ?
                                new Uint8Array(this.storage) :
                                new Uint16Array(this.storage);
    };

    /**
     * @function
     * @name pc.gfx.IndexBuffer#getFormat
     * @description Returns the data format of the specified index buffer.
     * @returns {pc.gfx.IndexFormat} The data format of the specified index buffer.
     * @author Will Eastcott
     */
    IndexBuffer.prototype.getFormat = function () {
        return this.format;
    };

    /**
     * @function
     * @name pc.gfx.IndexBuffer#getNumIndices
     * @description Returns the number of indices stored in the specified index buffer.
     * @returns {Number} The number of indices stored in the specified index buffer.
     * @author Will Eastcott
     */
    IndexBuffer.prototype.getNumIndices = function () {
        return this.numIndices;
    };

    /**
     * @function
     * @name pc.gfx.IndexBuffer#lock
     * @description Gives access to the block of memory that stores the buffer's indices.
     * @returns {ArrayBuffer} A contiguous block of memory where index data can be written to.
     * @author Will Eastcott
     */
    IndexBuffer.prototype.lock = function () {
        return this.storage;
    };

    /**
     * @function
     * @name pc.gfx.IndexBuffer#unlock
     * @description Signals that the block of memory returned by a call to the lock function is 
     * ready to be given to the graphics hardware. Only unlocked index buffers can be set on the 
     * currently active device.
     * @author Will Eastcott
     */
    IndexBuffer.prototype.unlock = function () {
        // Upload the new index data
        var gl = pc.gfx.Device.getCurrent().gl;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufferId);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.typedStorage, gl.STATIC_DRAW);
    };

    return {
        IndexBuffer: IndexBuffer
    }; 
}());