pc.extend(pc, function () {
    'use strict';

    var _typeSize = [];
    _typeSize[pc.ELEMENTTYPE_INT8   ] = 1;
    _typeSize[pc.ELEMENTTYPE_UINT8  ] = 1;
    _typeSize[pc.ELEMENTTYPE_INT16  ] = 2;
    _typeSize[pc.ELEMENTTYPE_UINT16 ] = 2;
    _typeSize[pc.ELEMENTTYPE_INT32  ] = 4;
    _typeSize[pc.ELEMENTTYPE_UINT32 ] = 4;
    _typeSize[pc.ELEMENTTYPE_FLOAT32] = 4;

    /**
     * @name pc.VertexFormat
     * @class A vertex format is a descriptor that defines the layout of vertex element data inside
     * a pc.VertexBuffer object.
     * @constructor Returns a new pc.VertexFormat object. It is constructed from a description
     * that explicitly defines how data is to be laid out inside a vertex buffer (pc.VertexBuffer).
     * The description is defined as an array of elements, where each element is an object with the
     * following properties:
     *   semantic: pc.SEMANTIC_.
     *   components: the number of components used by the element.
     *   type: (pc.ELEMENTTYPE_).
     *   normalize: true to remap element values to a range of 0 to 1. Defaults to false.
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device used to manage this vertex format.
     * @param {Array} description An array of vertex element descriptions.
     * @example
     * var vertexFormat = new pc.VertexFormat(graphicsDevice, [
     *     { semantic: pc.SEMANTIC_POSITION, components: 2, type: pc.ELEMENTTYPE_FLOAT32 },
     *     { semantic: pc.SEMANTIC_TEXCOORD0, components: 2, type: pc.ELEMENTTYPE_FLOAT32 },
     *     { semantic: pc.SEMANTIC_COLOR, components: 4, type: pc.ELEMENTTYPE_UINT8, normalize: true }
     * ]);
     *
     * @author Will Eastcott
     */
    var VertexFormat = function (graphicsDevice, description) {
        var i;

        this.elements = [];
        this.hasUv1 = false;
        this.hasColor = false;

        this.size = 0;
        for (var i = 0, len = description.length; i < len; i++) {
            var elementDesc = description[i];
            var element = {
                name: elementDesc.semantic,
                offset: 0,
                stride: 0,
                stream: -1,
                scopeId: graphicsDevice.scope.resolve(elementDesc.semantic),
                dataType: elementDesc.type,
                numComponents: elementDesc.components,
                normalize: (elementDesc.normalize === undefined) ? false : elementDesc.normalize,
                size: elementDesc.components * _typeSize[elementDesc.type]
            };
            this.elements.push(element);

            this.size += element.size;
            if (elementDesc.semantic===pc.SEMANTIC_TEXCOORD1) {
                this.hasUv1 = true;
            } else if (elementDesc.semantic===pc.SEMANTIC_COLOR) {
                this.hasColor = true;
            }
        }

        var offset = 0;
        for (var i = 0, len = this.elements.length; i < len; i++) {
            var element = this.elements[i];

            element.offset = offset;
            element.stride = this.size;

            offset += element.size;
        }
    };

    return {
        VertexFormat: VertexFormat
    };
}());
