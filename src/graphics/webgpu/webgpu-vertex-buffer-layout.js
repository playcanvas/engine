import { Debug } from "../../core/debug.js";
import { semanticToLocation, TYPE_FLOAT32 } from '../constants.js';

/** @typedef {import('../vertex-format.js').VertexFormat} VertexFormat */

/**
 * @ignore
 */
class WebgpuVertexBufferLayout {
    /** @type {Map<string, GPUVertexBufferLayout[]>} */
    cache = new Map();

    /**
     * Obtain a vertex layout of one or two vertex formats.
     *
     * @param {VertexFormat} vertexFormat0 - The first vertex format.
     * @param {VertexFormat} [vertexFormat1] - The second vertex format.
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
     * @param {VertexFormat} vertexFormat0 - The first vertex format.
     * @param {VertexFormat} vertexFormat1 - The second vertex format.
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

                Debug.assert(element.dataType === TYPE_FLOAT32, `Only float formats are supported, ${element.dataType} is not supported.`);

                attributes.push({
                    shaderLocation: location,
                    offset: interleaved ? element.offset : 0,
                    format: `float32x${element.numComponents}`
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
