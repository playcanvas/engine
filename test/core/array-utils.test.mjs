import { expect } from 'chai';

import { array } from '../../src/core/array-utils.js';

describe('array', function () {

    describe('#equals', function () {

        it('returns true for arrays with the same elements', function () {
            expect(array.equals([1, 2, 3], [1, 2, 3])).to.be.true;
            expect(array.equals(['a', 'b'], ['a', 'b'])).to.be.true;
        });

        it('returns true for two empty arrays', function () {
            expect(array.equals([], [])).to.be.true;
        });

        it('returns true for the same array instance', function () {
            const arr = [1, 2, 3];
            expect(array.equals(arr, arr)).to.be.true;
        });

        it('returns false for arrays of different lengths', function () {
            expect(array.equals([1, 2], [1, 2, 3])).to.be.false;
            expect(array.equals([1, 2, 3], [1, 2])).to.be.false;
            expect(array.equals([], [1])).to.be.false;
        });

        it('returns false when an element differs', function () {
            expect(array.equals([1, 2, 3], [1, 4, 3])).to.be.false;
            expect(array.equals(['a'], ['b'])).to.be.false;
        });

        it('compares the elements strictly', function () {
            expect(array.equals([1], ['1'])).to.be.false;
            expect(array.equals([0], [false])).to.be.false;
            expect(array.equals([{}], [{}])).to.be.false;
        });

        it('compares a typed array with a plain array of the same values', function () {
            expect(array.equals(new Float32Array([1, 2]), [1, 2])).to.be.true;
            expect(array.equals(new Uint8Array([1, 2]), [1, 3])).to.be.false;
        });
    });
});
