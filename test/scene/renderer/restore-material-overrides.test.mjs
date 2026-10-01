import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import { LAYERID_WORLD, SORTMODE_NONE } from '../../../src/scene/constants.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 */

// A render loop sets the state of a material when the material changes. A mesh instance overriding
// some of it has the material's values restored after its draw when the next draw uses the same
// material - the forward and the shadow loop share Renderer#restoreMaterialOverrides for it.
describe('Renderer#restoreMaterialOverrides', function () {
    /** @type {Application} */
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        // draws stay in the order the entities are added
        app.scene.layers.getLayerById(LAYERID_WORLD).opaqueSortMode = SORTMODE_NONE;

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 0, 12);
        app.root.addChild(camera);
    });

    afterEach(function () {
        sinon.restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const addBox = (material, x) => {
        const entity = new Entity(`box${x}`);
        entity.addComponent('render', { type: 'box', material });
        entity.setPosition(x, 0, 0);
        app.root.addChild(entity);
        return entity.render.meshInstances[0];
    };

    const alphaMaterial = () => {
        const material = new StandardMaterial();
        material.alphaTest = 0.5;
        material.setParameter('uRestoreTest', 1);
        material.update();
        return material;
    };

    it('restores the scope parameters and the alpha test reference', function () {
        const material = alphaMaterial();
        const meshInstance = addBox(material, 0);
        meshInstance.setParameter('uRestoreTest', 2);
        meshInstance.setParameter('alpha_ref', 0.9);
        app.render();

        const scope = app.graphicsDevice.scope;
        meshInstance.setParameters(app.graphicsDevice);
        expect(scope.resolve('uRestoreTest').value).to.equal(2);
        expect(scope.resolve('alpha_ref').value).to.equal(0.9);

        app.renderer.restoreMaterialOverrides(meshInstance, material);
        expect(scope.resolve('uRestoreTest').value).to.equal(1);
        expect(scope.resolve('alpha_ref').value).to.equal(0.5);
    });

    it('rebinds the material bind group after a mesh instance bound its copy', function () {
        const material = alphaMaterial();
        const meshInstance = addBox(material, 0);
        meshInstance.setParameter('material_diffuse', [1, 0, 0]);
        app.render();

        const renderer = app.renderer;
        renderer.setupMaterialOverrideBindGroup(meshInstance);
        expect(renderer._boundMaterialBindGroup).to.equal(meshInstance._materialBindGroup);

        renderer.restoreMaterialOverrides(meshInstance, material);
        expect(renderer._boundMaterialBindGroup).to.equal(material.uniformBufferBindGroup);
    });

    it('leaves the state alone for a mesh instance overriding nothing', function () {
        const material = alphaMaterial();
        const meshInstance = addBox(material, 0);
        app.render();

        const renderer = app.renderer;
        const setParameters = sinon.spy(material, 'setParameters');
        const alphaTest = sinon.spy(renderer.alphaTestId, 'setValue');
        const bind = sinon.spy(renderer, 'setupMaterialBindGroup');
        renderer.restoreMaterialOverrides(meshInstance, material);
        expect(setParameters.called).to.equal(false);
        expect(alphaTest.called).to.equal(false);
        expect(bind.called).to.equal(false);
    });

    it('restores the alpha test reference for the next forward draw of the material', function () {
        const material = alphaMaterial();
        const overriding = addBox(material, -2);
        overriding.setParameter('alpha_ref', 0.9);
        const next = addBox(material, 2);
        app.render();

        // the value on the scope when each mesh instance is drawn
        const renderer = app.renderer;
        const scopeId = app.graphicsDevice.scope.resolve('alpha_ref');
        const values = [];
        const setMeshInstanceMatrices = renderer.setMeshInstanceMatrices;
        sinon.stub(renderer, 'setMeshInstanceMatrices').callsFake(function (meshInstance, ...args) {
            values.push([meshInstance, scopeId.value]);
            return setMeshInstanceMatrices.call(this, meshInstance, ...args);
        });
        app.render();

        expect(values).to.deep.equal([[overriding, 0.9], [next, 0.5]]);
    });
});
