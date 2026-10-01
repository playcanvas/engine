import { expect } from 'chai';

import { hashCode, hash32Fnv1a } from '../../src/core/hash.js';

describe('hashCode', function () {

    it('returns 0 for the empty string', function () {
        expect(hashCode('')).to.equal(0);
    });

    it('returns the same hash for the same string', function () {
        expect(hashCode('abc')).to.equal(hashCode('abc'));
    });

    it('returns different hashes for different strings', function () {
        expect(hashCode('abc')).to.not.equal(hashCode('def'));
    });

});

describe('[1, 2, 3]', function () {

    it('returns the same hash for the same arrays', function () {
        expect(hash32Fnv1a([1, 2, 3])).to.equal(hash32Fnv1a([1, 2, 3]));
    });

    it('returns different hashes for different arrays', function () {
        expect(hash32Fnv1a([1, 2, 3])).to.not.equal(hash32Fnv1a([3, 2, 1]));
    });

    it('returns a 32bit unsigned integer', function () {
        const hash = hash32Fnv1a([0xffffffff, 0x80000000, 12345]);
        expect(Number.isInteger(hash)).to.equal(true);
        expect(hash).to.be.at.least(0);
        expect(hash).to.be.below(2 ** 32);
    });

    it('multiplies in 32bit integer arithmetic', function () {
        // FNV-1a over 32bit words, computed exactly - a floating point multiply exceeds the 53bit
        // mantissa for these values, and so differs from it
        const reference = (values) => {
            let hash = 2166136261n;
            for (const value of values) {
                hash = ((hash ^ BigInt(value)) * 16777619n) & 0xffffffffn;
            }
            return Number(hash);
        };
        const values = [0xffffffff, 0x80000000, 0x9e3779b9, 12345, 7];
        expect(hash32Fnv1a(values)).to.equal(reference(values));
        expect(hash32Fnv1a(new Uint32Array(values))).to.equal(reference(values));
    });

});
