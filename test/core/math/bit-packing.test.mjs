import { BitPacking } from '../../../src/core/math/bit-packing.js';

import { expect } from 'chai';

describe('BitPacking', function () {

    describe('#set', function () {

        it('sets bits', function () {

            let d = 0;
            d = BitPacking.set(d, 0b11, 1, 0b11);
            expect(d).to.equal(0b110);
            d = BitPacking.set(d, 0, 1, 0b11);
            expect(d).to.equal(0);
            d = BitPacking.set(d, 1, 3);
            expect(d).to.equal(0b1000);
        });
    });

    describe('#get', function () {
        it('gets bits', function () {

            const d = 0b110011;
            expect(BitPacking.get(d, 0, 0b111111)).to.equal(d);
            expect(BitPacking.get(d, 4, 0b11)).to.equal(0b11);
            expect(BitPacking.get(d, 3)).to.equal(0);
            expect(BitPacking.get(d, 5)).to.equal(1);
        });
    });

    describe('#any', function () {
        it('any', function () {

            const d = 0b110011;
            expect(BitPacking.any(d, 0, 0b111111)).to.equal(true);
            expect(BitPacking.any(d, 2, 0b11)).to.equal(false);
            expect(BitPacking.any(d, 2, 0b111)).to.equal(true);
        });
    });

    describe('#all', function () {
        it('all', function () {

            const d = 0b110011;
            expect(BitPacking.all(d, 0, 0b111111)).to.equal(false);
            expect(BitPacking.all(d, 2, 0b11)).to.equal(false);
            expect(BitPacking.all(d, 4, 0b11)).to.equal(true);
        });
    });
});
