import { guid } from '../../src/core/guid.js';

import { expect } from 'chai';

describe('guid', () => {

    describe('#create', () => {

        it('returns a string', () => {
            expect(guid.create()).to.be.a('string');
        });

        it('returns a string of length 36', () => {
            expect(guid.create()).to.have.length(36);
        });

        it('returns different values each time', () => {
            expect(guid.create()).to.not.equal(guid.create());
        });

    });

});
