import { AnimTrack } from '../../../../src/framework/anim/evaluator/anim-track.js';
import { AnimData } from '../../../../src/framework/anim/evaluator/anim-data.js';
import { AnimCurve } from '../../../../src/framework/anim/evaluator/anim-curve.js';
import { AnimSnapshot } from '../../../../src/framework/anim/evaluator/anim-snapshot.js';
import { INTERPOLATION_LINEAR } from '../../../../src/framework/anim/constants.js';
import { expect } from 'chai';

describe('AnimTrack', function () {
    const curves = [new AnimCurve(['path/to/entity'], 0, 0, INTERPOLATION_LINEAR)];
    const inputs = [new AnimData(1, [0, 1, 2])];
    const outputs = [new AnimData(3, [0, 0, 0, 1, 2, 3, 2, 4, 6])];
    const animTrack = new AnimTrack('track', 2, inputs, outputs, curves);

    describe('#constructor', function () {

        it('instantiates correctly', function () {
            expect(animTrack).to.be.ok;
            expect(animTrack.name).to.equal('track');
            expect(animTrack.duration).to.equal(2);
            expect(animTrack.inputs).to.equal(inputs);
            expect(animTrack.outputs).to.equal(outputs);
            expect(animTrack.curves).to.equal(curves);
        });

    });

    describe('#eval', function () {

        it('correctly updates a given snapshot', function () {
            const snapshot = new AnimSnapshot(animTrack);
            animTrack.eval(0, snapshot);
            expect(snapshot._results[0]).to.deep.equal([0, 0, 0]);
            animTrack.eval(1, snapshot);
            expect(snapshot._results[0]).to.deep.equal([1, 2, 3]);
            animTrack.eval(1.5, snapshot);
            expect(snapshot._results[0]).to.deep.equal([1.5, 3, 4.5]);
        });

    });

});

describe('EmptyAnimTrack', function () {
    const emptyAnimTrack = AnimTrack.EMPTY;

    describe('#constructor', function () {

        it('instantiates correctly', function () {
            expect(emptyAnimTrack).to.be.ok;
            expect(emptyAnimTrack.name).to.equal('empty');
            expect(emptyAnimTrack.duration).to.equal(Number.MAX_VALUE);
            expect(emptyAnimTrack.inputs.length).to.equal(0);
            expect(emptyAnimTrack.outputs.length).to.equal(0);
            expect(emptyAnimTrack.curves.length).to.equal(0);
        });

    });

});
