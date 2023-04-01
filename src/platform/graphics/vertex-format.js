import { Debug } from '../../core/debug.js';
import { hashCode } from '../../core/hash.js';

import { math } from '../../core/math/math.js';

import {
    SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_ATTR12, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15,
    SEMANTIC_COLOR, SEMANTIC_TANGENT, TYPE_FLOAT32, typedArrayTypesByteSize, vertexTypesNames
} from './constants.js';

/**
 * A vertex format is a descriptor that defines the layout of vertex data inside a
 * {@link VertexBuffer}.
 *
 * @property {object[]} elements The vertex attribute elements.
 * @property {string} elements[].name The meaning of the vertex element. This is used to link the
 * vertex data to a shader input. Can be:
 *
 * - {@link SEMANTIC_POSITION}
 * - {@link SEMANTIC_NORMAL}
 * - {@link SEMANTIC_TANGENT}
 * - {@link SEMANTIC_BLENDWEIGHT}
 * - {@link SEMANTIC_BLENDINDICES}
 * - {@link SEMANTIC_COLOR}
 * - {@link SEMANTIC_TEXCOORD0}
 * - {@link SEMANTIC_TEXCOORD1}
 * - {@link SEMANTIC_TEXCOORD2}
 * - {@link SEMANTIC_TEXCOORD3}
 * - {@link SEMANTIC_TEXCOORD4}
 * - {@link SEMANTIC_TEXCOORD5}
 * - {@link SEMANTIC_TEXCOORD6}
 * - {@link SEMANTIC_TEXCOORD7}
 *
 * If vertex data has a meaning other that one of those listed above, use the user-defined
 * semantics: {@link SEMANTIC_ATTR0} to {@link SEMANTIC_ATTR15}.
 * @property {number} elements[].numComponents The number of components of the vertex attribute.
 * Can be 1, 2, 3 or 4.
 * @property {number} elements[].dataType The data type of the attribute. Can be:
 *
 * - {@link TYPE_INT8}
 * - {@link TYPE_UINT8}
 * - {@link TYPE_INT16}
 * - {@link TYPE_UINT16}
 * - {@link TYPE_INT32}
 * - {@link TYPE_UINT32}
 * - {@link TYPE_FLOAT32}
 * @property {boolean} elements[].normalize If true, vertex attribute data will be mapped from a 0
 * to 255 range down to 0 to 1 when fed to a shader. If false, vertex attribute data is left
 * unchanged. If this property is unspecified, false is assumed.
 * @property {number} elements[].offset The number of initial bytes at the start of a vertex that
 * are not relevant to this attribute.
 * @property {number} elements[].stride The number of total bytes that are between the start of one
 * vertex, and the start of the next.
 * @property {number} elements[].size The size of the attribute in bytes.
 */
