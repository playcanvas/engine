import { AnimCurve } from '../../../../src/framework/anim/evaluator/anim-curve.js';
import { INTERPOLATION_CUBIC } from '../../../../src/framework/anim/constants.js';
import { expect } from 'chai';

describe('AnimCurve', () => {
    const animCurve = new AnimCurve(
        ['path/to/entity1', 'path/to/entity2'],
        1,
        2,
        INTERPOLATION_CUBIC
    );

    describe('#constructor', () => {

        it('instantiates correctly', () => {
            expect(animCurve).to.be.ok;
        });

    });

    describe('#paths', () => {

        it('can retrieve the curve paths', () => {
            expect(animCurve.paths.length).to.equal(2);
            expect(animCurve.paths).to.deep.equal(['path/to/entity1', 'path/to/entity2']);
        });

    });

    describe('#input', () => {

        it('can retrieve the input value', () => {
            expect(animCurve.input).to.equal(1);
        });

    });

    describe('#output', () => {

        it('can retrieve the output value', () => {
            expect(animCurve.output).to.equal(2);
        });

    });

    describe('#interpolation', () => {

        it('can retrieve the interpolation value', () => {
            expect(animCurve.interpolation).to.equal(INTERPOLATION_CUBIC);
        });

    });

});
