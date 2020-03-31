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
     * @interface
     * @name pc.VertexAttributeElement
     * @description Interface of a vertex attribute element in {@link pc.VertexFormat}.
     */
    var VertexAttributeElement = function () {
        /**
         * @name pc.VertexAttributeElement#name
         * @type {string}
         * @description The meaning of the vertex element. This is used to link
         * the vertex data to a shader input. Can be:
         *
         * * {@link pc.SEMANTIC_POSITION}
         * * {@link pc.SEMANTIC_NORMAL}
         * * {@link pc.SEMANTIC_TANGENT}
         * * {@link pc.SEMANTIC_BLENDWEIGHT}
         * * {@link pc.SEMANTIC_BLENDINDICES}
         * * {@link pc.SEMANTIC_COLOR}
         * * {@link pc.SEMANTIC_TEXCOORD0}
         * * {@link pc.SEMANTIC_TEXCOORD1}
         * * {@link pc.SEMANTIC_TEXCOORD2}
         * * {@link pc.SEMANTIC_TEXCOORD3}
         * * {@link pc.SEMANTIC_TEXCOORD4}
         * * {@link pc.SEMANTIC_TEXCOORD5}
         * * {@link pc.SEMANTIC_TEXCOORD6}
         * * {@link pc.SEMANTIC_TEXCOORD7}
         *
         * If vertex data has a meaning other that one of those listed above, use the user-defined
         * semantics: pc.SEMANTIC_ATTR0 to pc.SEMANTIC_ATTR15.
         */

        /**
         * @name pc.VertexAttributeElement#numComponents
         * @type {number}
         * @description The number of components of the vertex attribute.
         * Can be 1, 2, 3 or 4.
         */

        /**
         * @name pc.VertexAttributeElement#dataType
         * @type {number}
         * @description The data type of the attribute. Can be:
         *
         * * {@link pc.TYPE_INT8}
         * * {@link pc.TYPE_UINT8}
         * * {@link pc.TYPE_INT16}
         * * {@link pc.TYPE_UINT16}
         * * {@link pc.TYPE_INT32}
         * * {@link pc.TYPE_UINT32}
         * * {@link pc.TYPE_FLOAT32}
         */

        /**
         * @name pc.VertexAttributeElement#normalize
         * @type {boolean}
         * @description If true, vertex attribute data will be mapped from a
         * 0 to 255 range down to 0 to 1 when fed to a shader. If false, vertex attribute data is left
         * unchanged. If this property is unspecified, false is assumed.
         */

        /**
         * @name pc.VertexAttributeElement#offset
         * @type {number}
         * @description The number of initial bytes at the start of a vertex that are not relevant to this attribute.
         */

        /**
         * @name pc.VertexAttributeElement#stride
         * @type {number}
         * @description The number of total bytes that are between the start of one vertex, and the start of the next.
         */

        /**
         * @name pc.VertexAttributeElement#scopeId
         * @type {pc.ScopeId}
         * @description The shader input variable corresponding to the attribute.
         */

        /**
         * @name pc.VertexAttributeElement#size
         * @type {number}
         * @description The size of the attribute in bytes.
         */
    };

    /**
     * @class
     * @name pc.VertexFormat
     * @classdesc A vertex format is a descriptor that defines the layout of vertex data inside
     * a {@link pc.VertexBuffer}.
     * @description Returns a new pc.VertexFormat object.
     * @param {pc.GraphicsDevice} graphicsDevice - The graphics device used to manage this vertex format.
     * @param {object[]} description - An array of vertex attribute descriptions.
     * @param {string} description[].semantic - The meaning of the vertex element. This is used to link
     * the vertex data to a shader input. Can be:
     *
     * * {@link pc.SEMANTIC_POSITION}
     * * {@link pc.SEMANTIC_NORMAL}
     * * {@link pc.SEMANTIC_TANGENT}
     * * {@link pc.SEMANTIC_BLENDWEIGHT}
     * * {@link pc.SEMANTIC_BLENDINDICES}
     * * {@link pc.SEMANTIC_COLOR}
     * * {@link pc.SEMANTIC_TEXCOORD0}
     * * {@link pc.SEMANTIC_TEXCOORD1}
     * * {@link pc.SEMANTIC_TEXCOORD2}
     * * {@link pc.SEMANTIC_TEXCOORD3}
     * * {@link pc.SEMANTIC_TEXCOORD4}
     * * {@link pc.SEMANTIC_TEXCOORD5}
     * * {@link pc.SEMANTIC_TEXCOORD6}
     * * {@link pc.SEMANTIC_TEXCOORD7}
     *
     * If vertex data has a meaning other that one of those listed above, use the user-defined
     * semantics: pc.SEMANTIC_ATTR0 to pc.SEMANTIC_ATTR15.
     * @param {number} description[].components - The number of components of the vertex attribute.
     * Can be 1, 2, 3 or 4.
     * @param {number} description[].type - The data type of the attribute. Can be:
     *
     * * {@link pc.TYPE_INT8}
     * * {@link pc.TYPE_UINT8}
     * * {@link pc.TYPE_INT16}
     * * {@link pc.TYPE_UINT16}
     * * {@link pc.TYPE_INT32}
     * * {@link pc.TYPE_UINT32}
     * * {@link pc.TYPE_FLOAT32}
     *
     * @param {boolean} [description[].normalize] - If true, vertex attribute data will be mapped from a
     * 0 to 255 range down to 0 to 1 when fed to a shader. If false, vertex attribute data is left
     * unchanged. If this property is unspecified, false is assumed.
     * @property {pc.VertexAttributeElement[]} elements The vertex attribute elements.
     * @example
     * // Specify 3-component positions (x, y, z)
     * var vertexFormat = new pc.VertexFormat(graphicsDevice, [
     *     { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 }
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
        this._defaultInstancingFormat = null;

        // calculate total size
        this.size = description.reduce(function (total, desc) {
            return total + Math.ceil(desc.components * _typeSize[desc.type] / 4) * 4;
        }, 0);

        var offset = 0;
        for (i = 0, len = description.length; i < len; i++) {
            var elementDesc = description[i];
            element = {
                name: elementDesc.semantic,
                offset: elementDesc.hasOwnProperty('offset') ? elementDesc.offset : offset,
                stride: elementDesc.hasOwnProperty('stride') ? elementDesc.stride : this.size,
                stream: -1,
                scopeId: graphicsDevice.scope.resolve(elementDesc.semantic),
                dataType: elementDesc.type,
                numComponents: elementDesc.components,
                normalize: (elementDesc.normalize === undefined) ? false : elementDesc.normalize,
                size: elementDesc.components * _typeSize[elementDesc.type]
            };
            this.elements.push(element);
            offset += Math.ceil(element.size / 4) * 4;

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
    };

    VertexFormat.init = function (graphicsDevice) {
        var formatDesc = [
            { semantic: pc.SEMANTIC_TEXCOORD2, components: 4, type: pc.TYPE_FLOAT32 },
            { semantic: pc.SEMANTIC_TEXCOORD3, components: 4, type: pc.TYPE_FLOAT32 },
            { semantic: pc.SEMANTIC_TEXCOORD4, components: 4, type: pc.TYPE_FLOAT32 },
            { semantic: pc.SEMANTIC_TEXCOORD5, components: 4, type: pc.TYPE_FLOAT32 }
        ];

        this._defaultInstancingFormat = new pc.VertexFormat(graphicsDevice, formatDesc);
    };

    /**
     * @field
     * @static
     * @readonly
     * @name pc.VertexFormat.defaultInstancingFormat
     * @type {pc.VertexFormat}
     * @description Returns {@link pc.VertexFormat} used to store matrices of type {@link pc.Mat4} for hardware instancing.
     */
    Object.defineProperty(VertexFormat, 'defaultInstancingFormat', {
        get: (function () {
            return function () {
                return this._defaultInstancingFormat;
            };
        }())
    });

    return {
        VertexAttributeElement: VertexAttributeElement,
        VertexFormat: VertexFormat
    };
}());
