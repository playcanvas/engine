import { expect } from 'chai';

import { Color } from '../../../src/core/math/color.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { ImmediateBatch } from '../../../src/scene/immediate/immediate-batch.js';

// these mirror the private constants in immediate-batch.js
const MIN_VERTEX_CAPACITY = 256;
const SHRINK_FRAME_DELAY = 100;

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

describe('ImmediateBatch', function () {

    let device;
    let batch;

    beforeEach(function () {
        device = new NullGraphicsDevice({ id: 'mock' });
        batch = new ImmediateBatch(device, { transparent: false }, null);
    });

    afterEach(function () {
        device.destroy();
    });

    // advances the batch by the given number of empty frames
    const idleFrames = (count) => {
        for (let i = 0; i < count; i++) {
            batch.clear();
        }
    };

    const positions = (count) => {
        const result = [];
        for (let i = 0; i < count; i++) {
            result.push(new Vec3(i, i * 2, i * 3));
        }
        return result;
    };

    describe('#addLines', function () {

        it('writes positions and a uniform color', function () {
            batch.addLines([new Vec3(1, 2, 3), new Vec3(4, 5, 6)], new Color(0.25, 0.5, 0.75, 1));

            expect(batch._vertexCount).to.equal(2);
            expect(Array.from(batch._positions.subarray(0, 6))).to.deep.equal([1, 2, 3, 4, 5, 6]);
            expect(Array.from(batch._colors.subarray(0, 8))).to.deep.equal([
                0.25, 0.5, 0.75, 1,
                0.25, 0.5, 0.75, 1
            ]);
        });

        it('writes one color per vertex when given an array', function () {
            batch.addLines([new Vec3(0, 0, 0), new Vec3(1, 1, 1)], [Color.RED, Color.BLUE]);

            expect(Array.from(batch._colors.subarray(0, 8))).to.deep.equal([
                1, 0, 0, 1,
                0, 0, 1, 1
            ]);
        });

        it('appends without disturbing data already added this frame', function () {
            batch.addLines([new Vec3(1, 1, 1), new Vec3(2, 2, 2)], Color.RED);
            batch.addLines([new Vec3(3, 3, 3), new Vec3(4, 4, 4)], Color.BLUE);

            expect(batch._vertexCount).to.equal(4);
            expect(Array.from(batch._positions.subarray(0, 12))).to.deep.equal([
                1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4
            ]);
            expect(Array.from(batch._colors.subarray(0, 4))).to.deep.equal([1, 0, 0, 1]);
            expect(Array.from(batch._colors.subarray(8, 12))).to.deep.equal([0, 0, 1, 1]);
        });

        it('asserts when the color array length does not match the positions', function () {
            const count = withAssertCount(() => {
                // reading past the end of a short color array throws, as it did before this
                // change, but the assert fires first and names the actual problem
                expect(() => batch.addLines([new Vec3(), new Vec3()], [Color.RED])).to.throw(TypeError);
            });
            expect(count).to.equal(1);
        });
    });

    describe('#addLinesArrays', function () {

        it('writes packed positions and a uniform color', function () {
            batch.addLinesArrays([1, 2, 3, 4, 5, 6], new Color(1, 1, 0, 0.5));

            expect(batch._vertexCount).to.equal(2);
            expect(Array.from(batch._positions.subarray(0, 6))).to.deep.equal([1, 2, 3, 4, 5, 6]);
            expect(Array.from(batch._colors.subarray(0, 8))).to.deep.equal([
                1, 1, 0, 0.5,
                1, 1, 0, 0.5
            ]);
        });

        it('writes packed per-vertex colors', function () {
            batch.addLinesArrays([0, 0, 0, 1, 1, 1], [1, 0, 0, 1, 0, 1, 0, 1]);

            expect(Array.from(batch._colors.subarray(0, 8))).to.deep.equal([
                1, 0, 0, 1,
                0, 1, 0, 1
            ]);
        });

        it('accepts a typed array', function () {
            batch.addLinesArrays(new Float32Array([1, 2, 3, 4, 5, 6]), Color.WHITE);
            expect(Array.from(batch._positions.subarray(0, 6))).to.deep.equal([1, 2, 3, 4, 5, 6]);
        });

        it('asserts when the color array length does not match the positions', function () {
            const count = withAssertCount(() => {
                batch.addLinesArrays([0, 0, 0, 1, 1, 1], [1, 0, 0, 1]);
            });
            expect(count).to.equal(1);
        });
    });

    describe('capacity', function () {

        it('allocates nothing until used', function () {
            expect(batch._capacity).to.equal(0);
            expect(batch._positions.length).to.equal(0);
        });

        it('allocates the minimum capacity for a small batch', function () {
            batch.addLines([new Vec3(), new Vec3()], Color.WHITE);
            expect(batch._capacity).to.equal(MIN_VERTEX_CAPACITY);
        });

        it('grows by doubling', function () {
            batch.addLines(positions(MIN_VERTEX_CAPACITY + 1), Color.WHITE);
            expect(batch._capacity).to.equal(MIN_VERTEX_CAPACITY * 2);
        });

        it('grows enough for a single large request', function () {
            const count = MIN_VERTEX_CAPACITY * 10;
            batch.addLines(positions(count), Color.WHITE);
            expect(batch._capacity).to.be.at.least(count);
            expect(batch._positions.length).to.equal(batch._capacity * 3);
            expect(batch._colors.length).to.equal(batch._capacity * 4);
        });

        it('preserves earlier data when growth happens mid frame', function () {
            batch.addLines([new Vec3(7, 8, 9), new Vec3(10, 11, 12)], Color.RED);
            batch.addLines(positions(MIN_VERTEX_CAPACITY), Color.BLUE);

            expect(batch._capacity).to.be.above(MIN_VERTEX_CAPACITY);
            expect(Array.from(batch._positions.subarray(0, 6))).to.deep.equal([7, 8, 9, 10, 11, 12]);
            expect(Array.from(batch._colors.subarray(0, 4))).to.deep.equal([1, 0, 0, 1]);
        });

        it('retains its storage across clear', function () {
            batch.addLines(positions(MIN_VERTEX_CAPACITY * 2), Color.WHITE);
            const capacity = batch._capacity;
            const buffer = batch._positions;

            batch.clear();

            expect(batch._vertexCount).to.equal(0);
            expect(batch._capacity).to.equal(capacity);
            expect(batch._positions).to.equal(buffer);
        });
    });

    describe('shrinking', function () {

        it('hands storage back after a run of under-half usage', function () {
            batch.addLines(positions(MIN_VERTEX_CAPACITY * 4), Color.WHITE);
            expect(batch._capacity).to.be.at.least(MIN_VERTEX_CAPACITY * 4);

            // the frame that used the storage ends the previous wait, so the run of idle frames
            // starts with the one after it
            idleFrames(SHRINK_FRAME_DELAY + 1);

            expect(batch._capacity).to.equal(MIN_VERTEX_CAPACITY);
            expect(batch._positions.length).to.equal(MIN_VERTEX_CAPACITY * 3);
            expect(batch._colors.length).to.equal(MIN_VERTEX_CAPACITY * 4);
        });

        it('does not shrink before the delay has elapsed', function () {
            batch.addLines(positions(MIN_VERTEX_CAPACITY * 4), Color.WHITE);
            const grown = batch._capacity;

            idleFrames(SHRINK_FRAME_DELAY);

            expect(batch._capacity).to.equal(grown);
        });

        it('shrinks only to the peak seen while waiting', function () {
            batch.addLines(positions(MIN_VERTEX_CAPACITY * 8), Color.WHITE);
            batch.clear();

            // a mid sized frame during the wait sets the floor the batch shrinks to
            for (let i = 0; i < SHRINK_FRAME_DELAY; i++) {
                if (i === 10) {
                    batch.addLines(positions(MIN_VERTEX_CAPACITY + 1), Color.WHITE);
                }
                batch.clear();
            }

            expect(batch._capacity).to.equal(MIN_VERTEX_CAPACITY * 2);
        });

        it('does not shrink while usage stays above half the capacity', function () {
            batch.addLines(positions(MIN_VERTEX_CAPACITY * 2), Color.WHITE);
            const capacity = batch._capacity;

            for (let i = 0; i < SHRINK_FRAME_DELAY * 3; i++) {
                batch.addLines(positions(MIN_VERTEX_CAPACITY * 2), Color.WHITE);
                batch.clear();
            }

            expect(batch._capacity).to.equal(capacity);
        });

        it('never shrinks below the minimum capacity', function () {
            batch.addLines([new Vec3(), new Vec3()], Color.WHITE);
            idleFrames(SHRINK_FRAME_DELAY * 3);
            expect(batch._capacity).to.equal(MIN_VERTEX_CAPACITY);
        });
    });
});
