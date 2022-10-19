import { AnimCurve } from '../../../../src/framework/anim/evaluator/anim-curve.js';
import { INTERPOLATION_CUBIC } from '../../../../src/framework/anim/constants.js';
import { expect } from 'chai';

describe('AnimCurve', function () {
    const animCurve = new AnimCurve(
        ['path/to/entity1', 'path/to/entity2'],
        1,
        2,
        INTERPOLATION_CUBIC
    );

    describe('#constructor', function () {

        it('instantiates correctly', function () {
            expect(animCurve).to.be.ok;
        });

    });

    describe('#paths', function () {

        it('can retrieve the curve paths', function () {
            expect(animCurve.paths.length).to.equal(2);
            expect(animCurve.paths).to.deep.equal(['path/to/entity1', 'path/to/entity2']);
        });

    });

    describe('#input', function () {

        it('can retrieve the input value', function () {
            expect(animCurve.input).to.equal(1);
        });

    });

    describe('#output', function () {

        it('can retrieve the output value', function () {
            expect(animCurve.output).to.equal(2);
        });

    });

    describe('#interpolation', function () {

        it('can retrieve the interpolation value', function () {
            expect(animCurve.interpolation).to.equal(INTERPOLATION_CUBIC);
        });

    });

});
