import { AnimTarget } from '../../../src/anim/evaluator/anim-target.js';
import { expect } from 'chai';

describe('AnimTarget', function () {

    describe('#constructor', function () {

        it('instantiates correctly with an object', function () {
            const func = {
                set: 'set',
                get: 'get'
            };
            const animTarget = new AnimTarget(func, 'vector', 3, 'path/to/entity');

            expect(animTarget).to.be.ok;
            expect(animTarget.set).to.be.equal(func.set);
            expect(animTarget.get).to.be.equal(func.get);
            expect(animTarget.type).to.be.equal('vector');
            expect(animTarget.components).to.be.equal(3);
            expect(animTarget.targetPath).to.be.equal('path/to/entity');
            expect(animTarget.isTransform).to.be.equal(false);
        });

        it('instantiates correctly with a function', function () {
            const func = () => {};
            const animTarget = new AnimTarget(func, 'vector', 3, 'path/to/entity');

            expect(animTarget).to.be.ok;
            expect(animTarget.set).to.be.equal(func);
            expect(animTarget.get).to.be.equal(undefined);
            expect(animTarget.type).to.be.equal('vector');
            expect(animTarget.components).to.be.equal(3);
            expect(animTarget.targetPath).to.be.equal('path/to/entity');
            expect(animTarget.isTransform).to.be.equal(false);
        });

        it('instantiates correctly with a transform path', function () {
            const func = () => {};
            const animTarget = new AnimTarget(func, 'vector', 3, 'path/to/entity/localScale');

            expect(animTarget).to.be.ok;
            expect(animTarget.set).to.be.equal(func);
            expect(animTarget.get).to.be.equal(undefined);
            expect(animTarget.type).to.be.equal('vector');
            expect(animTarget.components).to.be.equal(3);
            expect(animTarget.targetPath).to.be.equal('path/to/entity/localScale');
            expect(animTarget.isTransform).to.be.equal(true);
        });

    });

});
