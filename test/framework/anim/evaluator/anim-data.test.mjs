import { AnimData } from '../../../../src/framework/anim/evaluator/anim-data.js';
import { expect } from 'chai';

describe('AnimData', function () {

    describe('#constructor', function () {
        const animData = new AnimData(1, [0, 1, 2]);

        it('instantiates correctly', function () {
            expect(animData).to.be.ok;
        });

    });

    describe('#components', function () {
        const animData = new AnimData(1, [0, 1, 2]);

        it('can retrieve the number of components', function () {
            expect(animData.components).to.equal(1);
        });

    });

    describe('#data', function () {
        const animData = new AnimData(1, [0, 1, 2]);

        it('can retrieve the number of components', function () {
            expect(animData.data.length).to.equal(3);
            expect(animData.data).to.deep.equal([0, 1, 2]);
        });

    });

});
