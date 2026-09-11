import { expect } from 'chai';
import sinon from 'sinon';

import { WebgpuGraphicsDevice } from '../../../../src/platform/graphics/webgpu/webgpu-graphics-device.js';

describe('WebGPU buffer readback', function () {
    const originalMapMode = globalThis.GPUMapMode;

    before(function () {
        globalThis.GPUMapMode = { READ: 1 };
    });

    after(function () {
        if (originalMapMode === undefined) {
            delete globalThis.GPUMapMode;
        } else {
            globalThis.GPUMapMode = originalMapMode;
        }
    });

    it('copies a mapped result into the caller array and releases the staging buffer', async function () {
        const source = new Uint32Array([3, 5]);
        const destination = new Uint32Array(2);
        const buffer = {
            mapAsync: sinon.stub().resolves(),
            getMappedRange: sinon.stub().returns(source.buffer),
            unmap: sinon.spy()
        };
        const staging = { buffer, destroy: sinon.spy() };
        const device = { submit: sinon.spy() };
        const result = await WebgpuGraphicsDevice.prototype.readBuffer.call(device, staging, 8, destination, true);
        expect(result).to.equal(destination);
        expect([...result]).to.deep.equal([3, 5]);
        expect(device.submit.calledBefore(buffer.mapAsync)).to.be.true;
        expect(buffer.unmap.calledOnce).to.be.true;
        expect(staging.destroy.calledOnceWithExactly(device)).to.be.true;
    });

    for (const name of ['AbortError', 'OperationError']) {
        it(`preserves ${name} before the device-lost event and releases the staging buffer`, async function () {
            const error = new DOMException('Mapping failed', name);
            const buffer = { mapAsync: sinon.stub().rejects(error), unmap: sinon.spy() };
            const staging = { buffer, destroy: sinon.spy() };
            const device = { contextLost: false };
            let rejection;
            try {
                await WebgpuGraphicsDevice.prototype.readBuffer.call(device, staging, 8);
            } catch (error) {
                rejection = error;
            }
            expect(rejection).to.equal(error);
            expect(buffer.unmap.calledOnce).to.be.true;
            expect(staging.destroy.calledOnceWithExactly(device)).to.be.true;
        });
    }

    it('rejects and cleans up when copying the mapped result fails', async function () {
        const error = new Error('Mapped range unavailable');
        const buffer = {
            mapAsync: sinon.stub().resolves(),
            getMappedRange: sinon.stub().throws(error),
            unmap: sinon.spy()
        };
        const staging = { buffer, destroy: sinon.spy() };
        let rejection;
        try {
            await WebgpuGraphicsDevice.prototype.readBuffer.call({}, staging, 8);
        } catch (error) {
            rejection = error;
        }
        expect(rejection).to.equal(error);
        expect(buffer.unmap.calledOnce).to.be.true;
        expect(staging.destroy.calledOnce).to.be.true;
    });
});
