import { AnimCurve } from '../../../src/anim/evaluator/anim-curve.js';
import { INTERPOLATION_CUBIC } from '../../../src/anim/constants.js';
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
            expect(animCurve.paths.length).to.be.equal(2);
            expect(animCurve.paths[0]).to.be.equal('path/to/entity1');
            expect(animCurve.paths[1]).to.be.equal('path/to/entity2');
        });

    });

    describe('#input', function () {

        it('can retrieve the input value', function () {
            expect(animCurve.input).to.be.equal(1);
        });

    });

    describe('#output', function () {

        it('can retrieve the output value', function () {
            expect(animCurve.output).to.be.equal(2);
        });

    });

    describe('#interpolation', function () {

        it('can retrieve the interpolation value', function () {
            expect(animCurve.interpolation).to.be.equal(INTERPOLATION_CUBIC);
        });

    });

});
