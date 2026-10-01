import { expect } from 'chai';

import {
    SEMANTIC_COLOR, SEMANTIC_NORMAL, SEMANTIC_POSITION, SEMANTIC_TANGENT, SEMANTIC_TEXCOORD,
    SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD5, TYPE_FLOAT32, TYPE_UINT8
} from '../../../src/platform/graphics/constants.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { createGraphicsDevice } from '../../device.mjs';

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
});
