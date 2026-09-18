import { expect } from 'chai';

import { Color } from '../../../src/core/math/color.js';
import { OutlineRenderer } from '../../../src/extras/renderers/outline-renderer.js';
import { Entity } from '../../../src/framework/entity.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('OutlineRenderer', function () {

    let app;
    let renderer;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        renderer = new OutlineRenderer(app);
    });

    afterEach(function () {
        renderer?.destroy();
        renderer = null;
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const createEntity = () => {
        const entity = new Entity();
        entity.addComponent('render', { type: 'box' });
        app.root.addChild(entity);
        return entity;
    };

    // asserted on rather than the mesh instances themselves: a failing deep comparison of a
    // MeshInstance walks the whole scene graph behind it
    const outlinedCount = () => renderer.renderingLayer.meshInstances.length;

    it('outlines an enabled entity', function () {
        const entity = createEntity();

        renderer.addEntity(entity, Color.RED);

        expect(outlinedCount()).to.equal(1);
        expect(renderer.renderingLayer.meshInstances[0]).to.equal(entity.render.meshInstances[0]);
    });

    it('does not outline a disabled entity', function () {
        const entity = createEntity();
        entity.enabled = false;

        renderer.addEntity(entity, Color.RED);

        expect(outlinedCount()).to.equal(0);
    });

    it('does not outline an entity with a disabled render component', function () {
        const entity = createEntity();
        entity.render.enabled = false;

        renderer.addEntity(entity, Color.RED);

        expect(outlinedCount()).to.equal(0);
    });

    it('does not outline a disabled descendant', function () {
        const parent = createEntity();
        const child = new Entity();
        child.addComponent('render', { type: 'box' });
        parent.addChild(child);
        child.enabled = false;

        renderer.addEntity(parent, Color.RED);

        expect(outlinedCount()).to.equal(1);
        expect(renderer.renderingLayer.meshInstances[0]).to.equal(parent.render.meshInstances[0]);
    });

    it('removes an entity disabled after it was added', function () {
        const entity = createEntity();
        renderer.addEntity(entity, Color.RED);
        const meshInstance = entity.render.meshInstances[0];

        entity.enabled = false;
        renderer.removeEntity(entity);

        expect(outlinedCount()).to.equal(0);
        expect(meshInstance.getParameter('pcOutlineColor')).to.equal(undefined);
        expect(meshInstance.material.onUpdateShader).to.equal(null);
    });
});
