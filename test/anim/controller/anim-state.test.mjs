import { AnimState } from '../../../src/anim/controller/anim-state.js';
import { expect } from 'chai';
import { ANIM_BLEND_1D } from '../../../src/anim/controller/constants.js';
import { INTERPOLATION_LINEAR } from '../../../src/anim/constants.js';
import { AnimCurve } from '../../../src/anim/evaluator/anim-curve.js';
import { AnimData } from '../../../src/anim/evaluator/anim-data.js';
import { AnimTrack } from '../../../src/anim/evaluator/anim-track.js';

describe('AnimState', function () {

    describe('#constructor', function () {

        it('instantiates correctly', function () {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            expect(animState).to.be.ok;
            expect(animState.name).to.be.equal('state');
            expect(animState.nodeCount).to.be.equal(1);
        });

        it('instansiates correctly with a blend tree', function () {
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, {
                type: ANIM_BLEND_1D,
                parameter: 'param',
                children: []
            });
            expect(animState).to.be.ok;
            expect(animState.name).to.be.equal('state');
            expect(animState.nodeCount).to.be.equal(0);
        });

    });

    describe('#addAnimation', function () {

        it('can add an animation to the AnimState instance', function () {

            const curves = [new AnimCurve(['path/to/entity'], 0, 0, INTERPOLATION_LINEAR)];
            const inputs = [new AnimData(1, [0, 1, 2])];
            const outputs = [new AnimData(3, [0, 0, 0, 1, 2, 3, 2, 4, 6])];
            const animTrack = new AnimTrack('track', 2, inputs, outputs, curves);
            const animState = new AnimState({ findParameter: () => {} }, 'state', 1, true, null);
            expect(animState.animations.length).to.be.equal(0);
            animState.addAnimation(['track'], animTrack);
            expect(animState.animations.length).to.be.equal(1);
        });
    });

});
