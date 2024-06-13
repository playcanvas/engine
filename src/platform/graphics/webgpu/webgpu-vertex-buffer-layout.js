import {
    semanticToLocation,
    TYPE_INT8, TYPE_UINT8, TYPE_INT16, TYPE_UINT16, TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32, TYPE_FLOAT16
} from '../constants.js';

// map of TYPE_*** to GPUVertexFormat
const gpuVertexFormats = [];
gpuVertexFormats[TYPE_INT8] = 'sint8';
gpuVertexFormats[TYPE_UINT8] = 'uint8';
gpuVertexFormats[TYPE_INT16] = 'sint16';
gpuVertexFormats[TYPE_UINT16] = 'uint16';
gpuVertexFormats[TYPE_INT32] = 'sint32';
gpuVertexFormats[TYPE_UINT32] = 'uint32';
gpuVertexFormats[TYPE_FLOAT32] = 'float32';
gpuVertexFormats[TYPE_FLOAT16] = 'float16';

const gpuVertexFormatsNormalized = [];
gpuVertexFormatsNormalized[TYPE_INT8] = 'snorm8';
gpuVertexFormatsNormalized[TYPE_UINT8] = 'unorm8';
gpuVertexFormatsNormalized[TYPE_INT16] = 'snorm16';
gpuVertexFormatsNormalized[TYPE_UINT16] = 'unorm16';
gpuVertexFormatsNormalized[TYPE_INT32] = 'sint32';     // there is no 32bit normalized signed int
gpuVertexFormatsNormalized[TYPE_UINT32] = 'uint32';    // there is no 32bit normalized unsigned int
gpuVertexFormatsNormalized[TYPE_FLOAT32] = 'float32';  // there is no 32bit normalized float
gpuVertexFormatsNormalized[TYPE_FLOAT16] = 'float16';  // there is no 16bit normalized half-float

/**
 * @ignore
 */
class WebgpuVertexBufferLayout {
    /**
     * @type {Map<string, GPUVertexBufferLayout[]>}
     * @private
     */
    cache = new Map();

    /**
     * Obtain a vertex layout of one or two vertex formats.
     *
     * @param {import('../vertex-format.js').VertexFormat} vertexFormat0 - The first vertex format.
     * @param {import('../vertex-format.js').VertexFormat} [vertexFormat1] - The second vertex format.
     * @returns {any[]} - The vertex layout.
     */
    get(vertexFormat0, vertexFormat1 = null) {

        const key = this.getKey(vertexFormat0, vertexFormat1);
        let layout = this.cache.get(key);
        if (!layout) {
            layout = this.create(vertexFormat0, vertexFormat1);
            this.cache.set(key, layout);
        }
        return layout;
    }

    getKey(vertexFormat0, vertexFormat1 = null) {
        return `${vertexFormat0?.renderingHashString}-${vertexFormat1?.renderingHashString}`;
    }

    /**
     * @param {import('../vertex-format.js').VertexFormat} vertexFormat0 - The first vertex format.
     * @param {import('../vertex-format.js').VertexFormat} vertexFormat1 - The second vertex format.
     * @returns {any[]} - The vertex buffer layout.
     */
    create(vertexFormat0, vertexFormat1) {

        // type {GPUVertexBufferLayout[]}
        const layout = [];

        // Note: If the VertexFormat is interleaved, we use a single vertex buffer with multiple
        // attributes. This uses a smaller number of vertex buffers (1), which has performance
        // benefits when setting it up on the device.
        // If the VertexFormat is not interleaved, we use multiple vertex buffers, one per
        // attribute. This is less efficient, but is required as there is a pretty small
        // limit on the attribute offsets in the vertex buffer layout.
        const addFormat = (format) => {
            const interleaved = format.interleaved;
            const stepMode = format.instancing ? 'instance' : 'vertex';
            let attributes = [];
            const elementCount = format.elements.length;
            for (let i = 0; i < elementCount; i++) {
                const element = format.elements[i];
                const location = semanticToLocation[element.name];
                const formatTable = element.normalize ? gpuVertexFormatsNormalized : gpuVertexFormats;

                attributes.push({
                    shaderLocation: location,
                    offset: interleaved ? element.offset : 0,
                    format: `${formatTable[element.dataType]}${element.numComponents > 1 ? 'x' + element.numComponents : ''}`
                });

                if (!interleaved || i === elementCount - 1) {
                    layout.push({
                        attributes: attributes,
                        arrayStride: element.stride,
                        stepMode: stepMode
                    });
                    attributes = [];
                }
            }
        };

        if (vertexFormat0)
            addFormat(vertexFormat0);

        if (vertexFormat1)
            addFormat(vertexFormat1);

        return layout;
    }
}

export { WebgpuVertexBufferLayout };
