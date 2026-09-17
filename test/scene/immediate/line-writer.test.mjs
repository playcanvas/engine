import { expect } from 'chai';

import { Color } from '../../../src/core/math/color.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { ImmediateBatch } from '../../../src/scene/immediate/immediate-batch.js';
import { LineWriter } from '../../../src/scene/immediate/line-writer.js';

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

describe('LineWriter', function () {

    let device;
    let batch;
    let writer;

    beforeEach(function () {
        device = new NullGraphicsDevice({ id: 'mock' });
        batch = new ImmediateBatch(device, { transparent: false }, null);
        writer = new LineWriter();
    });

    afterEach(function () {
        device.destroy();
    });

    // claims a region on the batch and points the writer at it, as Immediate#allocateLines does
    const allocate = (count, color = Color.WHITE) => {
        const first = batch.allocate(count);
        writer.reset(batch._positions, batch._colors, first, count, color);
        return first;
    };

    it('starts out filled, so a fresh writer never blocks an allocation', function () {
        expect(writer.filled).to.equal(true);
    });

    it('writes a segment into the batch storage', function () {
        allocate(2, new Color(0.2, 0.4, 0.6, 0.8));
        writer.segment(1, 2, 3, 4, 5, 6);

        expect(Array.from(batch._positions.subarray(0, 6))).to.deep.equal([1, 2, 3, 4, 5, 6]);
        expect(Array.from(batch._colors.subarray(0, 8)).map(v => +v.toFixed(3))).to.deep.equal([
            0.2, 0.4, 0.6, 0.8,
            0.2, 0.4, 0.6, 0.8
        ]);
        expect(writer.filled).to.equal(true);
    });

    it('writes individual vertices with their own colors', function () {
        allocate(2);
        writer.vertex(1, 1, 1, 1, 0, 0, 1);
        writer.vertex(2, 2, 2, 0, 0, 1, 1);

        expect(Array.from(batch._positions.subarray(0, 6))).to.deep.equal([1, 1, 1, 2, 2, 2]);
        expect(Array.from(batch._colors.subarray(0, 8))).to.deep.equal([
            1, 0, 0, 1,
            0, 0, 1, 1
        ]);
    });

    it('writes at the allocated offset, leaving earlier data alone', function () {
        allocate(2, Color.RED);
        writer.segment(1, 1, 1, 2, 2, 2);

        const first = allocate(2, Color.BLUE);
        expect(first).to.equal(2);
        writer.segment(3, 3, 3, 4, 4, 4);

        expect(batch._vertexCount).to.equal(4);
        expect(Array.from(batch._positions.subarray(0, 12))).to.deep.equal([
            1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4
        ]);
        expect(Array.from(batch._colors.subarray(0, 4))).to.deep.equal([1, 0, 0, 1]);
        expect(Array.from(batch._colors.subarray(8, 12))).to.deep.equal([0, 0, 1, 1]);
    });

    it('reports not filled until the whole region is written', function () {
        allocate(4);
        expect(writer.filled).to.equal(false);
        writer.segment(0, 0, 0, 1, 1, 1);
        expect(writer.filled).to.equal(false);
        writer.segment(2, 2, 2, 3, 3, 3);
        expect(writer.filled).to.equal(true);
    });

    it('honors a color change between segments', function () {
        allocate(4, Color.RED);
        writer.segment(0, 0, 0, 1, 1, 1);
        writer.setColor(Color.GREEN);
        writer.segment(2, 2, 2, 3, 3, 3);

        expect(Array.from(batch._colors.subarray(0, 4))).to.deep.equal([1, 0, 0, 1]);
        expect(Array.from(batch._colors.subarray(8, 12))).to.deep.equal([0, 1, 0, 1]);
    });

    it('asserts when a segment would write past the allocation', function () {
        allocate(2);
        writer.segment(0, 0, 0, 1, 1, 1);

        const count = withAssertCount(() => {
            writer.segment(2, 2, 2, 3, 3, 3);
        });
        expect(count).to.equal(1);
    });

    it('asserts when a vertex would write past the allocation', function () {
        allocate(1);
        writer.vertex(0, 0, 0, 1, 1, 1, 1);

        const count = withAssertCount(() => {
            writer.vertex(1, 1, 1, 1, 1, 1, 1);
        });
        expect(count).to.equal(1);
    });

    it('sees the reallocated storage when the batch has to grow', function () {
        // fill past the minimum capacity so the next allocation reallocates
        allocate(200);
        const original = batch._positions;
        for (let i = 0; i < 100; i++) {
            writer.segment(i, i, i, i, i, i);
        }

        allocate(200);
        expect(batch._positions).to.not.equal(original);

        // the writer must be pointing at the new storage, not the abandoned one
        writer.segment(7, 8, 9, 10, 11, 12);
        expect(Array.from(batch._positions.subarray(200 * 3, 200 * 3 + 6)))
        .to.deep.equal([7, 8, 9, 10, 11, 12]);
    });
});
