/**
 * @enum {number}
 * @name pc.gfx.VertexElementType
 * @description Constants for primitive type.
 */
pc.gfx.VertexElementType = {
    INT8: 0,
    UINT8: 1,
    INT16: 2,
    UINT16: 3,
    INT32: 4,
    UINT32: 5,
    FLOAT32: 6
};

pc.extend(pc.gfx, function () {
    var _typeSize = [];
    _typeSize[pc.gfx.VertexElementType.INT8   ] = 1;
    _typeSize[pc.gfx.VertexElementType.UINT8  ] = 1;
    _typeSize[pc.gfx.VertexElementType.INT16  ] = 2;
    _typeSize[pc.gfx.VertexElementType.UINT16 ] = 2;
    _typeSize[pc.gfx.VertexElementType.INT32  ] = 4;
    _typeSize[pc.gfx.VertexElementType.UINT32 ] = 4;
    _typeSize[pc.gfx.VertexElementType.FLOAT32] = 4;

    /**
     * @name pc.gfx.VertexElement
     * @class An attribute stored in a vertex buffer. Positions, normals, texture coordinates
     * and vertex colors are all examples of vertex elements.
     * @param {String} name The name of the vertex element as referenced by any shaders.
     * @param {Number} numComponents The number of distinct components in this particular element.
     * @param {pc.gfx.VertexElementType} dataType The type of each element component.
     * @param {Boolean} normalize If true, map integer values to the range 0 to 1, otherwise leave
     * them unaltered. Defaults to false.
     */
    var VertexElement = function (name, numComponents, dataType, normalize) {
        // These will be initialized by the VertexFormat constructor
        this.offset = 0;
        this.stride = 0;

        // This is used by the graphics device to tag the associated stream
        this.stream = -1;

        // Resolve the ScopeId for the element name
        var device = pc.gfx.Device.getCurrent();
        this.scopeId = device.scope.resolve(name);

        // Store the data type information
        this.dataType      = dataType;
        this.numComponents = numComponents;

        this.normalize = (typeof normalize === 'undefined') ? false : normalize;

        // Calculate the size
        this.size = this.numComponents * _typeSize[this.dataType];
    };

    return {
        VertexElement: VertexElement
    }; 
}());