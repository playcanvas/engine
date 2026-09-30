import { expect } from 'chai';

import { MeshInstanceStorage } from '../../../src/platform/graphics/mesh-instance-storage.js';

// the floats of a slot, see MeshInstanceStorage
const FLOATS = 28;

describe('MeshInstanceStorage', function () {

    // a device recording the writes to its buffers, as [first slot, last slot] of each
    let writes;
    let device;

    beforeEach(function () {
        writes = [];
        device = {
            scope: { resolve: () => ({ setValue() {} }) },
            buffers: new Set(),
            _vram: { sb: 0 },
            createBufferImpl: () => ({
                allocate() {},
                destroy() {},
                write(dev, bufferOffset, data, dataOffset, size) {
                    expect(dataOffset).to.equal(bufferOffset / 4);
                    writes.push([dataOffset / FLOATS, (dataOffset + size) / FLOATS - 1]);
                }
            })
        };
    });

    const model = new Float32Array(16);
    const normal = new Float32Array(9);

    const create = (capacity) => {
        const storage = new MeshInstanceStorage(device, capacity);
        while (storage.count < capacity) {
            storage.allocate();
        }
        writes.length = 0;
        return storage;
    };

    const upload = (storage, slots) => {
        slots.forEach(slot => storage.write(slot, model, normal));
        writes.length = 0;
        storage.upload();
        return writes.slice();
    };

    it('uploads the written slots in slot order, merging those at most 16 slots apart', function () {
        const storage = create(256);
        expect(upload(storage, [100, 41, 2, 0, 40, 1])).to.deep.equal([[0, 2], [40, 41], [100, 100]]);
        expect(upload(storage, [20, 5])).to.deep.equal([[5, 20]]);
        expect(upload(storage, [5, 22])).to.deep.equal([[5, 5], [22, 22]]);
    });

    it('merges across the words of the bits, the highest bit included', function () {
        const storage = create(256);
        expect(upload(storage, [31, 32])).to.deep.equal([[31, 32]]);
        expect(upload(storage, [63, 200, 255])).to.deep.equal([[63, 63], [200, 200], [255, 255]]);
    });

    it('uploads whole words of written slots in one write', function () {
        const storage = create(256);
        const all = Array.from({ length: 256 }, (_, i) => 255 - i);
        expect(upload(storage, all)).to.deep.equal([[0, 255]]);

        const firstWordAndMore = [...Array.from({ length: 32 }, (_, i) => i), 40, 100];
        expect(upload(storage, firstWordAndMore)).to.deep.equal([[0, 40], [100, 100]]);
    });

    it('uploads nothing when no slot was written, and each write once', function () {
        const storage = create(64);
        expect(upload(storage, [])).to.deep.equal([]);
        expect(upload(storage, [3, 3, 3])).to.deep.equal([[3, 3]]);
        expect(upload(storage, [])).to.deep.equal([]);
    });

    it('stores the normal matrix in three vec4 columns', function () {
        const storage = create(4);
        const m = Float32Array.from({ length: 16 }, (_, i) => i + 1);
        const n = Float32Array.from({ length: 9 }, (_, i) => 100 + i);
        storage.write(2, m, n);
        const slot = Array.from(storage.data.subarray(2 * FLOATS, 3 * FLOATS));
        expect(slot.slice(0, 16)).to.deep.equal(Array.from(m));
        expect([slot[16], slot[17], slot[18], slot[20], slot[21], slot[22], slot[24], slot[25], slot[26]]).to.deep.equal(Array.from(n));
    });

    it('uploads the pending writes to the old buffer, and all slots to the new one, when it grows', function () {
        const storage = create(32);
        const version = storage.version;
        storage.write(7, model, normal);

        // the 33rd slot grows the storage
        writes.length = 0;
        expect(storage.allocate()).to.equal(32);
        expect(storage.capacity).to.equal(64);
        expect(storage.version).to.equal(version + 1);
        expect(writes).to.deep.equal([[7, 7], [0, 31]]);

        // nothing is left pending
        writes.length = 0;
        storage.upload();
        expect(writes).to.deep.equal([]);
    });

    it('uploads all slots after the device is restored, and drops the pending writes', function () {
        const storage = create(64);
        storage.write(10, model, normal);
        writes.length = 0;
        storage.restoreContext();
        expect(writes).to.deep.equal([[0, 63]]);

        writes.length = 0;
        storage.upload();
        expect(writes).to.deep.equal([]);
    });
});
