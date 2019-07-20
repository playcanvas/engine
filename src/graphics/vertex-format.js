Object.assign(pc, function () {
    'use strict';

    var _typeSize = [];
    _typeSize[pc.TYPE_INT8] = 1;
    _typeSize[pc.TYPE_UINT8] = 1;
    _typeSize[pc.TYPE_INT16] = 2;
    _typeSize[pc.TYPE_UINT16] = 2;
    _typeSize[pc.TYPE_INT32] = 4;
    _typeSize[pc.TYPE_UINT32] = 4;
    _typeSize[pc.TYPE_FLOAT32] = 4;

    /**
     * @constructor
     * @name pc.VertexFormat
     * @classdesc A vertex format is a descriptor that defines the layout of vertex data inside
     * a {@link pc.VertexBuffer}.
     * @description Returns a new pc.VertexFormat object.
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device used to manage this vertex format.
     * @param {Object[]} description An array of vertex attribute descriptions.
     * @param {Number} description[].semantic The meaning of the vertex element. This is used to link
     * the vertex data to a shader input. Can be:
     * <ul>
     *     <li>pc.SEMANTIC_POSITION</li>
     *     <li>pc.SEMANTIC_NORMAL</li>
     *     <li>pc.SEMANTIC_TANGENT</li>
     *     <li>pc.SEMANTIC_BLENDWEIGHT</li>
     *     <li>pc.SEMANTIC_BLENDINDICES</li>
     *     <li>pc.SEMANTIC_COLOR</li>
     *     <li>pc.SEMANTIC_TEXCOORD0</li>
     *     <li>pc.SEMANTIC_TEXCOORD1</li>
     *     <li>pc.SEMANTIC_TEXCOORD2</li>
     *     <li>pc.SEMANTIC_TEXCOORD3</li>
     *     <li>pc.SEMANTIC_TEXCOORD4</li>
     *     <li>pc.SEMANTIC_TEXCOORD5</li>
     *     <li>pc.SEMANTIC_TEXCOORD6</li>
     *     <li>pc.SEMANTIC_TEXCOORD7</li>
     * </ul>
     * If vertex data has a meaning other that one of those listed above, use the user-defined
     * semantics: pc.SEMANTIC_ATTR0 to pc.SEMANTIC_ATTR15.
     * @param {Number} description[].components The number of components of the vertex attribute.
     * Can be 1, 2, 3 or 4.
     * @param {Number} description[].type The data type of the attribute. Can be:
     * <ul>
     *     <li>pc.TYPE_INT8</li>
     *     <li>pc.TYPE_UINT8</li>
     *     <li>pc.TYPE_INT16</li>
     *     <li>pc.TYPE_UINT16</li>
     *     <li>pc.TYPE_INT32</li>
     *     <li>pc.TYPE_UINT32</li>
     *     <li>pc.TYPE_FLOAT32</li>
     * </ul>
     * @param {Boolean} description[].normalize If true, vertex attribute data will be mapped from a
     * 0 to 255 range down to 0 to 1 when fed to a shader. If false, vertex attribute data is left
     * unchanged. If this property is unspecified, false is assumed.
     * @example
     * // Specify 3-component positions (x, y, z)
     * var vertexFormat = new pc.VertexFormat(graphicsDevice, [
     *     { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
     * ]);
     * @example
     * // Specify 2-component positions (x, y), a texture coordinate (u, v) and a vertex color (r, g, b, a)
     * var vertexFormat = new pc.VertexFormat(graphicsDevice, [
     *     { semantic: pc.SEMANTIC_POSITION, components: 2, type: pc.TYPE_FLOAT32 },
     *     { semantic: pc.SEMANTIC_TEXCOORD0, components: 2, type: pc.TYPE_FLOAT32 },
     *     { semantic: pc.SEMANTIC_COLOR, components: 4, type: pc.TYPE_UINT8, normalize: true }
     * ]);
     */
    var VertexFormat = function (graphicsDevice, description) {
        var i, len, element;

        this.elements = [];
        this.hasUv0 = false;
        this.hasUv1 = false;
        this.hasColor = false;
        this.hasTangents = false;

        this.size = 0;
        for (i = 0, len = description.length; i < len; i++) {
            var elementDesc = description[i];
            element = {
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
            // This buffer will be accessed by a Float32Array and so must be 4 byte aligned
            this.size += Math.ceil(element.size / 4) * 4;
            if (elementDesc.semantic === pc.SEMANTIC_TEXCOORD0) {
                this.hasUv0 = true;
            } else if (elementDesc.semantic === pc.SEMANTIC_TEXCOORD1) {
                this.hasUv1 = true;
            } else if (elementDesc.semantic === pc.SEMANTIC_COLOR) {
                this.hasColor = true;
            } else if (elementDesc.semantic === pc.SEMANTIC_TANGENT) {
                this.hasTangents = true;
            }
        }

        var offset = 0;
        for (i = 0, len = this.elements.length; i < len; i++) {
            element = this.elements[i];

            element.offset = offset;
            element.stride = this.size;

            offset += element.size;
        }
    };

    return {
        VertexFormat: VertexFormat
    };
}());
