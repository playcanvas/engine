import { expect } from 'chai';

import { SORTMODE_MATERIALMESH } from '../../../src/scene/constants.js';
import { Layer } from '../../../src/scene/layer.js';
import { MeshInstanceSorter } from '../../../src/scene/renderer/mesh-instance-sorter.js';

// a deterministic random sequence
const random = seed => () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
};

// items with keys drawn from the given numbers of distinct values, the least significant key first
const makeItems = (count, values, rnd) => Array.from({ length: count }, (_, index) => ({
    index,
    keys: values.map(n => (rnd() * n) >>> 0)
}));

// the order a stable comparison sort gives, by the most significant key first
const compareKeys = (a, b) => {
    for (let k = a.keys.length - 1; k >= 0; k--) {
        if (a.keys[k] !== b.keys[k]) {
            return a.keys[k] - b.keys[k];
        }
    }
    return 0;
};

// sorts the items by their keys with the radix sort of the sorter
const radixSort = (sorter, items, count = items.length) => {
    const numKeys = items.length ? items[0].keys.length : 1;
    const keys = sorter._prepare(count, numKeys);
    for (let k = 0; k < numKeys; k++) {
        for (let i = 0; i < count; i++) {
            keys[k][i] = items[i].keys[k];
        }
    }
    sorter._sort(items, count, numKeys);
};

// stand-ins for mesh instances, over the given numbers of materials and meshes, in a random order
// as culling leaves them
const makeMeshInstances = (count, materials, meshes, rnd) => {
    const meshList = Array.from({ length: meshes }, (_, i) => ({ id: 1000 + i * 7 }));
    return Array.from({ length: count }, (_, index) => ({
        index,
        mesh: meshList[(rnd() * meshes) >>> 0],
        _sortKeyForward: (64 << 23) | (rnd() < 0.2 ? 0x400000 : 0) | (5000 + ((rnd() * materials) >>> 0) * 3)
    }));
};

// the comparator the renderers sorted the mesh instances with before the radix sort, which has to
// give the same order
const compareMaterialMesh = (a, b) => {
    if (a._sortKeyForward === b._sortKeyForward) {
        return b.mesh.id - a.mesh.id;
    }
    return b._sortKeyForward - a._sortKeyForward;
};

const counts = [0, 1, 2, 10, 20, 64, 100, 1000, 20000];

describe('MeshInstanceSorter', function () {

    describe('#sortMaterialMesh', function () {

        it('sorts as the material and mesh comparator does, for any number of distinct keys', function () {
            const rnd = random(5);
            const sorter = new MeshInstanceSorter();
            for (const count of counts) {
                for (const [materials, meshes] of [[1, 1], [3, 2], [1000, 5000]]) {
                    const meshInstances = makeMeshInstances(count, materials, meshes, rnd);
                    const sorted = meshInstances.slice();
                    sorter.sortMaterialMesh(sorted);
                    expect(sorted).to.deep.equal(meshInstances.slice().sort(compareMaterialMesh));
                }
            }
        });

        it('sorts the opaque instances of a layer', function () {
            const rnd = random(11);
            const sorter = new MeshInstanceSorter();
            const layer = new Layer({ name: 'test', opaqueSortMode: SORTMODE_MATERIALMESH });
            const camera = {};
            for (const count of counts) {
                const meshInstances = makeMeshInstances(count, 100, 100, rnd);
                const culled = layer.getCulledInstances(camera);
                culled.opaque = meshInstances.slice();
                layer.sortVisible(camera, false, sorter);
                expect(culled.opaque).to.deep.equal(meshInstances.slice().sort(compareMaterialMesh));
            }
        });
    });

    describe('radix sort', function () {

        it('orders items by any number of keys, as a stable comparison sort does', function () {
            const rnd = random(7);
            const sorter = new MeshInstanceSorter();
            for (const values of [[1000], [1, 1000], [0x10000, 300], [4000, 0x7fffffff], [3, 2, 5], [0x7fffffff, 7, 0x10000]]) {
                for (const count of [0, 1, 2, 10, 64, 500, 5000]) {
                    const items = makeItems(count, values, rnd);
                    const expected = items.slice().sort(compareKeys);
                    radixSort(sorter, items);
                    expect(items).to.deep.equal(expected);
                }
            }
        });

        it('sorts full 32 bit keys', function () {
            const sorter = new MeshInstanceSorter();
            const values = [0xffffffff, 0, 0x80000000, 0x7fffffff, 1, 0xdeadbeef, 0x00ff00ff];
            const items = values.map((key, index) => ({ index, keys: [key] }));
            radixSort(sorter, items);
            expect(items.map(item => item.keys[0])).to.deep.equal(values.slice().sort((a, b) => a - b));
        });

        it('keeps the order of items with equal keys', function () {
            const sorter = new MeshInstanceSorter();
            const items = Array.from({ length: 200 }, (_, index) => ({ index, keys: [7, index % 3] }));
            radixSort(sorter, items);
            for (let i = 1; i < items.length; i++) {
                const a = items[i - 1];
                const b = items[i];
                expect(a.keys[1] < b.keys[1] || (a.keys[1] === b.keys[1] && a.index < b.index)).to.equal(true);
            }
        });

        it('sorts only the given number of items from the start of the array', function () {
            const sorter = new MeshInstanceSorter();
            const items = [3, 1, 2, 0, 9].map((key, index) => ({ index, keys: [key] }));
            radixSort(sorter, items, 3);
            expect(items.map(item => item.index)).to.deep.equal([1, 2, 0, 3, 4]);
        });

        it('grows its buffers for longer lists and more keys, and keeps no references to the sorted items', function () {
            const rnd = random(3);
            const sorter = new MeshInstanceSorter();
            for (const [count, values] of [[10, [50, 50, 50]], [1000, [50]], [20, [50, 50]], [3000, [50, 50, 50]], [30, [50]]]) {
                const items = makeItems(count, values, rnd);
                const expected = items.slice().sort(compareKeys);
                radixSort(sorter, items);
                expect(items).to.deep.equal(expected);
            }
            expect(sorter._sorted.every(item => item === null)).to.equal(true);
        });
    });
});
