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
    });

    it('resets the mesh instances when removing all entities', function () {
        const entity = createEntity();
        renderer.addEntity(entity, Color.RED);
        const meshInstance = entity.render.meshInstances[0];

        renderer.removeAllEntities();

        expect(outlinedCount()).to.equal(0);
        expect(meshInstance.getParameter('pcOutlineColor')).to.equal(undefined);
    });

    it('does not modify the materials', function () {
        const entity = createEntity();
        const material = new StandardMaterial();
        const callback = options => options;
        material.onUpdateShader = callback;
        entity.render.material = material;

        renderer.addEntity(entity, Color.RED);
        expect(material.onUpdateShader).to.equal(callback);

        renderer.removeEntity(entity);
        expect(material.onUpdateShader).to.equal(callback);
    });

    it('leaves mesh instances it did not add untouched', function () {
        // a mesh instance added to the shared rendering layer by other code
        const other = createEntity();
        other.render.material = new StandardMaterial();
        const callback = options => options;
        other.render.material.onUpdateShader = callback;
        const otherMeshInstance = other.render.meshInstances[0];
        const otherColor = new Float32Array([0, 1, 0]);
        otherMeshInstance.setParameter('pcOutlineColor', otherColor);
        renderer.renderingLayer.addMeshInstances(other.render.meshInstances);

        renderer.addEntity(createEntity(), Color.RED);
        renderer.removeEntity(other);
        renderer.removeAllEntities();

        expect(outlinedCount()).to.equal(1);
        expect(renderer.renderingLayer.meshInstances[0]).to.equal(otherMeshInstance);
        expect(other.render.material.onUpdateShader).to.equal(callback);
        expect(otherMeshInstance.getParameter('pcOutlineColor').data).to.equal(otherColor);
    });

    it('does not remove the entities of another renderer sharing the rendering layer', function () {
        // both boxes use the default material
        const renderer2 = new OutlineRenderer(app);
        const entity1 = createEntity();
        const entity2 = createEntity();
        renderer.addEntity(entity1, Color.RED);
        renderer2.addEntity(entity2, Color.WHITE);

        renderer.removeAllEntities();

        expect(outlinedCount()).to.equal(1);
        expect(renderer.renderingLayer.meshInstances[0]).to.equal(entity2.render.meshInstances[0]);
        expect(entity2.render.meshInstances[0].getParameter('pcOutlineColor')).to.not.equal(undefined);

        renderer2.destroy();
    });

    it('keeps the entities of another renderer outlined when destroyed', function () {
        // both boxes use the default material
        const renderer2 = new OutlineRenderer(app);
        const entity1 = createEntity();
        const entity2 = createEntity();
        renderer.addEntity(entity1, Color.RED);
        renderer2.addEntity(entity2, Color.WHITE);

        renderer2.destroy();

        expect(outlinedCount()).to.equal(1);
        expect(renderer.renderingLayer.meshInstances[0]).to.equal(entity1.render.meshInstances[0]);
        expect(entity1.render.meshInstances[0].getParameter('pcOutlineColor')).to.not.equal(undefined);
    });

    it('removes its entities when destroyed', function () {
        const entity = createEntity();
        renderer.addEntity(entity, Color.RED);
        const meshInstance = entity.render.meshInstances[0];
        const layer = renderer.renderingLayer;

        renderer.destroy();
        renderer = null;

        expect(layer.meshInstances.length).to.equal(0);
        expect(meshInstance.getParameter('pcOutlineColor')).to.equal(undefined);
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
