import { AnimTrack } from '../../../../src/framework/anim/evaluator/anim-track.js';
import { AnimData } from '../../../../src/framework/anim/evaluator/anim-data.js';
import { AnimCurve } from '../../../../src/framework/anim/evaluator/anim-curve.js';
import { AnimSnapshot } from '../../../../src/framework/anim/evaluator/anim-snapshot.js';
import { INTERPOLATION_LINEAR } from '../../../../src/framework/anim/constants.js';
import { expect } from 'chai';

describe('AnimSnapshot', function () {
    const curves = [new AnimCurve(['path/to/entity'], 0, 0, INTERPOLATION_LINEAR)];
    const inputs = [new AnimData(1, [0, 1, 2])];
    const outputs = [new AnimData(3, [0, 0, 0, 1, 2, 3, 2, 4, 6])];
    const animTrack = new AnimTrack('track', 2, inputs, outputs, curves);
    const animSnapshot = new AnimSnapshot(animTrack);

    describe('#constructor', function () {

        it('instantiates correctly', function () {
            expect(animSnapshot).to.be.ok;
            expect(animSnapshot._name).to.equal('trackSnapshot');
            expect(animSnapshot._time).to.equal(-1);
            expect(animSnapshot._results.length).to.equal(1);
            expect(animSnapshot._results[0].length).to.equal(3);
            expect(animSnapshot._results[0]).to.deep.equal([0, 0, 0]);
        });

    });

});
