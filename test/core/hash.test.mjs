import { hashCode, fnv1aHashUint32Array } from '../../src/core/hash.js';

import { expect } from 'chai';

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
        expect(fnv1aHashUint32Array([1, 2, 3])).to.equal(fnv1aHashUint32Array([1, 2, 3]));
    });

    it('returns different hashes for different arrays', function () {
        expect(fnv1aHashUint32Array([1, 2, 3])).to.not.equal(fnv1aHashUint32Array([3, 2, 1]));
    });

});
