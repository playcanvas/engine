/**
 * @private
 * @name pc.gfx.VertexElementType
 * @description DEPRECATED. Constants for primitive type.
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
    _typeSize[pc.gfx.ELEMENTTYPE_INT8   ] = 1;
    _typeSize[pc.gfx.ELEMENTTYPE_UINT8  ] = 1;
    _typeSize[pc.gfx.ELEMENTTYPE_INT16  ] = 2;
    _typeSize[pc.gfx.ELEMENTTYPE_UINT16 ] = 2;
    _typeSize[pc.gfx.ELEMENTTYPE_INT32  ] = 4;
    _typeSize[pc.gfx.ELEMENTTYPE_UINT32 ] = 4;
    _typeSize[pc.gfx.ELEMENTTYPE_FLOAT32] = 4;

    /**
     * @name pc.gfx.VertexElement
     * @class An attribute stored in a vertex buffer. Positions, normals, texture coordinates
     * and vertex colors are all examples of vertex elements.
     * @param {String} semantic The semantic of the vertex element (see pc.gfx.SEMANTIC_*).
     * @param {Number} numComponents The number of distinct components in this particular element.
     * @param {pc.gfx.VertexElementType} dataType The type of each element component.
     * @param {Boolean} normalize If true, map integer values to the range 0 to 1, otherwise leave
     * them unaltered. Defaults to false.
     */
    var VertexElement = function (semantic, numComponents, dataType, normalize) {
        this.name = semantic;

        // These will be initialized by the VertexFormat constructor
        this.offset = 0;
        this.stride = 0;

        // This is used by the graphics device to tag the associated stream
        this.stream = -1;

        // Initialize scope id to something sensible
        this.scopeId = null; // Initialized when setting vertex buffer in the graphics device

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