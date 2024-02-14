import { Debug } from '../../core/debug.js';
import { hashCode } from '../../core/hash.js';

import { math } from '../../core/math/math.js';
import { StringIds } from '../../core/string-ids.js';

import {
    SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_ATTR12, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15,
    SEMANTIC_COLOR, SEMANTIC_TANGENT, TYPE_FLOAT32, typedArrayTypesByteSize, vertexTypesNames
} from './constants.js';
import { DeviceCache } from './device-cache.js';

const stringIds = new StringIds();
const webgpuValidElementSizes = [2, 4, 8, 12, 16];

// device cache storing the default instancing format per device
const deviceCache = new DeviceCache();

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
 * - {@link TYPE_FLOAT16}
 * @property {boolean} elements[].normalize If true, vertex attribute data will be mapped from a 0
 * to 255 range down to 0 to 1 when fed to a shader. If false, vertex attribute data is left
 * unchanged. If this property is unspecified, false is assumed.
 * @property {number} elements[].offset The number of initial bytes at the start of a vertex that
 * are not relevant to this attribute.
 * @property {number} elements[].stride The number of total bytes that are between the start of one
 * vertex, and the start of the next.
 * @property {number} elements[].size The size of the attribute in bytes.
 * @category Graphics
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
     * - {@link TYPE_FLOAT16}
     * - {@link TYPE_FLOAT32}
     *
     * @param {boolean} [description[].normalize] - If true, vertex attribute data will be mapped
     * from a 0 to 255 range down to 0 to 1 when fed to a shader. If false, vertex attribute data
     * is left unchanged. If this property is unspecified, false is assumed. This property is
     * ignored when asInt is true.
     * @param {boolean} [description[].asInt] - If true, vertex attribute data will be accessible
     * as integer numbers in shader code. Defaults to false, which means that vertex attribute data
     * will be accessible as floating point numbers. Can be only used with INT and UINT data types.
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
            Debug.assert(VertexFormat.isElementValid(graphicsDevice, elementDesc),
                         `WebGPU does not support the format of vertex element ${elementDesc.semantic} : ${vertexTypesNames[elementDesc.type]} x ${elementDesc.components}`);

            // align up the offset to elementSize (when vertexCount is specified only - case of non-interleaved format)
            if (vertexCount) {
                offset = math.roundUp(offset, elementSize);

                // non-interleaved format with elementSize not multiple of 4 might be slower on some platforms - padding is recommended to align its size
                // example: use 4 x TYPE_UINT8 instead of 3 x TYPE_UINT8
                Debug.assert((elementSize % 4) === 0,
                             `Non-interleaved vertex format with element size not multiple of 4 can have performance impact on some platforms. Element size: ${elementSize}`);
            }

            const asInt = elementDesc.asInt ?? false;
            const normalize = asInt ? false : (elementDesc.normalize ?? false);
            const element = {
                name: elementDesc.semantic,
                offset: (vertexCount ? offset : (elementDesc.hasOwnProperty('offset') ? elementDesc.offset : offset)),
                stride: (vertexCount ? elementSize : (elementDesc.hasOwnProperty('stride') ? elementDesc.stride : this.size)),
                dataType: elementDesc.type,
                numComponents: elementDesc.components,
                normalize: normalize,
                size: elementSize,
                asInt: asInt
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
     * The {@link VertexFormat} used to store matrices of type {@link Mat4} for hardware instancing.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
     * used to create this vertex format.
     *
     * @returns {VertexFormat} The default instancing vertex format.
     */
    static getDefaultInstancingFormat(graphicsDevice) {

        // get it from the device cache, or create a new one if not cached yet
        return deviceCache.get(graphicsDevice, () => {
            return new VertexFormat(graphicsDevice, [
                { semantic: SEMANTIC_ATTR12, components: 4, type: TYPE_FLOAT32 },
                { semantic: SEMANTIC_ATTR13, components: 4, type: TYPE_FLOAT32 },
                { semantic: SEMANTIC_ATTR14, components: 4, type: TYPE_FLOAT32 },
                { semantic: SEMANTIC_ATTR15, components: 4, type: TYPE_FLOAT32 }
            ]);
        });
    }

    static isElementValid(graphicsDevice, elementDesc) {
        const elementSize = elementDesc.components * typedArrayTypesByteSize[elementDesc.type];
        if (graphicsDevice.isWebGPU && !webgpuValidElementSizes.includes(elementSize))
            return false;
        return true;
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
        const stringElementsBatch = [];
        const stringElementsRender = [];
        const len = this._elements.length;
        for (let i = 0; i < len; i++) {
            const { name, dataType, numComponents, normalize, offset, stride, size, asInt } = this._elements[i];

            // create string description of each element that is relevant for batching
            const stringElementBatch = name + dataType + numComponents + normalize + asInt;
            stringElementsBatch.push(stringElementBatch);

            // create string description of each element that is relevant for rendering
            const stringElementRender = stringElementBatch + offset + stride + size;
            stringElementsRender.push(stringElementRender);
        }

        // sort batching ones alphabetically to make the hash order independent
        stringElementsBatch.sort();
        const batchingString = stringElementsBatch.join();
        this.batchingHash = hashCode(batchingString);

        // shader processing hash - all elements that are used by the ShaderProcessor processing attributes
        // at the moment this matches the batching hash
        this.shaderProcessingHashString = batchingString;

        // rendering hash
        this.renderingHashString = stringElementsRender.join('_');
        this.renderingHash = stringIds.get(this.renderingHashString);
    }
}

export { VertexFormat };
