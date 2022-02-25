import { hashCode } from '../../src/core/hash.js';

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
