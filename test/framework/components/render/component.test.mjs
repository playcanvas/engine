import { expect } from 'chai';

import { Entity } from '../../../../src/framework/entity.js';
import { BoxGeometry } from '../../../../src/scene/geometry/box-geometry.js';
import { MeshInstance } from '../../../../src/scene/mesh-instance.js';
import { Mesh } from '../../../../src/scene/mesh.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';


describe.only('RenderComponent', function () {
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        jsdomTeardown();
        app = null;
    });

    it('Add single MeshInstance', function () {
        const entity = new Entity();
        app.root.addChild(entity);
        entity.addComponent('render');

        expect(entity.render._meshInstances.length).to.be.equal(0);

        const mesh = Mesh.fromGeometry(app.graphicsDevice, new BoxGeometry());

        const instance1 = new MeshInstance(mesh, app.systems.render.defaultMaterial);
        const instance2 = new MeshInstance(mesh, app.systems.render.defaultMaterial);

        entity.render.addMeshInstance(instance1);
        entity.render.addMeshInstance(instance2);
        entity.render.addMeshInstance(instance2); // test adding a duplicate instance

        expect(entity.render._meshInstances.length).to.be.equal(2);

        // Make sure the properties are updated
        expect(instance1.node).to.be.equal(entity);
        expect(instance1.castShadow).to.be.equal(entity.render._castShadows);
        expect(instance1.receiveShadow).to.be.equal(entity.render._receiveShadows);
        expect(instance1.renderStyle).to.be.equal(entity.render._renderStyle);

        // Make sure the instance is added to layers
        const sceneLayers = app.scene.layers;
        const componentLayers = entity.render._layers;
        for (let i = 0; i < componentLayers.length; i++) {
            const layer = sceneLayers.getLayerById(componentLayers[i]);
            expect(layer.meshInstancesSet.has(instance1)).to.be.true;
            expect(layer.shadowCastersSet.has(instance1)).to.be.true;
        }
    });

    it('Remove single MeshInstance', function () {
        const entity = new Entity();
        app.root.addChild(entity);
        entity.addComponent('render');

        const mesh = Mesh.fromGeometry(app.graphicsDevice, new BoxGeometry());
        const instance = new MeshInstance(mesh, app.systems.render.defaultMaterial);
        entity.render.addMeshInstance(instance);

        expect(entity.render._meshInstances.length).to.be.equal(1);

        entity.render.removeMeshInstance(instance);

        expect(entity.render._meshInstances.length).to.be.equal(0);

        // Make sure the instance is removed from layers
        const sceneLayers = app.scene.layers;
        const componentLayers = entity.render._layers;
        for (let i = 0; i < componentLayers.length; i++) {
            const layer = sceneLayers.getLayerById(componentLayers[i]);
            expect(layer.meshInstancesSet.has(instance)).to.be.false;
            expect(layer.shadowCastersSet.has(instance)).to.be.false;
        }
    });
});
