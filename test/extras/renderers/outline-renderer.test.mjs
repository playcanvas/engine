import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { Color } from '../../../src/core/math/color.js';
import { OutlineRenderer } from '../../../src/extras/renderers/outline-renderer.js';
import { Entity } from '../../../src/framework/entity.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
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
        restore();
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

    it('resets the materials when removing all entities', function () {
        const entity = createEntity();
        renderer.addEntity(entity, Color.RED);
        const meshInstance = entity.render.meshInstances[0];

        renderer.removeAllEntities();

        expect(outlinedCount()).to.equal(0);
        expect(meshInstance.getParameter('pcOutlineColor')).to.equal(undefined);
        expect(meshInstance.material.onUpdateShader).to.equal(null);
    });

    it('keeps the shader callback of a material it did not outline when removing all entities', function () {
        // a mesh instance added to the shared rendering layer by other code
        const other = createEntity();
        other.render.material = new StandardMaterial();
        const callback = options => options;
        other.render.material.onUpdateShader = callback;
        renderer.renderingLayer.addMeshInstances(other.render.meshInstances);

        renderer.addEntity(createEntity(), Color.RED);
        renderer.removeAllEntities();

        expect(other.render.material.onUpdateShader).to.equal(callback);
    });

    describe('#frameUpdate', function () {

        let cameraEntity;
        let blendLayer;

        beforeEach(function () {
            cameraEntity = new Entity();
            cameraEntity.addComponent('camera');
            app.root.addChild(cameraEntity);
            blendLayer = app.scene.layers.getLayerByName('Immediate');
        });

        const renderBlendLayer = () => app.scene.fire('prerender:layer', cameraEntity.camera, blendLayer, false);

        it('composites the outlines once per update', function () {
            const blend = stub(renderer, 'blendOutlines');

            renderer.frameUpdate(cameraEntity, blendLayer, false);
            renderBlendLayer();
            renderBlendLayer();

            expect(blend.callCount).to.equal(1);
        });

        it('composites the outlines once after updates on frames the blend layer was not rendered', function () {
            const blend = stub(renderer, 'blendOutlines');

            renderer.frameUpdate(cameraEntity, blendLayer, false);
            renderer.frameUpdate(cameraEntity, blendLayer, false);
            renderer.frameUpdate(cameraEntity, blendLayer, false);
            renderBlendLayer();

            expect(blend.callCount).to.equal(1);
        });

        it('only composites the outlines before the requested layer', function () {
            const blend = stub(renderer, 'blendOutlines');

            renderer.frameUpdate(cameraEntity, blendLayer, false);
            app.scene.fire('prerender:layer', cameraEntity.camera, blendLayer, true);
            app.scene.fire('prerender:layer', cameraEntity.camera, app.scene.layers.getLayerByName('World'), false);

            expect(blend.callCount).to.equal(0);
        });

        it('does not composite the outlines after it is destroyed', function () {
            const blend = stub(renderer, 'blendOutlines');

            renderer.frameUpdate(cameraEntity, blendLayer, false);
            renderer.destroy();
            renderer = null;
            renderBlendLayer();

            expect(blend.callCount).to.equal(0);
        });
    });
});
