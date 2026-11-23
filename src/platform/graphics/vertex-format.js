import { Debug } from '../../core/debug.js';
import { hashCode } from '../../core/hash.js';
import { BitPacking } from '../../core/math/bit-packing.js';
import { math } from '../../core/math/math.js';
import { StringIds } from '../../core/string-ids.js';
import {
    SEMANTIC_TEXCOORD, SEMANTIC_ATTR12, SEMANTIC_ATTR11, SEMANTIC_ATTR14, SEMANTIC_ATTR15,
    SEMANTIC_COLOR, SEMANTIC_TANGENT, TYPE_FLOAT32, typedArrayTypesByteSize, vertexTypesNames
} from './constants.js';
import { DeviceCache } from './device-cache.js';

/**
 * @import { GraphicsDevice } from './graphics-device.js'
 */

const stringIds = new StringIds();
const webgpuValidElementSizes = [2, 4, 8, 12, 16];

// vertexAttribPointer rejects a stride above 255. WebGPU's default maxVertexBufferArrayStride is
// 2048, and arrayStride has to be a multiple of 4.
const webglMaxVertexStride = 255;
const webgpuMaxVertexStride = 2048;

// device cache storing the default instancing format per device
const deviceCache = new DeviceCache();

/**
 * The stride shared by an interleaved format when any attribute sets one. `null` and `undefined`
 * are omitted. Anything else that is not one positive whole number is reported and discarded, so
 * the caller keeps the packed size.
 *
 * @param {object[]} description - The attribute descriptions.
 * @returns {number|undefined} The shared stride, or undefined when every stride is omitted, the
 * values differ, or the value is not a positive whole number.
 * @ignore
 */
function sharedInterleavedStride(description) {
    let stride;
    let strideName;
    for (let i = 0; i < description.length; i++) {
        const elementStride = description[i].stride;
        if (elementStride === undefined || elementStride === null) {
            continue;
        }

        if (stride === undefined) {
            stride = elementStride;
            strideName = description[i].semantic;
            continue;
        }

        // WebGPU has one array stride per vertex buffer and reads it from the last attribute.
        const sameStride = elementStride === stride;
        Debug.assert(sameStride,
            `Interleaved vertex attributes must use the same stride, got ${stride} and ${elementStride}`);
        if (!sameStride) {
            return undefined;
        }
    }

    // Stride 0 is tightly packed on WebGL and a repeated element on WebGPU. A non-integer makes
    // the buffer length fractional.
    const usable = stride === undefined || (Number.isInteger(stride) && stride > 0);
    Debug.assert(usable,
        `Vertex element ${strideName} stride must be a positive whole number of bytes, got ${stride}. A stride of 0 is tightly packed on WebGL and repeats one element for every vertex on WebGPU`);
    return usable ? stride : undefined;
}

/**
 * Reports an interleaved attribute whose resolved offset or stride a backend would reject, or
 * that extends into the following vertex. The stride here is the format's single vertex size.
 *
 * @param {GraphicsDevice} graphicsDevice - The device the format belongs to.
 * @param {object} element - The resolved attribute.
 * @param {string} element.name - The attribute semantic, included in the message.
 * @param {number} element.dataType - The attribute's TYPE_* value.
 * @param {number} element.size - The attribute's size in bytes.
 * @param {number} element.offset - The resolved offset in bytes.
 * @param {number} element.stride - The resolved stride in bytes.
 * @ignore
 */
