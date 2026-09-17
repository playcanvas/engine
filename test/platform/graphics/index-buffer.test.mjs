import { expect } from 'chai';

import { INDEXFORMAT_UINT16, INDEXFORMAT_UINT32 } from '../../../src/platform/graphics/constants.js';
import { IndexBuffer } from '../../../src/platform/graphics/index-buffer.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';

describe('IndexBuffer', function () {

    /** @type {NullGraphicsDevice} */
    let device;

    beforeEach(function () {
        device = new NullGraphicsDevice({ width: 100, height: 100 });
    });

    afterEach(function () {
        device.destroy();
        device = null;
    });

    describe('#writeData', function () {

        it('writes into storage supplied as an ArrayBuffer', function () {
            const buffer = new IndexBuffer(device, INDEXFORMAT_UINT16, 3);

            buffer.writeData(new Uint16Array([4, 5, 6]), 3);

            const indices = [];
            expect(buffer.readData(indices)).to.equal(3);
            expect(indices).to.deep.equal([4, 5, 6]);

            buffer.destroy();
        });

        it('writes into storage supplied as a typed array', function () {
            // Regression test - the write used to be applied to a detached copy of the storage,
            // rather than to the storage itself, so it never reached the GPU. Reachable through
            // Mesh#setIndices on any GLB-loaded mesh, as the GLB parser supplies typed arrays.
            const indices = new Uint16Array([1, 2, 3]);
            const buffer = new IndexBuffer(device, INDEXFORMAT_UINT16, 3, undefined, indices);

            buffer.writeData(new Uint16Array([4, 5, 6]), 3);

            expect(Array.from(indices)).to.deep.equal([4, 5, 6]);

            buffer.destroy();
        });

        it('writes only the requested count', function () {
            const indices = new Uint32Array([1, 2, 3]);
            const buffer = new IndexBuffer(device, INDEXFORMAT_UINT32, 3, undefined, indices);

            buffer.writeData([4, 5, 6], 2);

            expect(Array.from(indices)).to.deep.equal([4, 5, 3]);

            buffer.destroy();
        });
    });

    describe('#readData', function () {

        it('reads from storage supplied as a typed array', function () {
            const indices = new Uint32Array([1, 2, 3]);
            const buffer = new IndexBuffer(device, INDEXFORMAT_UINT32, 3, undefined, indices);

            const read = new Uint32Array(3);
            expect(buffer.readData(read)).to.equal(3);
            expect(Array.from(read)).to.deep.equal([1, 2, 3]);

            buffer.destroy();
        });

        it('reads from storage that is a typed array view into a larger buffer', function () {
            const backing = new Uint32Array([7, 7, 1, 2, 3, 7, 7]);
            const buffer = new IndexBuffer(device, INDEXFORMAT_UINT32, 3, undefined, backing.subarray(2, 5));

            const read = [];
            expect(buffer.readData(read)).to.equal(3);
            expect(read).to.deep.equal([1, 2, 3]);

            buffer.destroy();
        });
    });
});
