import { expect } from 'chai';

import { Entity } from '../../../../src/framework/entity.js';
import { BatchGroup } from '../../../../src/scene/batching/batch-group.js';
import { LAYERID_WORLD, SHADOW_CASCADE_0, SHADOW_CASCADE_1, SHADOW_CASCADE_ALL } from '../../../../src/scene/constants.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('RenderComponent', function () {
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#onBeforeRemove', function () {

        it('unsubscribes from all four entity hierarchy events', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('render', { type: 'box' });

            expect(e.hasEvent('remove')).to.equal(true);
            expect(e.hasEvent('removehierarchy')).to.equal(true);
            expect(e.hasEvent('insert')).to.equal(true);
            expect(e.hasEvent('inserthierarchy')).to.equal(true);

            e.removeComponent('render');

            expect(e.hasEvent('remove')).to.equal(false);
            expect(e.hasEvent('removehierarchy')).to.equal(false);
            expect(e.hasEvent('insert')).to.equal(false);
            expect(e.hasEvent('inserthierarchy')).to.equal(false);
        });

        it('removes the entity from its batch group', function () {
            const group = app.batcher.addGroup('test', false, 100);

            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('render', { type: 'box', batchGroupId: group.id });

            const nodes = app.batcher._batchGroups[group.id]._obj[BatchGroup.RENDER];
            expect(nodes).to.include(e);

            e.removeComponent('render');

            expect(nodes).to.not.include(e);
        });

        it('removes the mesh instances from their layers', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('render', { type: 'box' });

            const worldLayer = app.scene.layers.getLayerById(LAYERID_WORLD);
            expect(worldLayer.meshInstances.length).to.equal(1);

            e.removeComponent('render');

            expect(worldLayer.meshInstances.length).to.equal(0);
        });

    });

    describe('#shadowCascadeMask', function () {

        it('defaults to all cascades and is assigned to the mesh instances', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('render', { type: 'box' });

            expect(e.render.shadowCascadeMask).to.equal(SHADOW_CASCADE_ALL);
            expect(e.render.meshInstances[0].shadowCascadeMask).to.equal(SHADOW_CASCADE_ALL);
        });

        it('can be initialized from the component data', function () {
            const mask = SHADOW_CASCADE_0 | SHADOW_CASCADE_1;

            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('render', { type: 'box', shadowCascadeMask: mask });

            expect(e.render.shadowCascadeMask).to.equal(mask);
            expect(e.render.meshInstances[0].shadowCascadeMask).to.equal(mask);
        });

        it('is applied to the existing mesh instances when set', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('render', { type: 'box' });

            e.render.shadowCascadeMask = SHADOW_CASCADE_0;

            expect(e.render.meshInstances[0].shadowCascadeMask).to.equal(SHADOW_CASCADE_0);
        });

        it('is applied to mesh instances created after it was set', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('render', { type: 'box' });

            e.render.shadowCascadeMask = SHADOW_CASCADE_0;

            // this recreates the mesh instances
            e.render.type = 'sphere';

            expect(e.render.meshInstances[0].shadowCascadeMask).to.equal(SHADOW_CASCADE_0);
        });

        it('is preserved when the entity is cloned', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('render', { type: 'box', shadowCascadeMask: SHADOW_CASCADE_1 });

            const clone = e.clone();
            app.root.addChild(clone);

            expect(clone.render.shadowCascadeMask).to.equal(SHADOW_CASCADE_1);
            expect(clone.render.meshInstances[0].shadowCascadeMask).to.equal(SHADOW_CASCADE_1);
        });

    });
});
