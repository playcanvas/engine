import { expect } from 'chai';

import { SEMANTIC_ATTR0, SEMANTIC_POSITION, TYPE_FLOAT32 } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { VertexBuffer } from '../../../src/platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { VertexIterator } from '../../../src/platform/graphics/vertex-iterator.js';

// runs the function with console.error suppressed, and returns the number of debug asserts it fired
const withAssertCount = (fn) => {
    const error = console.error;
    let count = 0;
    console.error = () => {
        count++;
    };
    try {
        fn();
    } finally {
        console.error = error;
    }
    return count;
};

describe('VertexIterator', function () {

    /** @type {NullGraphicsDevice} */
    let device;

    beforeEach(function () {
        device = new NullGraphicsDevice({ width: 100, height: 100 });
    });

    afterEach(function () {
        device.destroy();
        device = null;
    });

    describe('accessor aliasing', function () {

        // interleaved, so the second element sits at a non-zero offset within each vertex
        const createFormat = () => new VertexFormat(device, [
            { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR0, components: 2, type: TYPE_FLOAT32 }
        ]);

        it('views the storage at each element offset when it is an ArrayBuffer', function () {
            const buffer = new VertexBuffer(device, createFormat(), 4);

            let iterator;
            const asserts = withAssertCount(() => {
                iterator = new VertexIterator(buffer);
            });

            expect(asserts).to.equal(0);
            expect(iterator.element[SEMANTIC_POSITION].array.buffer).to.equal(buffer.storage);
            expect(iterator.element[SEMANTIC_POSITION].array.byteOffset).to.equal(0);
            expect(iterator.element[SEMANTIC_ATTR0].array.byteOffset).to.equal(12);

            buffer.destroy();
        });

        it('writes through to the storage when it is an ArrayBuffer', function () {
            const buffer = new VertexBuffer(device, createFormat(), 4);

            const iterator = new VertexIterator(buffer);
            iterator.element[SEMANTIC_POSITION].set(1, 2, 3);
            iterator.end();

            expect(Array.from(new Float32Array(buffer.storage, 0, 3))).to.deep.equal([1, 2, 3]);

            buffer.destroy();
        });

        it('asserts when the storage is a typed array, as the accessors are then copies', function () {
            // The accessors are built with the typed array copy constructor in this case, which
            // ignores the offset and length, so they no longer alias the buffer and writes to them
            // are lost. Guarded rather than fixed - see the TODO in VertexIteratorAccessor.
            const format = createFormat();
            const buffer = new VertexBuffer(device, format, 4, {
                data: new Float32Array(format.size * 4 / 4)
            });

            const asserts = withAssertCount(() => {
                const iterator = new VertexIterator(buffer);
                expect(iterator.element[SEMANTIC_ATTR0].array.byteOffset).to.equal(0);
            });

            // one per element of the format
            expect(asserts).to.equal(2);

            buffer.destroy();
        });
    });
});
