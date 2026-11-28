import vm from 'node:vm';

import { expect } from 'chai';

import { Tags } from '../../src/core/tags.js';

describe('Tags', function () {

    describe('#add()', function () {

        it('adds the tags of an array from another realm', function () {
            const tags = new Tags();

            // as an array from another window or iframe is, this is no instance of Array
            const query = vm.runInNewContext('["level-1", "mob"]');
            expect(query).to.not.be.an.instanceof(Array);

            expect(tags.add(query)).to.equal(true);
            expect(tags.list()).to.deep.equal(['level-1', 'mob']);
        });

    });

    describe('#remove()', function () {

        it('removes the tags of an array from another realm', function () {
            const tags = new Tags();
            tags.add('level-1', 'mob', 'ui');

            const query = vm.runInNewContext('["level-1", "mob"]');
            expect(query).to.not.be.an.instanceof(Array);

            expect(tags.remove(query)).to.equal(true);
            expect(tags.list()).to.deep.equal(['ui']);
        });

    });

    describe('#has()', function () {

        it('checks for all the tags of an array from another realm', function () {
            const tags = new Tags();
            tags.add('level-1', 'mob');

            const present = vm.runInNewContext('["level-1", "mob"]');
            const missing = vm.runInNewContext('["level-1", "ui"]');
            expect(present).to.not.be.an.instanceof(Array);

            expect(tags.has(present)).to.equal(true);
            expect(tags.has(missing)).to.equal(false);
            expect(tags.has(missing, present)).to.equal(true);
        });

    });

});
