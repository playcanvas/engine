import { expect } from 'chai';

import { GSplatSortBinWeights } from '../../../src/scene/gsplat-unified/gsplat-sort-bin-weights.js';
import { UnifiedSortWorker } from '../../../src/scene/gsplat-unified/gsplat-unified-sort-worker.js';

describe('UnifiedSortWorker', function () {

    // The worker's creator injects the bin weights class into the worker's scope as source text
    before(function () {
        globalThis.GSplatSortBinWeights = GSplatSortBinWeights;
    });

    after(function () {
        delete globalThis.GSplatSortBinWeights;
    });

    // Sorts one placement of splats at the given positions for a camera at the origin looking down
    // -Z, and returns the splat indices in draw order (back to front).
    const sort = (positions, { radialSorting, nearClip = 0.01, logDepthKeys = false }) => {
        let listener = null;
        let result = null;
        UnifiedSortWorker({
            addEventListener: (type, fn) => {
                listener = fn;
            },
            postMessage: (message) => {
                result = message;
            }
        });

        const centers = new Float32Array(positions.flat());
        const min = [0, 1, 2].map(axis => Math.min(...positions.map(p => p[axis])));
        const max = [0, 1, 2].map(axis => Math.max(...positions.map(p => p[axis])));

        listener({ data: { command: 'addCenters', id: 1, centers: centers.buffer } });
        listener({ data: { command: 'intervals', ids: [1], pixelOffsets: [[0]], intervals: [[]], totalActiveSplats: positions.length, version: 1 } });
        listener({
            data: {
                command: 'sort',
                // the directional sort runs along the camera's +Z, which points backwards
                sortParams: [{
                    transformedPosition: { x: 0, y: 0, z: 0 },
                    transformedDirection: { x: 0, y: 0, z: 1 },
                    offset: 0,
                    scale: 1,
                    aabbMin: min,
                    aabbMax: max
                }],
                radialSorting,
                nearClip,
                logDepthKeys,
                order: new Uint32Array(positions.length).buffer
            }
        });

        return Array.from(new Uint32Array(result.order));
    };

    describe('radial sort', function () {

        it('draws farther splats first', function () {
            const order = sort([[0, 0, 2], [0, 3, 0], [1, 0, 0], [0, 0, -4]], { radialSorting: true });
            expect(order).to.deep.equal([3, 1, 0, 2]);
        });

        it('keeps nearby splats in order when a stray splat is very far away', function () {
            // the farther of the two nearby splats comes first in the input, which is the order
            // splats sharing one sort key would be drawn in reverse of
            const order = sort([[0, 0, 2.2], [0, 0, 2], [0, 0, 1e6]], { radialSorting: true });
            expect(order).to.deep.equal([2, 0, 1]);
        });

        it('keeps splats closer than the near clip in order, as they are drawn too', function () {
            const order = sort([[0, 0, 0.08], [0, 0, 0.04], [0, 0, 10]], { radialSorting: true, nearClip: 0.1 });
            expect(order).to.deep.equal([2, 0, 1]);
        });

        it('keeps a small scene far from the camera in order', function () {
            // few splats would give few keys, spread over every doubling out from inside the near clip
            const order = sort([[0, 0, 100.5], [0, 0, 100], [0, 0, 101]], { radialSorting: true, nearClip: 0.1 });
            expect(order).to.deep.equal([2, 0, 1]);
        });
    });

    describe('depth sort', function () {

        it('draws deeper splats first', function () {
            const order = sort([[0, 0, -2], [3, 0, -3], [0, 1, -1], [0, 0, -4]], { radialSorting: false, logDepthKeys: true });
            expect(order).to.deep.equal([3, 1, 0, 2]);
        });

        it('keeps nearby splats in order when a stray splat is very far away', function () {
            const order = sort([[0, 0, -2.2], [0, 0, -2], [0, 0, -1e6]], { radialSorting: false, logDepthKeys: true });
            expect(order).to.deep.equal([2, 0, 1]);
        });

        it('keeps splats closer than the near clip in order, as they are drawn too', function () {
            const order = sort([[0, 0, -0.08], [0, 0, -0.04], [0, 0, -10]], { radialSorting: false, logDepthKeys: true, nearClip: 0.1 });
            expect(order).to.deep.equal([2, 0, 1]);
        });

        it('keeps a small scene far from the camera in order', function () {
            const order = sort([[0, 0, -100.5], [0, 0, -100], [0, 0, -101]], { radialSorting: false, logDepthKeys: true, nearClip: 0.1 });
            expect(order).to.deep.equal([2, 0, 1]);
        });

        it('draws splats behind the camera after those in front of it, in the order of their depth', function () {
            // a shader can move splats from behind the camera into view: here a modifier that moves
            // every center by -2 along Z would show the two behind it at depths 1.5 and 1. The
            // nearer of them comes first in the input, which splats sharing a key draw in reverse of
            const order = sort([[0, 0, -2], [0, 0, 0.5], [0, 0, -1], [0, 0, 1]], { radialSorting: false, logDepthKeys: true });
            expect(order).to.deep.equal([0, 2, 1, 3]);
        });

        it('orders splats behind an orthographic camera by their depth bins', function () {
            const order = sort([[0, 0, 2], [0, 0, -3], [0, 0, 1], [0, 0, -1]], { radialSorting: false, logDepthKeys: false });
            expect(order).to.deep.equal([1, 3, 2, 0]);
        });
    });
});
