import { AnimData } from '../../../../src/framework/anim/evaluator/anim-data.js';
import { expect } from 'chai';

describe('AnimData', () => {

    describe('#constructor', () => {
        const animData = new AnimData(1, [0, 1, 2]);

        it('instantiates correctly', () => {
            expect(animData).to.be.ok;
        });

    });

    describe('#components', () => {
        const animData = new AnimData(1, [0, 1, 2]);

        it('can retrieve the number of components', () => {
            expect(animData.components).to.equal(1);
        });

    });

    describe('#data', () => {
        const animData = new AnimData(1, [0, 1, 2]);

        it('can retrieve the number of components', () => {
            expect(animData.data.length).to.equal(3);
            expect(animData.data).to.deep.equal([0, 1, 2]);
        });

    });

});
