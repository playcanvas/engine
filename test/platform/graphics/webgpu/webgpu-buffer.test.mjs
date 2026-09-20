import { expect } from 'chai';
import sinon from 'sinon';

import { WebgpuBuffer } from '../../../../src/platform/graphics/webgpu/webgpu-buffer.js';

describe('WebgpuBuffer', function () {

    describe('#unlock', function () {

        let device;
        let writeBuffer;

        // a buffer that is already allocated, so that unlock only uploads
        const createBuffer = (size) => {
            const buffer = new WebgpuBuffer();
            buffer.buffer = { size, label: 'TestBuffer' };
            return buffer;
        };

        beforeEach(function () {
            writeBuffer = sinon.spy();
            device = { wgpu: { queue: { writeBuffer } } };
        });

        it('writes data with a size that is a multiple of 4 directly from its storage', function () {
            const storage = new Float32Array([1, 2, 3, 4]);
            const buffer = createBuffer(storage.byteLength);
            buffer.unlock(device, storage);

            expect(writeBuffer.callCount).to.equal(1);
            const [gpuBuffer, bufferOffset, data, dataOffset, size] = writeBuffer.firstCall.args;
            expect(gpuBuffer).to.equal(buffer.buffer);
            expect(bufferOffset).to.equal(0);
            expect(data).to.equal(storage.buffer);
            expect(dataOffset).to.equal(0);
            expect(size).to.equal(16);
        });

        it('honors the byte offset of a typed array view', function () {
            const backing = new ArrayBuffer(64);
            const storage = new Float32Array(backing, 16, 4);
            const buffer = createBuffer(storage.byteLength);
            buffer.unlock(device, storage);

            const [, , data, dataOffset, size] = writeBuffer.firstCall.args;
            expect(data).to.equal(backing);
            expect(dataOffset).to.equal(16);
            expect(size).to.equal(16);
        });

        it('accepts an ArrayBuffer as the storage', function () {
            const storage = new ArrayBuffer(32);
            const buffer = createBuffer(32);
            buffer.unlock(device, storage);

            const [, , data, dataOffset, size] = writeBuffer.firstCall.args;
            expect(data).to.equal(storage);
            expect(dataOffset).to.equal(0);
            expect(size).to.equal(32);
        });

        it('does not expand unaligned partial ranges if an internal caller bypasses public validation', function () {
            const storage = new Uint8Array(16);
            const buffer = createBuffer(16);
            buffer.unlock(device, storage, 4, 6);

            const [, bufferOffset, data, dataOffset, size] = writeBuffer.firstCall.args;
            expect(bufferOffset).to.equal(4);
            expect(data).to.equal(storage.buffer);
            expect(dataOffset).to.equal(4);
            expect(size).to.equal(6);
        });

        it('does not pad an unaligned prefix that starts at zero', function () {
            const storage = new Uint8Array(16);
            const buffer = createBuffer(16);
            buffer.unlock(device, storage, 0, 6);

            const [, , data, , size] = writeBuffer.firstCall.args;
            expect(data).to.equal(storage.buffer);
            expect(size).to.equal(6);
        });

        it('pads odd-sized data through a copy', function () {
            const storage = new Uint8Array([1, 2, 3, 4, 5, 6]);
            const buffer = createBuffer(8);
            buffer.unlock(device, storage);

            const [, , data, dataOffset, size] = writeBuffer.firstCall.args;
            expect(data).to.be.instanceOf(Uint8Array);
            expect(data.buffer).to.not.equal(storage.buffer);
            expect(Array.from(data)).to.deep.equal([1, 2, 3, 4, 5, 6, 0, 0]);
            expect(dataOffset).to.equal(0);
            expect(size).to.equal(8);
        });

    });

});
