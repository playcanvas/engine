import { expect } from 'chai';

import { Entity } from '../../../../src/framework/entity.js';
import { BatchGroup } from '../../../../src/scene/batching/batch-group.js';
import { LAYERID_WORLD } from '../../../../src/scene/constants.js';
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
});
