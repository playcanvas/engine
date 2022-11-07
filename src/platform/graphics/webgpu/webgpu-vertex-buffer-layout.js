import { Debug } from "../../../core/debug.js";

import {
    semanticToLocation,
    TYPE_INT8, TYPE_UINT8, TYPE_INT16, TYPE_UINT16, TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32
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

/**
 * @ignore
 */
class WebgpuVertexBufferLayout {
    /** @type {Map<string, GPUVertexBufferLayout[]>} */
    cache = new Map();

    /**
     * Obtain a vertex layout of one or two vertex formats.
     *
     * @param {import('../vertex-format.js').VertexFormat} vertexFormat0 - The first vertex format.
     * @param {import('../vertex-format.js').VertexFormat} [vertexFormat1] - The second vertex format.
     * @returns {GPUVertexBufferLayout[]} - The vertex layout.
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
        return vertexFormat0.renderingingHashString + (vertexFormat1 ? vertexFormat1.renderingingHashString : '');
    }

    /**
     * @param {import('../vertex-format.js').VertexFormat} vertexFormat0 - The first vertex format.
     * @param {import('../vertex-format.js').VertexFormat} vertexFormat1 - The second vertex format.
     * @returns {GPUVertexBufferLayout[]} - The vertex buffer layout.
     */
    create(vertexFormat0, vertexFormat1) {

        /** @type  {GPUVertexBufferLayout[]} */
        const layout = [];

        const addFormat = (format) => {
            const interleaved = format.interleaved;
            let attributes = [];
            const elementCount = format.elements.length;
            for (let i = 0; i < elementCount; i++) {
                const element = format.elements[i];
                const location = semanticToLocation[element.name];

                // A WGL shader needs attributes to have matching types, but glslang translator we use does not allow us to set those
                Debug.assert(element.dataType === TYPE_FLOAT32, `Only float vertex attributes are supported, ${element.dataType} is not supported, semantic: ${element.name}.`);

                attributes.push({
                    shaderLocation: location,
                    offset: interleaved ? element.offset : 0,
                    format: `${gpuVertexFormats[element.dataType]}x${element.numComponents}`
                });

                if (!interleaved || i === elementCount - 1) {
                    layout.push({
                        attributes: attributes,
                        arrayStride: element.stride,
                        stepMode: 'vertex'          // for instancing, this need to change
                    });
                    attributes = [];
                }
            }
        };

        addFormat(vertexFormat0);
        if (vertexFormat1) {
            addFormat(vertexFormat1);
        }

        return layout;
    }
}

export { WebgpuVertexBufferLayout };
