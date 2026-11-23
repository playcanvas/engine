import { expect } from 'chai';

import {
    SEMANTIC_COLOR, SEMANTIC_NORMAL, SEMANTIC_POSITION, SEMANTIC_TANGENT, SEMANTIC_TEXCOORD,
    SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD5, TYPE_FLOAT32, TYPE_UINT8
} from '../../../src/platform/graphics/constants.js';
import { VertexBuffer } from '../../../src/platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { WebgpuVertexBufferLayout } from '../../../src/platform/graphics/webgpu/webgpu-vertex-buffer-layout.js';
import { createGraphicsDevice } from '../../device.mjs';

// Debug builds report layout mistakes through console.error. Release builds strip those calls.
const withAsserts = (fn) => {
    const error = console.error;
    const messages = [];
    console.error = (...args) => {
        messages.push(args.join(' '));
    };
    try {
        fn();
    } finally {
        console.error = error;
    }
    return messages;
};

describe('VertexFormat', function () {

    /** @type {import('../../../src/platform/graphics/graphics-device.js').GraphicsDevice} */
    let device;

    beforeEach(function () {
        device = createGraphicsDevice({ width: 100, height: 100 });
    });

    afterEach(function () {
        device.destroy();
        device = null;
    });

    /**
     * @param {string[]} semantics - The semantics of the 2-component float elements to add after
     * the position.
     * @param {number} [vertexCount] - When given, builds a non-interleaved format.
     * @returns {VertexFormat} The format.
     */
    const createFormat = (semantics, vertexCount) => new VertexFormat(device, [
        { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 },
        ...semantics.map(semantic => ({ semantic, components: 2, type: TYPE_FLOAT32 }))
    ], vertexCount);

    describe('#hasUv', function () {

        it('reports only the texture coordinate sets present in the format', function () {
            const format = createFormat([SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD5]);

            expect(format.hasUv(0)).to.equal(true);
            expect(format.hasUv(1)).to.equal(false);
            expect(format.hasUv(5)).to.equal(true);
            expect(format.hasUv(7)).to.equal(false);
        });

        it('reports no texture coordinate sets for a format without any', function () {
            const format = createFormat([]);

            for (let i = 0; i < 8; i++) {
                expect(format.hasUv(i)).to.equal(false);
            }
        });

        it('tracks all eight texture coordinate sets', function () {
            const semantics = [];
            for (let i = 0; i < 8; i++) {
                semantics.push(SEMANTIC_TEXCOORD + i);
            }
            const format = createFormat(semantics);

            for (let i = 0; i < 8; i++) {
                expect(format.hasUv(i)).to.equal(true);
            }
            expect(format.uvMask).to.equal(0xFF);
        });

        it('tracks texture coordinate sets in non-interleaved formats', function () {
            const format = createFormat([SEMANTIC_TEXCOORD1], 4);

            expect(format.hasUv(0)).to.equal(false);
            expect(format.hasUv(1)).to.equal(true);
        });

        it('does not mistake other semantics for texture coordinates', function () {
            const format = new VertexFormat(device, [
                { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 },
                { semantic: SEMANTIC_NORMAL, components: 3, type: TYPE_FLOAT32 },
                { semantic: SEMANTIC_TANGENT, components: 4, type: TYPE_FLOAT32 },
                { semantic: SEMANTIC_COLOR, components: 4, type: TYPE_UINT8, normalize: true }
            ]);

            expect(format.uvMask).to.equal(0);
            expect(format.hasColor).to.equal(true);
            expect(format.hasTangents).to.equal(true);
        });
    });

    const float3 = (semantic, extra = {}) => ({ semantic, components: 3, type: TYPE_FLOAT32, ...extra });

    const formatWith = (description, vertexCount) => {
        let format;
        const messages = withAsserts(() => {
            format = new VertexFormat(device, description, vertexCount);
        });
        return { format, messages };
    };

    const gpuBuffers = (format) => {
        return new WebgpuVertexBufferLayout().create(format, null);
    };

    describe('interleaved layout', function () {

        it('packs omitted offsets on 4-byte boundaries and uses that as the stride', function () {
            const { format, messages } = formatWith([
                float3(SEMANTIC_POSITION),
                { semantic: SEMANTIC_COLOR, components: 4, type: TYPE_UINT8, normalize: true }
            ]);

            expect(messages).to.deep.equal([]);
            expect(format.size).to.equal(16);
            expect(format.elements[0].offset).to.equal(0);
            expect(format.elements[0].stride).to.equal(16);
            expect(format.elements[1].offset).to.equal(12);
            expect(format.elements[1].stride).to.equal(16);
            expect(format.elements[1].size).to.equal(4);
        });

        it('treats null and undefined offset and stride as omitted', function () {
            const packed = formatWith([
                float3(SEMANTIC_POSITION),
                float3(SEMANTIC_NORMAL)
            ]);
            const explicit = formatWith([
                float3(SEMANTIC_POSITION, { offset: undefined, stride: undefined }),
                float3(SEMANTIC_NORMAL, { offset: null, stride: null })
            ]);

            const layoutOf = format => format.elements.map(element => [element.offset, element.stride]);
            expect(explicit.messages).to.deep.equal([]);
            expect(explicit.format.size).to.equal(packed.format.size);
            expect(layoutOf(explicit.format)).to.deep.equal(layoutOf(packed.format));
        });

        it('uses a shared explicit stride as the vertex size and the buffer length', function () {
            const vertexCount = 3;
            const data = new ArrayBuffer(32 * vertexCount);
            const { format, messages } = formatWith([
                float3(SEMANTIC_POSITION, { stride: 32 }),
                float3(SEMANTIC_NORMAL, { stride: 32 })
            ]);
            const buffer = new VertexBuffer(device, format, vertexCount, { data });

            expect(messages).to.deep.equal([]);
            expect(format.size).to.equal(32);
            expect(format.elements.map(element => element.stride)).to.deep.equal([32, 32]);
            expect(format.elements.map(element => element.offset)).to.deep.equal([0, 12]);
            expect(buffer.lock()).to.equal(data);
            expect(buffer.numBytes).to.equal(data.byteLength);
            expect(gpuBuffers(format)).to.deep.equal([{
                attributes: [
                    { shaderLocation: 0, offset: 0, format: 'float32x3' },
                    { shaderLocation: 1, offset: 12, format: 'float32x3' }
                ],
                arrayStride: 32,
                stepMode: 'vertex'
            }]);

            buffer.destroy();
        });

        it('gives an omitted stride the explicit stride set on another attribute', function () {
            const { format, messages } = formatWith([
                float3(SEMANTIC_POSITION, { stride: 32 }),
                float3(SEMANTIC_NORMAL)
            ]);

            expect(messages).to.deep.equal([]);
            expect(format.size).to.equal(32);
            expect(format.elements[1].stride).to.equal(32);
            expect(format.elements[1].offset).to.equal(12);
        });

        it('keeps an omitted offset at the packed position when an earlier offset is explicit', function () {
            const { format, messages } = formatWith([
                float3(SEMANTIC_POSITION, { offset: 4 }),
                float3(SEMANTIC_NORMAL)
            ]);

            // 4..16 and 12..24 overlap, and both fit in the packed 24-byte vertex
            expect(messages).to.deep.equal([]);
            expect(format.size).to.equal(24);
            expect(format.elements[0].offset).to.equal(4);
            expect(format.elements[1].offset).to.equal(12);
        });

        it('accepts an offset in the padding when the stride covers the attribute', function () {
            const { format, messages } = formatWith([
                float3(SEMANTIC_POSITION, { stride: 32 }),
                float3(SEMANTIC_NORMAL, { offset: 16, stride: 32 })
            ]);

            expect(messages).to.deep.equal([]);
            expect(format.size).to.equal(32);
            expect(format.elements[0].offset).to.equal(0);
            expect(format.elements[1].offset).to.equal(16);
        });

        it('keeps distinct rendering hashes when offset and stride digits would otherwise join', function () {
            const wide = formatWith([
                { semantic: SEMANTIC_COLOR, components: 2, type: TYPE_UINT8, offset: 2, stride: 224 }
            ]);
            const narrow = formatWith([
                { semantic: SEMANTIC_COLOR, components: 2, type: TYPE_UINT8, offset: 22, stride: 24 }
            ]);

            expect(wide.messages).to.deep.equal([]);
            expect(narrow.messages).to.deep.equal([]);
            expect(wide.format.renderingHashString).to.not.equal(narrow.format.renderingHashString);
        });

        it('accepts a byte offset and a stride of 255 on WebGL', function () {
            const { format, messages } = formatWith([
                { semantic: SEMANTIC_COLOR, components: 4, type: TYPE_UINT8, offset: 1, stride: 255 }
            ]);

            expect(messages).to.deep.equal([]);
            expect(format.size).to.equal(255);
            expect(format.elements[0].offset).to.equal(1);
            expect(format.elements[0].stride).to.equal(255);
        });
    });

    describe('non-interleaved layout', function () {

        it('ignores offset and stride when vertexCount is given', function () {
            const { format, messages } = formatWith([
                float3(SEMANTIC_POSITION, { offset: 8, stride: 32 }),
                float3(SEMANTIC_NORMAL, { offset: 0, stride: 32 })
            ], 2);

            expect(messages).to.deep.equal([]);
            expect(format.interleaved).to.equal(false);
            expect(format.size).to.equal(24);
            expect(format.elements[0].offset).to.equal(0);
            expect(format.elements[0].stride).to.equal(12);
            expect(format.elements[1].offset).to.equal(24);
            expect(format.elements[1].stride).to.equal(12);
            expect(format.verticesByteSize).to.equal(48);
            expect(gpuBuffers(format).map(buffer => buffer.arrayStride)).to.deep.equal([12, 12]);
        });

        it('ignores offset and stride when vertexCount is 0', function () {
            const { format, messages } = formatWith([
                float3(SEMANTIC_POSITION, { offset: 8, stride: 32 }),
                float3(SEMANTIC_NORMAL, { offset: 0, stride: 32 })
            ], 0);

            expect(messages).to.deep.equal([]);
            expect(format.interleaved).to.equal(false);
            expect(format.vertexCount).to.equal(0);
            expect(format.elements[0].offset).to.equal(0);
            expect(format.elements[0].stride).to.equal(12);
            expect(format.elements[1].offset).to.equal(0);
            expect(format.elements[1].stride).to.equal(12);
            expect(format.verticesByteSize).to.equal(0);
        });
    });

    describe('invalid interleaved layout', function () {

        it('reports strides that differ and keeps one packed stride', function () {
            const { format, messages } = formatWith([
                float3(SEMANTIC_POSITION, { stride: 32 }),
                float3(SEMANTIC_NORMAL, { stride: 48 })
            ]);

            expect(messages).to.have.length(1);
            expect(messages[0]).to.include('same stride');
            expect(format.size).to.equal(24);
            expect(format.elements.map(element => element.stride)).to.deep.equal([24, 24]);
            expect(gpuBuffers(format)[0].arrayStride).to.equal(24);
        });

        it('reports an attribute that extends past the stride', function () {
            const { format, messages } = formatWith([
                float3(SEMANTIC_POSITION),
                float3(SEMANTIC_NORMAL, { offset: 16 })
            ]);

            expect(messages).to.have.length(1);
            expect(messages[0]).to.include('extends past the vertex stride');
            expect(format.size).to.equal(24);
            expect(format.elements[1].offset).to.equal(16);
        });

        it('reports a stride of 0 and keeps the packed vertex size', function () {
            const { format, messages } = formatWith([
                float3(SEMANTIC_POSITION, { stride: 0 })
            ]);

            expect(messages).to.have.length(1);
            expect(messages[0]).to.include('stride of 0');
            expect(format.size).to.equal(12);
            expect(format.elements[0].stride).to.equal(12);
        });

        it('reports an offset that is not a multiple of the component size', function () {
            const { format, messages } = formatWith([
                float3(SEMANTIC_POSITION, { offset: 2, stride: 16 })
            ]);

            expect(messages).to.have.length(1);
            expect(messages[0]).to.include('component size');
            expect(format.elements[0].offset).to.equal(2);
        });

        it('reports a stride above 255 on WebGL', function () {
            const { format, messages } = formatWith([
                { semantic: SEMANTIC_COLOR, components: 4, type: TYPE_UINT8, stride: 256 }
            ]);

            expect(messages).to.have.length(1);
            expect(messages[0]).to.include('at most 255');
            expect(format.size).to.equal(256);
        });
    });

    describe('WebGPU layout limits', function () {

        beforeEach(function () {
            device.isWebGPU = true;
        });

        it('accepts the padded float3 layout and a stride of 2048', function () {
            const padded = formatWith([
                float3(SEMANTIC_POSITION, { stride: 32 }),
                float3(SEMANTIC_NORMAL, { stride: 32 })
            ]);
            const longest = formatWith([
                float3(SEMANTIC_POSITION, { stride: 2048 })
            ]);

            expect(padded.messages).to.deep.equal([]);
            expect(longest.messages).to.deep.equal([]);
            expect(padded.format.size).to.equal(32);
            expect(longest.format.size).to.equal(2048);
        });

        it('reports an unsupported element size without inventing an alignment for it', function () {
            const { messages } = formatWith([
                { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_UINT8 },
                { semantic: SEMANTIC_NORMAL, components: 3, type: TYPE_UINT8 }
            ]);

            expect(messages).to.have.length(2);
            expect(messages.every(message => message.includes('does not support'))).to.equal(true);
        });

        it('reports an offset that misses the WebGPU alignment', function () {
            const { format, messages } = formatWith([
                { semantic: SEMANTIC_COLOR, components: 4, type: TYPE_UINT8, offset: 1, stride: 8 }
            ]);

            expect(messages).to.have.length(1);
            expect(messages[0]).to.include('multiple of 4 on WebGPU');
            expect(format.elements[0].offset).to.equal(1);
        });

        it('reports a stride that is not a multiple of 4', function () {
            const { format, messages } = formatWith([
                { semantic: SEMANTIC_COLOR, components: 2, type: TYPE_UINT8, stride: 2 }
            ]);

            expect(messages).to.have.length(1);
            expect(messages[0]).to.include('multiple of 4 on WebGPU');
            expect(format.size).to.equal(2);
        });

        it('reports a stride above 2048', function () {
            const { format, messages } = formatWith([
                float3(SEMANTIC_POSITION, { stride: 2052 })
            ]);

            expect(messages).to.have.length(1);
            expect(messages[0]).to.include('at most 2048');
            expect(format.size).to.equal(2052);
        });
    });
});
