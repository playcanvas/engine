import { hashCode } from '../core/hash.js';
import { 
    SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5,
    SEMANTIC_COLOR, SEMANTIC_TANGENT, TYPE_FLOAT32, typedArrayTypesByteSize
} from './graphics.js';

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
 * @param {number} [vertexCount] - When specified, vertex format will be set up for non-interleaved format with a specified
 * number of vertices. (example: PPPPNNNNCCCC), where arrays of individual attributes will be stored one right after the other (subject to alignment requirements).
 * Note that in this case, the format depends on the number of vertices, and needs to change when the number of vertices changes.
 * When not specified, vertex format will be interleaved. (example: PNCPNCPNCPNC)
 * @property {object[]} elements The vertex attribute elements.
 * @property {string} elements[].name The meaning of the vertex element. This is used to link
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
 * @property {number} elements[].numComponents The number of components of the vertex attribute.
 * Can be 1, 2, 3 or 4.
 * @property {number} elements[].dataType The data type of the attribute. Can be:
 *
 * * {@link pc.TYPE_INT8}
 * * {@link pc.TYPE_UINT8}
 * * {@link pc.TYPE_INT16}
 * * {@link pc.TYPE_UINT16}
 * * {@link pc.TYPE_INT32}
 * * {@link pc.TYPE_UINT32}
 * * {@link pc.TYPE_FLOAT32}
 * @property {boolean} elements[].normalize If true, vertex attribute data will be mapped from a
 * 0 to 255 range down to 0 to 1 when fed to a shader. If false, vertex attribute data is left
 * unchanged. If this property is unspecified, false is assumed.
 * @property {number} elements[].offset The number of initial bytes at the start of a vertex that are not relevant to this attribute.
 * @property {number} elements[].stride The number of total bytes that are between the start of one vertex, and the start of the next.
 * @property {pc.ScopeId} elements[].scopeId The shader input variable corresponding to the attribute.
 * @property {number} elements[].size The size of the attribute in bytes.
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
function VertexFormat(graphicsDevice, description, vertexCount) {
    var i, len, element;

    this.elements = [];
    this.hasUv0 = false;
    this.hasUv1 = false;
    this.hasColor = false;
    this.hasTangents = false;
    this._defaultInstancingFormat = null;
    this.verticesByteSize = 0;
    this.vertexCount = vertexCount;
    this.interleaved = !vertexCount;

    // calculate total size of the vertex
    this.size = description.reduce(function (total, desc) {
        return total + Math.ceil(desc.components * typedArrayTypesByteSize[desc.type] / 4) * 4;
    }, 0);

    var offset = 0, elementSize;
    for (i = 0, len = description.length; i < len; i++) {
        var elementDesc = description[i];

        // align up the offset to elementSize (when vertexCount is specified only - case of non-interleaved format)
        elementSize = elementDesc.components * typedArrayTypesByteSize[elementDesc.type];
        if (vertexCount) {
            offset = pc.math.roundUp(offset, elementSize);

            // #ifdef DEBUG
            // non-interleaved format with elementSize not multiple of 4 might be slower on some platforms - padding is recommended to align its size
            // example: use 4 x TYPE_UINT8 instead of 3 x TYPE_UINT8
            if ( (elementSize % 4) !== 0)
                console.warn("Non-interleaved vertex format with element size not multiple of 4 can have performance impact on some platforms. Element size: " + elementSize);
            // #endif
        }

        element = {
            name: elementDesc.semantic,
            offset: (vertexCount ? offset : (elementDesc.hasOwnProperty('offset') ? elementDesc.offset : offset)),
            stride: (vertexCount ? elementSize : (elementDesc.hasOwnProperty('stride') ? elementDesc.stride : this.size)),
            stream: -1,
            scopeId: graphicsDevice.scope.resolve(elementDesc.semantic),
            dataType: elementDesc.type,
            numComponents: elementDesc.components,
            normalize: (elementDesc.normalize === undefined) ? false : elementDesc.normalize,
            size: elementSize
        };
        this.elements.push(element);

        if (vertexCount) {
            offset += elementSize * vertexCount;
        } else {
            offset += Math.ceil(elementSize / 4) * 4;
        }

        if (elementDesc.semantic === SEMANTIC_TEXCOORD0) {
            this.hasUv0 = true;
        } else if (elementDesc.semantic === SEMANTIC_TEXCOORD1) {
            this.hasUv1 = true;
        } else if (elementDesc.semantic === SEMANTIC_COLOR) {
            this.hasColor = true;
        } else if (elementDesc.semantic === SEMANTIC_TANGENT) {
            this.hasTangents = true;
        }
    }

    if (vertexCount) {
        this.verticesByteSize = offset;
    }

    this.batchingHash = this._evaluateBatchingHash();
}

VertexFormat.init = function (graphicsDevice) {
    var formatDesc = [
        { semantic: SEMANTIC_TEXCOORD2, components: 4, type: TYPE_FLOAT32 },
        { semantic: SEMANTIC_TEXCOORD3, components: 4, type: TYPE_FLOAT32 },
        { semantic: SEMANTIC_TEXCOORD4, components: 4, type: TYPE_FLOAT32 },
        { semantic: SEMANTIC_TEXCOORD5, components: 4, type: TYPE_FLOAT32 }
    ];

    this._defaultInstancingFormat = new VertexFormat(graphicsDevice, formatDesc);
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

Object.assign(VertexFormat.prototype, {

    // evaluates hash value for the format allowing fast compare of batching compatibility
    _evaluateBatchingHash: function () {

        // create string description of each element that is relevant for batching
        var stringElement, stringElements = [];
        var i, len = this.elements.length, element;
        for (i = 0; i < len; i++) {
            element = this.elements[i];

            stringElement = element.name;
            stringElement += element.dataType;
            stringElement += element.numComponents;
            stringElement += element.normalize;

            stringElements.push(stringElement);
        }

        // sort them alphabetically to make hash order independent
        stringElements.sort();

        return hashCode(stringElements.join());
    }
});

export { VertexFormat };