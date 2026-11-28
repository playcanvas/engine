import { expect } from 'chai';
import { spy } from 'sinon';

import { AnimComponentLayer } from '../../../../src/framework/components/anim/component-layer.js';

// Setting the weight of a layer marks the animated targets of its component dirty only when the
// weight changes.
describe('AnimComponentLayer#weight', function () {

    let component;
    let layer;

    beforeEach(function () {
        component = { dirtifyTargets: spy() };
        layer = new AnimComponentLayer('layer', null, component, 1);
    });

    it('marks the targets dirty when the weight changes', function () {
        layer.weight = 0.5;
        expect(layer.weight).to.equal(0.5);
        expect(component.dirtifyTargets.callCount).to.equal(1);
        layer.weight = 0;
        expect(component.dirtifyTargets.callCount).to.equal(2);
    });

    it('leaves the targets alone when the weight is set to its current value', function () {
        layer.weight = 1;
        layer.weight = 1;
        expect(component.dirtifyTargets.called).to.be.false;
        layer.weight = 0.25;
        layer.weight = 0.25;
        expect(component.dirtifyTargets.callCount).to.equal(1);
        expect(layer.weight).to.equal(0.25);
    });
});
