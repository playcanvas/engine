import { AnimTrack } from '../../../src/anim/evaluator/anim-track.js';
import { AnimData } from '../../../src/anim/evaluator/anim-data.js';
import { AnimCurve } from '../../../src/anim/evaluator/anim-curve.js';
import { AnimClip } from '../../../src/anim/evaluator/anim-clip.js';
import { INTERPOLATION_LINEAR } from '../../../src/anim/constants.js';
import { expect } from 'chai';

describe('AnimClip', function () {
    let animClip;

    beforeEach(function () {
        const curves = [new AnimCurve(['path/to/entity'], 0, 0, INTERPOLATION_LINEAR)];
        const inputs = [new AnimData(1, [0, 1, 2])];
        const outputs = [new AnimData(3, [0, 0, 0, 1, 2, 3, 2, 4, 6])];
        const animTrack = new AnimTrack('track', 2, inputs, outputs, curves);
        animClip = new AnimClip(animTrack, 0, 1, true, false);
    });

    describe('#constructor', function () {

        it('instantiates correctly', function () {
            expect(animClip).to.be.ok;
            expect(animClip.name).to.equal('track');
            expect(animClip.track.name).to.equal('track');
            expect(animClip.snapshot._name).to.equal('trackSnapshot');
            expect(animClip.time).to.equal(0);
            expect(animClip.loop).to.equal(false);
        });

    });

    describe('#_update', function () {

        it('can update the clip\'s snapshot by a given deltaTime', function () {
            animClip._update(0.5);
            expect(animClip.snapshot._results[0]).to.deep.equal([0.5, 1, 1.5]);
        });

    });

    describe('#pause', function () {

        it('can stop the clip from updating', function () {
            animClip.pause();
            animClip._update(0.5);
            expect(animClip.snapshot._results[0]).to.deep.equal([0, 0, 0]);
        });

    });

    describe('#stop', function () {

        it('pauses the clip and moves the cursor to the start', function () {
            animClip._update(0.5);
            animClip.stop();
            animClip._update(0.5);
            expect(animClip.snapshot._results[0]).to.deep.equal([0, 0, 0]);
        });

    });

    describe('#reset', function () {

        it('moves the cursor to the start', function () {
            animClip._update(0.5);
            animClip.reset();
            animClip._update(0);
            expect(animClip.snapshot._results[0]).to.deep.equal([0, 0, 0]);
        });

    });

    describe('#resume', function () {

        it('moves the cursor to the start', function () {
            animClip.pause();
            animClip.resume();
            animClip._update(0.5);
            expect(animClip.snapshot._results[0]).to.deep.equal([0.5, 1, 1.5]);
        });

    });

    describe('#play', function () {

        it('plays the clip from the beginning', function () {
            animClip._update(0.5);
            animClip.pause();
            animClip.play();
            animClip._update(0);
            expect(animClip.snapshot._results[0]).to.deep.equal([0, 0, 0]);
        });

    });

});
