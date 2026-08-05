import { expect } from 'chai';

import { SEMANTIC_ATTR0, SEMANTIC_POSITION, TYPE_FLOAT32 } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { VertexBuffer } from '../../../src/platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';

describe('VertexBuffer', function () {

    /** @type {NullGraphicsDevice} */
    let device;

    beforeEach(function () {
        device = new NullGraphicsDevice({ width: 100, height: 100 });
    });

    afterEach(function () {
        device.destroy();
        device = null;
    });

    const createBuffer = (semantic, components) => new VertexBuffer(
        device,
        new VertexFormat(device, [{ semantic: semantic, components: components, type: TYPE_FLOAT32 }]),
        4
    );

    describe('#vaoKeyPart', function () {

        it('encodes both the buffer id and the format hash as separate fields', function () {
            const buffer = createBuffer(SEMANTIC_POSITION, 3);

            expect(buffer.vaoKeyPart).to.equal(`${buffer.id}_${buffer.format.renderingHash}_`);

            buffer.destroy();
        });

        it('returns the same value on repeated access', function () {
            const buffer = createBuffer(SEMANTIC_POSITION, 3);

            expect(buffer.vaoKeyPart).to.equal(buffer.vaoKeyPart);

            buffer.destroy();
        });

        it('does not collapse the id and the format hash into their sum', function () {
            // Regression test - the key used to be built as `id + renderingHash`, which is numeric
            // addition, so any two buffers whose id and format hash summed to the same value produced
            // an identical contribution and could collide in the vertex array object cache.
            const buffer = createBuffer(SEMANTIC_POSITION, 3);

            expect(buffer.vaoKeyPart).to.not.equal(String(buffer.id + buffer.format.renderingHash));

            buffer.destroy();
        });

        it('differs between buffers sharing a format', function () {
            const format = new VertexFormat(device, [
                { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 }
            ]);
            const bufferA = new VertexBuffer(device, format, 4);
            const bufferB = new VertexBuffer(device, format, 4);

            expect(bufferA.vaoKeyPart).to.not.equal(bufferB.vaoKeyPart);

            bufferA.destroy();
            bufferB.destroy();
        });

        it('differs between formats', function () {
            const bufferA = createBuffer(SEMANTIC_POSITION, 3);
            const bufferB = createBuffer(SEMANTIC_ATTR0, 4);

            expect(bufferA.format.renderingHash).to.not.equal(bufferB.format.renderingHash);
            expect(bufferA.vaoKeyPart).to.not.equal(bufferB.vaoKeyPart);

            bufferA.destroy();
            bufferB.destroy();
        });

        it('concatenates unambiguously, so distinct buffer lists give distinct keys', function () {
            // Without a delimiter, parts such as "1" + "23" and "12" + "3" both concatenate to "123".
            const buffers = [
                createBuffer(SEMANTIC_POSITION, 3),
                createBuffer(SEMANTIC_ATTR0, 4),
                createBuffer(SEMANTIC_ATTR0, 2)
            ];

            const keyOf = list => list.reduce((key, buffer) => key + buffer.vaoKeyPart, '');

            const keys = new Set([
                keyOf([buffers[0], buffers[1]]),
                keyOf([buffers[1], buffers[0]]),
                keyOf([buffers[0], buffers[2]]),
                keyOf([buffers[1], buffers[2]]),
                keyOf([buffers[0], buffers[1], buffers[2]])
            ]);

            expect(keys.size).to.equal(5);

            buffers.forEach(buffer => buffer.destroy());
        });
    });
});
