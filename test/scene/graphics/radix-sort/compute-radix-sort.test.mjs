import { expect } from 'chai';

import { NullGraphicsDevice } from '../../../../src/platform/graphics/null/null-graphics-device.js';
import { StorageBuffer } from '../../../../src/platform/graphics/storage-buffer.js';
import { RADIX_SORT_ONESWEEP, RADIX_SORT_PORTABLE } from '../../../../src/scene/constants.js';
import { ComputeRadixSort } from '../../../../src/scene/graphics/radix-sort/compute-radix-sort.js';

// The Null device has no compute or storage buffer backend; stub just enough for the sorters to
// build their pipelines and allocate buffers. Dispatches are no-ops, so only allocation behaviour
// is observable here.
const createDevice = () => {
    const device = new NullGraphicsDevice({ width: 16, height: 16 });
    device.supportsCompute = true;
    device.supportsSubgroups = true;
    device.minSubgroupSize = 32;
    device.maxSubgroupSize = 32;
    device.gpuAdapter = { info: { vendor: 'nvidia' } };
    device.limits = { maxComputeWorkgroupsPerDimension: 65535 };
    device.createBufferImpl = () => ({ allocate() {}, destroy() {}, clear() {}, loseContext() {}, restoreContext() {} });
    device.createComputeImpl = () => ({ destroy() {} });
    return device;
};

const backends = [
    { name: 'portable', kind: RADIX_SORT_PORTABLE, partition: 2048 },
    { name: 'OneSweep', kind: RADIX_SORT_ONESWEEP, partition: 3840 }
];

describe('ComputeRadixSort', function () {

    backends.forEach(({ name, kind, partition }) => {

        describe(`#sort (${name}) buffer allocation`, function () {

            /** @type {NullGraphicsDevice} */
            let device;

            /** @type {ComputeRadixSort} */
            let sorter;

            const sort = (count) => {
                const keys = new StorageBuffer(device, count * 4);
                sorter.sort(keys, count, 16);
                keys.destroy();
            };

            beforeEach(function () {
                device = createDevice();
                sorter = new ComputeRadixSort(device, { kind });
            });

            afterEach(function () {
                sorter.destroy();
                device.destroy();
            });

            it('sizes the result buffers to the element count', function () {
                const count = partition + 256;
                sort(count);
                expect(sorter.sortedIndices.byteSize).to.equal(count * 4);
                expect(sorter.sortedKeys.byteSize).to.equal(count * 4);
                expect(sorter.capacity).to.equal(count);
            });

            it('grows the buffers when the count grows within the same partition', function () {
                const count = partition + 256;
                sort(count);
                sort(count + 256);
                expect(sorter.sortedIndices.byteSize).to.equal((count + 256) * 4);
                expect(sorter.sortedKeys.byteSize).to.equal((count + 256) * 4);
                expect(sorter.capacity).to.equal(count + 256);
            });

            it('keeps the buffers when the count shrinks', function () {
                const count = partition + 256;
                sort(count);
                const indices = sorter.sortedIndices;
                sort(count - 1);
                expect(sorter.sortedIndices).to.equal(indices);
                expect(sorter.capacity).to.equal(count);
            });

            it('releases the result buffers when capacity is raised above the allocation', function () {
                const count = partition + 256;
                sort(count);
                sorter.capacity = count + 1;
                expect(sorter.sortedIndices).to.equal(null);
                expect(sorter.sortedKeys).to.equal(null);
                sort(count);
                expect(sorter.sortedIndices.byteSize).to.equal((count + 1) * 4);
            });

            it('keeps the result buffers when capacity is lowered, and shrinks at the next sort', function () {
                const count = partition * 2 + 256;
                sort(count);
                const indices = sorter.sortedIndices;
                sorter.capacity = partition;
                expect(sorter.sortedIndices).to.equal(indices);
                sort(partition);
                expect(sorter.sortedIndices.byteSize).to.equal(partition * 4);
            });
        });
    });
});
