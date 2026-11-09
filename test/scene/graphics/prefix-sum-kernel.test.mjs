import { expect } from 'chai';

import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { StorageBuffer } from '../../../src/platform/graphics/storage-buffer.js';
import { PrefixSumKernel } from '../../../src/scene/graphics/prefix-sum-kernel.js';

// The Null device has no compute or storage buffer backend; stub just enough for the kernel to
// build its passes and allocate buffers. Dispatches are no-ops, so only allocation is observable.
const createDevice = () => {
    const device = new NullGraphicsDevice({ width: 16, height: 16 });
    device.supportsCompute = true;
    device.limits = { maxComputeWorkgroupsPerDimension: 65535 };
    device.createBufferImpl = () => ({ allocate() {}, destroy() {}, clear() {}, loseContext() {}, restoreContext() {} });
    device.createComputeImpl = () => ({ destroy() {} });
    return device;
};

// Elements scanned by one workgroup of the kernel
const ITEMS_PER_WORKGROUP = 512;

describe('PrefixSumKernel', function () {

    describe('#resize', function () {

        /** @type {NullGraphicsDevice} */
        let device;

        /** @type {PrefixSumKernel} */
        let kernel;

        /** @type {StorageBuffer} */
        let data;

        beforeEach(function () {
            device = createDevice();
            kernel = new PrefixSumKernel(device);
            data = new StorageBuffer(device, ITEMS_PER_WORKGROUP * 64 * 4);
        });

        afterEach(function () {
            kernel.destroy();
            data.destroy();
            device.destroy();
        });

        it('grows the block sums when the count grows without adding a level', function () {
            kernel.resize(data, ITEMS_PER_WORKGROUP * 2);
            kernel.resize(data, ITEMS_PER_WORKGROUP * 8);
            expect(kernel.passes.length).to.equal(2);
            expect(kernel.passes[0].blockSumBuffer.byteSize).to.equal(8 * 4);
            expect(kernel.passes[1].count).to.equal(8);
        });

        it('keeps the passes when the count shrinks', function () {
            kernel.resize(data, ITEMS_PER_WORKGROUP * 8);
            const pass = kernel.passes[0];
            kernel.resize(data, ITEMS_PER_WORKGROUP * 2);
            expect(kernel.passes[0]).to.equal(pass);
            expect(pass.count).to.equal(ITEMS_PER_WORKGROUP * 2);
            expect(kernel.passes[1].count).to.equal(2);
        });
    });
});