function assertInterleavedElement(graphicsDevice, element) {
    const { name, dataType, size, offset, stride } = element;
    const componentSize = typedArrayTypesByteSize[dataType];
    const webgpu = graphicsDevice.isWebGPU;
    const offsetWhole = Number.isInteger(offset) && offset >= 0;
    const offsetAligned = offsetWhole && componentSize > 0 && offset % componentSize === 0;

    Debug.assert(offsetAligned,
        `Vertex element ${name} offset must be a non-negative multiple of its component size (${componentSize} bytes), got ${offset}`);

    // WebGPU aligns an attribute to min(4, its format size). That is stricter than the component
    // size for 1-byte and 2-byte components. Sizes WebGPU has no format for are rejected separately.
    if (webgpu && offsetAligned && webgpuValidElementSizes.includes(size)) {
        const offsetAlignment = Math.min(4, size);
        if (offsetAlignment !== componentSize) {
            Debug.assert(offset % offsetAlignment === 0,
                `Vertex element ${name} offset must be a multiple of ${offsetAlignment} on WebGPU, got ${offset}`);
        }
    }

    // A packed size of 0 reaches here. An explicit stride of 0 is discarded before the elements
    // are built, because the backends disagree on what it means.
    const strideWhole = Number.isInteger(stride) && stride > 0;
    Debug.assert(strideWhole,
        `Vertex element ${name} stride must be a positive whole number of bytes, got ${stride}. A stride of 0 is tightly packed on WebGL and repeats one element for every vertex on WebGPU`);
    if (!strideWhole) {
        return;
    }

    Debug.assert(componentSize > 0 && stride % componentSize === 0,
        `Vertex element ${name} stride must be a multiple of its component size (${componentSize} bytes), got ${stride}`);

    // A 4-byte component already requires a multiple of 4. Smaller components need it only on WebGPU.
    if (webgpu && componentSize < 4) {
        Debug.assert(stride % 4 === 0,
            `Vertex element ${name} stride must be a multiple of 4 on WebGPU, got ${stride}`);
    }

    const maxStride = webgpu ? webgpuMaxVertexStride : webglMaxVertexStride;
    const backend = webgpu ? 'WebGPU' : 'WebGL';
    Debug.assert(stride <= maxStride,
        `Vertex element ${name} stride must be at most ${maxStride} on ${backend}, got ${stride}`);

    if (offsetWhole) {
        Debug.assert(offset + size <= stride,
            `Vertex element ${name} extends past the vertex stride: offset ${offset} + size ${size} > stride ${stride}`);
    }
}

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
 * @property {number} elements[].offset The byte offset of this attribute's data. In an interleaved
 * format this is the offset from the start of a vertex. In a non-interleaved format this is the
 * offset of the attribute's array from the start of the buffer.
 * @property {number} elements[].stride The number of bytes from this attribute in one vertex to the
 * same attribute in the next. Interleaved attributes share one stride, equal to
 * {@link VertexFormat#size}. In a non-interleaved format the stride is the size of the attribute
 * in bytes.
 * @property {number} elements[].size The size of the attribute in bytes.
 * @property {number} size For an interleaved format, the number of bytes from one vertex to the
 * next. Every attribute's stride equals it, and a {@link VertexBuffer} holds `size` bytes per
 * vertex. For a non-interleaved format, this is the sum of the attribute sizes rounded up to a
 * multiple of 4, and the buffer is sized from the vertex count given to the format.
 * @category Graphics
 */
class VertexFormat {
    /**
     * @typedef {object} AttributeDescription
     * @property {string} semantic - The meaning of the vertex element. This is used to
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
     * @property {number} components - The number of components of the vertex attribute.
     * Can be 1, 2, 3 or 4.
     * @property {number} type - The data type of the attribute. Can be:
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
     * @property {boolean} [normalize] - If true, vertex attribute data will be mapped
     * from a 0 to 255 range down to 0 to 1 when fed to a shader. If false, vertex attribute data
     * is left unchanged. If this property is unspecified, false is assumed. This property is
     * ignored when asInt is true.
     * @property {boolean} [asInt] - If true, vertex attribute data will be accessible
     * as integer numbers in shader code. Defaults to false, which means that vertex attribute data
     * will be accessible as floating point numbers. Can be only used with INT and UINT data types.
     * @property {number} [offset] - The number of bytes from the start of a vertex to this
     * attribute. When omitted, interleaved attributes are packed in order and each one starts on
     * a 4-byte boundary. A later attribute whose offset is omitted stays at its packed position,
     * so an explicit offset earlier in the vertex can overlap it. The attribute must fit in the
     * stride: the offset plus the attribute's size in bytes is at most the stride. The offset
     * must be a non-negative multiple of the component type's size in bytes, and on WebGPU also a
     * multiple of the minimum of 4 and the attribute's size. Ignored when `vertexCount` is given,
     * including 0. Each attribute is then stored in its own array, and the offset is that array's
     * byte offset from the start of the buffer, rounded up to a multiple of the attribute's size.
     * @property {number} [stride] - The number of bytes between this attribute in one vertex and
     * the same attribute in the next. An interleaved format has one stride, shared by every
     * attribute, because WebGPU applies a single stride to the whole vertex. Each stride that is
     * set must be the same value, and that value becomes {@link VertexFormat#size}, including for
     * attributes that omit a stride. When every stride is omitted, the size is the sum of the
     * attribute sizes with each size rounded up to a multiple of 4. The packed size is also used
     * when the explicit strides differ, or when a stride is not a positive whole number. Debug
     * builds report those cases. A {@link VertexBuffer} holds `size` bytes per vertex. A stride
     * must be a positive multiple of the component type's size. WebGL limits it to 255 bytes.
     * WebGPU requires a multiple of 4 and at most 2048 bytes, and aligns each offset to the
     * minimum of 4 and the attribute's size. A stride of 0 is not used: WebGL would read the
     * attribute as tightly packed, and WebGPU would repeat one element for every vertex. Debug
     * builds report an offset or stride that breaks these rules. Ignored when `vertexCount` is
     * given, including 0, where the stride is the size of the attribute in bytes.
     */

    /**
     * Create a new VertexFormat instance.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device used to manage this vertex
     * format.
     * @param {AttributeDescription[]} description - An array of vertex attribute descriptions.
     * @param {number} [vertexCount] - When specified, including 0, vertex format will be set up for
     * non-interleaved format with a specified number of vertices. (example: PPPPNNNNCCCC), where
     * arrays of individual attributes will be stored one right after the other (subject to
     * alignment requirements). Note that in this case, the format depends on the number of
     * vertices, and needs to change when the number of vertices changes. When not specified,
     * vertex format will be interleaved. (example: PNCPNCPNCPNC).
     * @example
     * // Specify 3-component positions (x, y, z)
     * const vertexFormat = new VertexFormat(graphicsDevice, [
     *     { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 }
     * ]);
     * @example
     * // Specify 2-component positions (x, y), a texture coordinate (u, v) and a vertex color (r, g, b, a)
     * const vertexFormat = new VertexFormat(graphicsDevice, [
     *     { semantic: SEMANTIC_POSITION, components: 2, type: TYPE_FLOAT32 },
     *     { semantic: SEMANTIC_TEXCOORD0, components: 2, type: TYPE_FLOAT32 },
     *     { semantic: SEMANTIC_COLOR, components: 4, type: TYPE_UINT8, normalize: true }
     * ]);
     * @example
     * // Position and normal as float3, with 8 bytes of padding at the end of each vertex. The
     * // shared stride is the vertex size, so the vertex buffer holds 32 bytes per vertex.
     * const vertexFormat = new VertexFormat(graphicsDevice, [
     *     { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32, stride: 32 },
     *     { semantic: SEMANTIC_NORMAL, components: 3, type: TYPE_FLOAT32, stride: 32 }
     * ]);
     */
    constructor(graphicsDevice, description, vertexCount) {
        this.device = graphicsDevice;
        this._elements = [];

        // bit i is set when the format contains SEMANTIC_TEXCOORDi
        this._uvMask = 0;

        this.hasColor = false;
        this.hasTangents = false;
        this.verticesByteSize = 0;
        this.vertexCount = vertexCount;
        const interleaved = vertexCount === undefined;
        this.interleaved = interleaved;

        // true if the vertex format represents an instancing vertex buffer
        this.instancing = false;

        // Each attribute is rounded up to 4 bytes. An interleaved vertex has one stride, so the
        // buffer allocated from `size` covers a stride larger than those packed attributes.
        const packedSize = description.reduce((total, desc) => {
            return total + math.roundUp(desc.components * typedArrayTypesByteSize[desc.type], 4);
        }, 0);
        this.size = interleaved ? (sharedInterleavedStride(description) ?? packedSize) : packedSize;

        let cursor = 0;
        for (let i = 0, len = description.length; i < len; i++) {
            const elementDesc = description[i];
            const elementSize = elementDesc.components * typedArrayTypesByteSize[elementDesc.type];

            // WebGPU has limited element size support (for example uint16x3 is not supported)
            Debug.assert(VertexFormat.isElementValid(graphicsDevice, elementDesc),
                `WebGPU does not support the format of vertex element ${elementDesc.semantic} : ${vertexTypesNames[elementDesc.type]} x ${elementDesc.components}`);

            // align up the offset to elementSize (when vertexCount is specified only - case of non-interleaved format)
            if (!interleaved) {
                cursor = math.roundUp(cursor, elementSize);

                // non-interleaved format with elementSize not multiple of 4 might be slower on some platforms - padding is recommended to align its size
                // example: use 4 x TYPE_UINT8 instead of 3 x TYPE_UINT8
                Debug.assert((elementSize % 4) === 0,
                    `Non-interleaved vertex format with element size not multiple of 4 can have performance impact on some platforms. Element size: ${elementSize}`);
            }

            const asInt = elementDesc.asInt ?? false;
            const element = {
                name: elementDesc.semantic,
                // null and undefined are omitted, so the attribute keeps the packed cursor
                offset: interleaved ? (elementDesc.offset ?? cursor) : cursor,
                stride: interleaved ? this.size : elementSize,
                dataType: elementDesc.type,
                numComponents: elementDesc.components,
                normalize: asInt ? false : (elementDesc.normalize ?? false),
                size: elementSize,
                asInt: asInt
            };
            if (interleaved) {
                Debug.call(() => assertInterleavedElement(graphicsDevice, element));
            }
            this._elements.push(element);

            // An explicit offset does not advance the cursor, so a following omitted offset stays
            // on its packed boundary and can overlap the explicit attribute.
            cursor += interleaved ? math.roundUp(elementSize, 4) : elementSize * vertexCount;

            if (elementDesc.semantic.startsWith(SEMANTIC_TEXCOORD)) {
                const uvIndex = parseInt(elementDesc.semantic.substring(SEMANTIC_TEXCOORD.length), 10);
                Debug.assert(uvIndex >= 0 && uvIndex < 8, `Unsupported texture coordinate semantic ${elementDesc.semantic}`);
                this._uvMask = BitPacking.set(this._uvMask, 1, uvIndex);
            } else if (elementDesc.semantic === SEMANTIC_COLOR) {
                this.hasColor = true;
            } else if (elementDesc.semantic === SEMANTIC_TANGENT) {
                this.hasTangents = true;
            }
        }

        if (!interleaved) {
            this.verticesByteSize = cursor;
        }

        this._evaluateHash();
    }

    get elements() {
        return this._elements;
    }

    /**
     * The texture coordinate sets contained in the format, as a bit mask with bit i set when the
     * format contains the semantic {@link SEMANTIC_TEXCOORD0} + i.
     *
     * @type {number}
     * @ignore
     */
    get uvMask() {
        return this._uvMask;
    }

    /**
     * Returns true if the format contains the texture coordinate set with the specified index.
     *
     * @param {number} index - The index of the texture coordinate set, from 0 for
     * {@link SEMANTIC_TEXCOORD0} to 7 for {@link SEMANTIC_TEXCOORD7}.
     * @returns {boolean} True if the format contains the texture coordinate set.
     */
    hasUv(index) {
        return BitPacking.any(this._uvMask, index);
    }

    /**
     * The {@link VertexFormat} used to store matrices of type {@link Mat4} for hardware instancing.
     * The matrix rows use {@link SEMANTIC_ATTR11}, {@link SEMANTIC_ATTR12}, {@link SEMANTIC_ATTR14}
     * and {@link SEMANTIC_ATTR15}. The first two share their attribute locations with
     * {@link SEMANTIC_TEXCOORD6} and {@link SEMANTIC_TEXCOORD7}, so a shader reading those texture
     * coordinate sets needs a custom instancing format on other attributes.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device used to create this vertex
     * format.
     * @returns {VertexFormat} The default instancing vertex format.
     */
    static getDefaultInstancingFormat(graphicsDevice) {

        // get it from the device cache, or create a new one if not cached yet
        return deviceCache.get(graphicsDevice, () => {
            return new VertexFormat(graphicsDevice, [
                { semantic: SEMANTIC_ATTR11, components: 4, type: TYPE_FLOAT32 },
                { semantic: SEMANTIC_ATTR12, components: 4, type: TYPE_FLOAT32 },
                { semantic: SEMANTIC_ATTR14, components: 4, type: TYPE_FLOAT32 },
                { semantic: SEMANTIC_ATTR15, components: 4, type: TYPE_FLOAT32 }
            ]);
        });
    }

    /**
     * @deprecated Use VertexFormat.getDefaultInstancingFormat(graphicsDevice).
     * @returns {null} Always null.
     * @ignore
     */
    static get defaultInstancingFormat() {
        Debug.removed('VertexFormat.defaultInstancingFormat was removed. Use VertexFormat.getDefaultInstancingFormat(graphicsDevice).');
        return null;
    }

    static isElementValid(graphicsDevice, elementDesc) {
        const elementSize = elementDesc.components * typedArrayTypesByteSize[elementDesc.type];
        if (graphicsDevice.isWebGPU && !webgpuValidElementSizes.includes(elementSize)) {
            return false;
        }
        return true;
    }

    /**
     * Applies any changes made to the VertexFormat's properties.
     *
     * @private
     */
    update() {
        // Note that this is used only by vertex attribute morphing on the WebGL.
        Debug.assert(!this.device.isWebGPU, 'VertexFormat#update is not supported on WebGPU and VertexFormat cannot be modified.');
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

            // Separators keep offset 2 / stride 224 from hashing the same as offset 22 / stride 24.
            // Both are legal layouts, and the string is the WebGPU pipeline key.
            const stringElementRender = `${stringElementBatch}:${offset}:${stride}:${size}`;
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
