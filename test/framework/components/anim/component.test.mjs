import { expect } from 'chai';

import { ANIM_LAYER_ADDITIVE, ANIM_LAYER_OVERWRITE } from '../../../../src/framework/anim/controller/constants.js';
import { AnimTrack } from '../../../../src/framework/anim/evaluator/anim-track.js';
import { Entity } from '../../../../src/framework/entity.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('AnimComponent', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app.destroy();
        app = null;
        jsdomTeardown();
    });

    const track = name => new AnimTrack(name, 1, [], [], []);

    describe('#clone', function () {

        // Regression test for https://github.com/playcanvas/engine/issues/6395
        it('clones a component with a layer added dynamically after the base layer', function () {
            const entity = new Entity('model', app);
            app.root.addChild(entity);
            entity.addComponent('anim', { activate: true });

            // base layer, created implicitly by the first assignAnimation call
            entity.anim.assignAnimation('Idle', track('Idle'));
            entity.anim.assignAnimation('Walk', track('Walk'));

            // second layer added dynamically with an additive blend type
            const upperBody = entity.anim.addLayer('UpperBody', 0.5, null, ANIM_LAYER_ADDITIVE);
            upperBody.assignAnimation('Eager', track('Eager'));
            upperBody.assignAnimation('Dance', track('Dance'));

            let clone;
            expect(() => {
                clone = entity.clone();
            }).to.not.throw();
            app.root.addChild(clone);

            // both layers are reproduced on the clone
            expect(clone.anim.layers.length).to.equal(2);
            expect(clone.anim.findAnimationLayer('Base')).to.not.equal(null);
            expect(clone.anim.findAnimationLayer('UpperBody')).to.not.equal(null);

            // the dynamically-added layer keeps its blend type
            expect(clone.anim.findAnimationLayer('Base').blendType).to.equal(ANIM_LAYER_OVERWRITE);
            expect(clone.anim.findAnimationLayer('UpperBody').blendType).to.equal(ANIM_LAYER_ADDITIVE);

            // states (and their assigned animations) are reproduced on both layers
            expect(clone.anim.findAnimationLayer('Base').states).to.have.members(['START', 'Idle', 'Walk']);
            expect(clone.anim.findAnimationLayer('UpperBody').states).to.have.members(['START', 'Eager', 'Dance']);
            expect(clone.anim.playable).to.equal(true);

            // the clone owns independent layer instances
            expect(clone.anim.layers[1]).to.not.equal(entity.anim.layers[1]);
        });

        it('clones a single-layer component', function () {
            const entity = new Entity('model', app);
            app.root.addChild(entity);
            entity.addComponent('anim', { activate: true });
            entity.anim.assignAnimation('Idle', track('Idle'));

            let clone;
            expect(() => {
                clone = entity.clone();
            }).to.not.throw();

            expect(clone.anim.layers.length).to.equal(1);
            expect(clone.anim.findAnimationLayer('Base').states).to.have.members(['START', 'Idle']);
            expect(clone.anim.playable).to.equal(true);
        });
    });
});
