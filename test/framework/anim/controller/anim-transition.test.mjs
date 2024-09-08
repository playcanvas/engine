import { AnimTransition } from '../../../../src/framework/anim/controller/anim-transition.js';
import { expect } from 'chai';

describe('AnimTransition', function () {

    describe('#constructor', function () {

        it('instantiates correctly', function () {
            const animTransition = new AnimTransition({
                from: 'fromState',
                to: 'toState'
            });
            expect(animTransition).to.be.ok;
            expect(animTransition.from).to.equal('fromState');
            expect(animTransition.to).to.equal('toState');
        });

    });

});
