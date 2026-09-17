import { expect } from 'chai';

import { BufferUtils } from '../../../src/platform/graphics/buffer-utils.js';
import { INDEXFORMAT_UINT32, SEMANTIC_POSITION, TYPE_FLOAT32 } from '../../../src/platform/graphics/constants.js';
import { IndexBuffer } from '../../../src/platform/graphics/index-buffer.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { VertexBuffer } from '../../../src/platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';

describe('BufferUtils', function () {

    /** @type {NullGraphicsDevice} */
    let device;

    beforeEach(function () {
        device = new NullGraphicsDevice({ width: 100, height: 100 });
    });

    afterEach(function () {
        device.destroy();
        device = null;
    });

    describe('#createStorageView', function () {

        // 4 vertices of 3 floats
        const createVertexBuffer = options => new VertexBuffer(device, new VertexFormat(device, [
            { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 }
        ]), 4, options);

        it('aliases storage supplied as an ArrayBuffer', function () {
            const buffer = createVertexBuffer();

            const view = BufferUtils.createStorageView(buffer, Float32Array);
            view[1] = 42;

            expect(view.length).to.equal(12);
            expect(new Float32Array(buffer.storage)[1]).to.equal(42);

            buffer.destroy();
        });

        it('aliases storage supplied as a typed array', function () {
            const data = new Float32Array(12);
            const buffer = createVertexBuffer({ data });

            const view = BufferUtils.createStorageView(buffer, Float32Array);
            view[1] = 42;

            expect(view.length).to.equal(12);
            expect(data[1]).to.equal(42);

            buffer.destroy();
        });

        it('aliases storage that is a typed array view into a larger buffer', function () {
            // 12 floats sitting in the middle of a larger buffer
            const backing = new Float32Array(16).fill(7);
            const buffer = createVertexBuffer({ data: backing.subarray(2, 14) });

            const view = BufferUtils.createStorageView(buffer, Float32Array);
            view[0] = 42;

            // the view is confined to the buffer's own range, and writes land in it
            expect(view.length).to.equal(12);
            expect(backing[1]).to.equal(7);
            expect(backing[2]).to.equal(42);
            expect(backing[14]).to.equal(7);

            buffer.destroy();
        });

        it('applies a byte offset on top of the storage offset', function () {
            const backing = new Float32Array(16).fill(7);
            backing[5] = 42;
            const buffer = createVertexBuffer({ data: backing.subarray(2, 14) });

            // skip the first vertex
            const view = BufferUtils.createStorageView(buffer, Float32Array, 12);

            expect(view.length).to.equal(9);
            expect(view[0]).to.equal(42);

            buffer.destroy();
        });

        it('honours an explicit length', function () {
            const buffer = createVertexBuffer();

            expect(BufferUtils.createStorageView(buffer, Float32Array, 0, 3).length).to.equal(3);

            buffer.destroy();
        });

        it('creates a view of the element type, not of the storage type', function () {
            const buffer = new IndexBuffer(device, INDEXFORMAT_UINT32, 3, undefined, new Uint8Array(12));

            const view = BufferUtils.createStorageView(buffer, Uint32Array);

            expect(view).to.be.an.instanceof(Uint32Array);
            expect(view.length).to.equal(3);

            buffer.destroy();
        });
    });
});
