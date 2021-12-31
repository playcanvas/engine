import { guid } from '../../src/core/guid.js';

import { expect } from 'chai';

describe('guid', function () {

    describe('#create', function () {

        it('returns a string', function () {
            expect(guid.create()).to.be.a('string');
        });

        it('returns a string of length 36', function () {
            expect(guid.create()).to.have.length(36);
        });

        it('returns different values each time', function () {
            expect(guid.create()).to.not.equal(guid.create());
        });

    });

});