class VertexFormat {
    /**
     * Create a new VertexFormat instance.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
     * used to manage this vertex format.
     * @param {object[]} description - An array of vertex attribute descriptions.
     * @param {string} description[].semantic - The meaning of the vertex element. This is used to
     * link the vertex data to a shader input. Can be:
     *
     * - {@link SEMANTIC_POSITION}
     * - {@link SEMANTIC_NORMAL}
     * - {@link SEMANTIC_TANGENT}
     * - {@link SEMANTIC_BLENDWEIGHT}
     * - {@link SEMANTIC_BLENDINDICES}
     * - {@link SEMANTIC_COLOR}
     * - {@link SEMANTIC_TEXCOORD0}
     * - {@link SEMANTIC_TEXCOORD1}
     * - {@link SEMANTIC_TEXCOORD2}
     * - {@link SEMANTIC_TEXCOORD3}
     * - {@link SEMANTIC_TEXCOORD4}
     * - {@link SEMANTIC_TEXCOORD5}
     * - {@link SEMANTIC_TEXCOORD6}
     * - {@link SEMANTIC_TEXCOORD7}
     *
     * If vertex data has a meaning other that one of those listed above, use the user-defined
     * semantics: {@link SEMANTIC_ATTR0} to {@link SEMANTIC_ATTR15}.
     * @param {number} description[].components - The number of components of the vertex attribute.
     * Can be 1, 2, 3 or 4.
     * @param {number} description[].type - The data type of the attribute. Can be:
     *
     * - {@link TYPE_INT8}
     * - {@link TYPE_UINT8}
     * - {@link TYPE_INT16}
     * - {@link TYPE_UINT16}
     * - {@link TYPE_INT32}
     * - {@link TYPE_UINT32}
     * - {@link TYPE_FLOAT32}
     *
     * @param {boolean} [description[].normalize] - If true, vertex attribute data will be mapped
     * from a 0 to 255 range down to 0 to 1 when fed to a shader. If false, vertex attribute data
     * is left unchanged. If this property is unspecified, false is assumed.
     * @param {number} [vertexCount] - When specified, vertex format will be set up for
     * non-interleaved format with a specified number of vertices. (example: PPPPNNNNCCCC), where
     * arrays of individual attributes will be stored one right after the other (subject to
     * alignment requirements). Note that in this case, the format depends on the number of
     * vertices, and needs to change when the number of vertices changes. When not specified,
     * vertex format will be interleaved. (example: PNCPNCPNCPNC).
     * @example
     * // Specify 3-component positions (x, y, z)
     * const vertexFormat = new pc.VertexFormat(graphicsDevice, [
     *     { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 }
     * ]);
     * @example
     * // Specify 2-component positions (x, y), a texture coordinate (u, v) and a vertex color (r, g, b, a)
     * const vertexFormat = new pc.VertexFormat(graphicsDevice, [
     *     { semantic: pc.SEMANTIC_POSITION, components: 2, type: pc.TYPE_FLOAT32 },
     *     { semantic: pc.SEMANTIC_TEXCOORD0, components: 2, type: pc.TYPE_FLOAT32 },
     *     { semantic: pc.SEMANTIC_COLOR, components: 4, type: pc.TYPE_UINT8, normalize: true }
     * ]);
     */
    constructor(graphicsDevice, description, vertexCount) {
        this.device = graphicsDevice;
        this._elements = [];
        this.hasUv0 = false;
        this.hasUv1 = false;
        this.hasColor = false;
        this.hasTangents = false;
        this.verticesByteSize = 0;
        this.vertexCount = vertexCount;
        this.interleaved = vertexCount === undefined;

        // true if the vertex format represents an instancing vertex buffer
        this.instancing = false;

        // calculate total size of the vertex
        this.size = description.reduce((total, desc) => {
            return total + Math.ceil(desc.components * typedArrayTypesByteSize[desc.type] / 4) * 4;
        }, 0);

        let offset = 0, elementSize;
        for (let i = 0, len = description.length; i < len; i++) {
            const elementDesc = description[i];

            elementSize = elementDesc.components * typedArrayTypesByteSize[elementDesc.type];

            // WebGPU has limited element size support (for example uint16x3 is not supported)
            Debug.assert(!graphicsDevice.isWebGPU || [2, 4, 8, 12, 16].includes(elementSize),
                         `WebGPU does not support the format of vertex element ${elementDesc.semantic} : ${vertexTypesNames[elementDesc.type]} x ${elementDesc.components}`);

            // align up the offset to elementSize (when vertexCount is specified only - case of non-interleaved format)
            if (vertexCount) {
                offset = math.roundUp(offset, elementSize);

                // non-interleaved format with elementSize not multiple of 4 might be slower on some platforms - padding is recommended to align its size
                // example: use 4 x TYPE_UINT8 instead of 3 x TYPE_UINT8
                Debug.assert((elementSize % 4) === 0,
                             `Non-interleaved vertex format with element size not multiple of 4 can have performance impact on some platforms. Element size: ${elementSize}`);
            }

            const element = {
                name: elementDesc.semantic,
                offset: (vertexCount ? offset : (elementDesc.hasOwnProperty('offset') ? elementDesc.offset : offset)),
                stride: (vertexCount ? elementSize : (elementDesc.hasOwnProperty('stride') ? elementDesc.stride : this.size)),
                dataType: elementDesc.type,
                numComponents: elementDesc.components,
                normalize: elementDesc.normalize ?? false,
                size: elementSize
            };
            this._elements.push(element);

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

        this._evaluateHash();
    }

    get elements() {
        return this._elements;
    }

    /**
     * @type {VertexFormat}
     * @private
     */
    static _defaultInstancingFormat = null;

    /**
     * The {@link VertexFormat} used to store matrices of type {@link Mat4} for hardware instancing.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
     * used to create this vertex format.
     *
     * @returns {VertexFormat} The default instancing vertex format.
     */
    static getDefaultInstancingFormat(graphicsDevice) {

        if (!VertexFormat._defaultInstancingFormat) {
            VertexFormat._defaultInstancingFormat = new VertexFormat(graphicsDevice, [
                { semantic: SEMANTIC_ATTR12, components: 4, type: TYPE_FLOAT32 },
                { semantic: SEMANTIC_ATTR13, components: 4, type: TYPE_FLOAT32 },
                { semantic: SEMANTIC_ATTR14, components: 4, type: TYPE_FLOAT32 },
                { semantic: SEMANTIC_ATTR15, components: 4, type: TYPE_FLOAT32 }
            ]);
        }

        return VertexFormat._defaultInstancingFormat;
    }

    /**
     * Applies any changes made to the VertexFormat's properties.
     *
     * @private
     */
    update() {
        // Note that this is used only by vertex attribute morphing on the WebGL.
        Debug.assert(!this.device.isWebGPU, `VertexFormat#update is not supported on WebGPU and VertexFormat cannot be modified.`);
        this._evaluateHash();
    }

    /**
     * Evaluates hash values for the format allowing fast compare of batching / rendering compatibility.
     *
     * @private
     */
    _evaluateHash() {
        let stringElementBatch;
        const stringElementsBatch = [];
        let stringElementRender;
        const stringElementsRender = [];
        const len = this._elements.length;
        for (let i = 0; i < len; i++) {
            const element = this._elements[i];

            // create string description of each element that is relevant for batching
            stringElementBatch = element.name;
            stringElementBatch += element.dataType;
            stringElementBatch += element.numComponents;
            stringElementBatch += element.normalize;
            stringElementsBatch.push(stringElementBatch);

            // create string description of each element that is relevant for rendering
            stringElementRender = stringElementBatch;
            stringElementRender += element.offset;
            stringElementRender += element.stride;
            stringElementRender += element.size;
            stringElementsRender.push(stringElementRender);
        }

        // sort batching ones alphabetically to make the hash order independent
        stringElementsBatch.sort();
        this.batchingHash = hashCode(stringElementsBatch.join());

        // rendering hash
        this.renderingHashString = stringElementsRender.join('_');
        this.renderingHash = hashCode(this.renderingHashString);
    }
}

export { VertexFormat };
