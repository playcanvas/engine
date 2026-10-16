import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { LAYERID_WORLD, RENDERSTYLE_WIREFRAME } from '../../../src/scene/constants.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('BatchManager', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        this.bg = app.batcher.addGroup('Test Group', false, 100);
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    it('generate: removes model component mesh instances from layer', function () {
        const e1 = new Entity();
        e1.name = 'e1';
        e1.addComponent('model', {
            type: 'box',
            batchGroupId: this.bg.id
        });

        const e2 = new Entity();
        e2.name = 'e2';
        e2.addComponent('model', {
            type: 'box',
            batchGroupId: this.bg.id
        });

        app.root.addChild(e1);
        app.root.addChild(e2);

        app.batcher.generate();

        const layer = app.scene.layers.getLayerById(LAYERID_WORLD);
        const instances = layer.meshInstances;

        expect(instances.length).to.equal(1);
        expect(instances[0]).not.to.equal(e1.model.meshInstances[0]);
        expect(instances[1]).not.to.equal(e2.model.meshInstances[0]);
    });

    it('disable model component, marks batch group dirty', function () {
        const e1 = new Entity();
        e1.name = 'e1';
        e1.addComponent('model', {
            type: 'box',
            batchGroupId: this.bg.id
        });

        const e2 = new Entity();
        e2.name = 'e2';
        e2.addComponent('model', {
            type: 'box',
            batchGroupId: this.bg.id
        });

        app.root.addChild(e1);
        app.root.addChild(e2);

        app.batcher.generate();

        e2.enabled = false;

        expect(app.batcher._dirtyGroups[0]).to.equal(this.bg.id);
    });

    it('generate: replaces the existing batches when called again', function () {
        for (const name of ['e1', 'e2']) {
            const entity = new Entity(name);
            entity.addComponent('render', {
                type: 'box',
                batchGroupId: this.bg.id
            });
            app.root.addChild(entity);
        }

        app.batcher.generate();
        const oldBatch = app.batcher._batchList[0];

        app.batcher.generate();

        expect(oldBatch.meshInstance).to.equal(null);
        expect(app.batcher._batchList.length).to.equal(1);

        const layer = app.scene.layers.getLayerById(LAYERID_WORLD);
        expect(layer.meshInstances.length).to.equal(1);
        expect(layer.meshInstances[0]).to.equal(app.batcher._batchList[0].meshInstance);
    });

    it('generate: removes the batch of a disabled entity', function () {
        const bg2 = app.batcher.addGroup('Test Group 2', false, 100);

        const e1 = new Entity('e1');
        e1.addComponent('render', {
            type: 'box',
            batchGroupId: this.bg.id
        });
        app.root.addChild(e1);

        const e2 = new Entity('e2');
        e2.addComponent('render', {
            type: 'box',
            batchGroupId: bg2.id
        });
        e2.enabled = false;
        app.root.addChild(e2);

        app.batcher.generate();
        expect(app.batcher.getBatches(this.bg.id).length).to.equal(1);
        expect(app.batcher.getBatches(bg2.id).length).to.equal(0);

        // swap which entity is enabled, and regenerate all groups straight away
        e1.enabled = false;
        e2.enabled = true;
        app.batcher.generate();

        expect(app.batcher.getBatches(this.bg.id).length).to.equal(0);
        const batches = app.batcher.getBatches(bg2.id);
        expect(batches.length).to.equal(1);

        const layer = app.scene.layers.getLayerById(LAYERID_WORLD);
        expect(layer.meshInstances.length).to.equal(1);
        expect(layer.meshInstances[0]).to.equal(batches[0].meshInstance);

        // the regenerated groups are no longer dirty, so the next frame does not batch them again
        expect(app.batcher._dirtyGroups.length).to.equal(0);
    });

    ['render', 'model'].forEach((type) => {
        it(`batchGroupId: batches a disabled ${type} component once it is enabled`, function () {
            const layer = app.scene.layers.getLayerById(LAYERID_WORLD);

            // the layer draws only the batch of the group, made from these mesh instances
            const expectBatchOf = (meshInstances) => {
                const batches = app.batcher.getBatches(this.bg.id);
                expect(batches.length).to.equal(1);
                expect(batches[0].origMeshInstances).to.have.members(meshInstances);
                expect(layer.meshInstances).to.have.members([batches[0].meshInstance]);
            };

            const e1 = new Entity('e1');
            e1.addComponent(type, { type: 'box', batchGroupId: this.bg.id });
            app.root.addChild(e1);

            const e2 = new Entity('e2');
            e2.addComponent(type, { type: 'box', enabled: false });
            app.root.addChild(e2);

            const mi1 = e1[type].meshInstances[0];
            const mi2 = e2[type].meshInstances[0];

            // the group of a disabled component is stored, but the component is not batched
            e2[type].batchGroupId = this.bg.id;
            expect(e2[type].batchGroupId).to.equal(this.bg.id);
            app.batcher.updateAll();
            expectBatchOf([mi1]);

            // enabling the component re-batches the group, which then draws it once
            e2[type].enabled = true;
            app.batcher.updateAll();
            expectBatchOf([mi1, mi2]);

            // disabling it re-batches the group without it
            e2[type].enabled = false;
            app.batcher.updateAll();
            expectBatchOf([mi1]);
        });
    });


    it('prepare: splits batches when castShadow differs', function () {
        const e1 = new Entity();
        e1.addComponent('model', {
            type: 'box',
            batchGroupId: this.bg.id
        });
        const e2 = new Entity();
        e2.addComponent('model', {
            type: 'box',
            batchGroupId: this.bg.id
        });

        app.root.addChild(e1);
        app.root.addChild(e2);

        e1.model.meshInstances[0].castShadow = false;
        e2.model.meshInstances[0].castShadow = true;

        app.batcher.generate();

        const layer = app.scene.layers.getLayerById(LAYERID_WORLD);
        expect(layer.meshInstances.length).to.equal(2);
        const flags = layer.meshInstances.map(mi => mi.castShadow).sort();
        expect(flags).to.deep.equal([false, true]);
    });

    it('batch with all invisible meshinstances works', function () {
        const e1 = new Entity();
        e1.name = 'e1';
        e1.addComponent('model', {
            type: 'box',
            batchGroupId: this.bg.id
        });

        const e2 = new Entity();
        e2.name = 'e2';
        e2.addComponent('model', {
            type: 'box',
            batchGroupId: this.bg.id
        });


        e1.model.meshInstances[0].visible = false;
        e2.model.meshInstances[0].visible = false;

        app.root.addChild(e1);
        app.root.addChild(e2);

        app.batcher.generate();

        expect(app.batcher._batchList.length).to.equal(0);

    });

    it('generate: copies the render style to the batch and prepares its mesh', function () {
        for (const name of ['e1', 'e2']) {
            const entity = new Entity(name);
            entity.addComponent('render', {
                type: 'box',
                batchGroupId: this.bg.id
            });
            entity.render.meshInstances[0].renderStyle = RENDERSTYLE_WIREFRAME;
            app.root.addChild(entity);
        }

        app.batcher.generate();

        const batchInstance = app.batcher._batchList[0].meshInstance;
        expect(batchInstance.renderStyle).to.equal(RENDERSTYLE_WIREFRAME);

        // assigning the render style also generates the wireframe indices of the batched mesh
        expect(batchInstance.mesh.primitive[RENDERSTYLE_WIREFRAME]).to.exist;
        expect(batchInstance.mesh.indexBuffer[RENDERSTYLE_WIREFRAME]).to.exist;
    });

    it('generate: copies the parameters to the batch, split between the scope and the material buffer', function () {
        const device = app.graphicsDevice;
        const material = new StandardMaterial();
        material.update();
        material.prepareForRender(device, app.scene);

        // both boxes carry a scope parameter and an override of a uniform stored in the material buffer
        const diffuse = [1, 0, 0];
        for (const name of ['e1', 'e2']) {
            const entity = new Entity(name);
            entity.addComponent('render', {
                type: 'box',
                material: material,
                batchGroupId: this.bg.id
            });
            entity.render.meshInstances[0].setParameter('uTest', 3);
            entity.render.meshInstances[0].setParameter('material_diffuse', diffuse);
            app.root.addChild(entity);
        }

        app.batcher.generate();

        expect(app.batcher._batchList.length).to.equal(1);
        const batchInstance = app.batcher._batchList[0].meshInstance;
        expect(batchInstance.parameters.size).to.equal(2);
        expect(batchInstance.getParameter('uTest').data).to.equal(3);
        expect(batchInstance._scopeParameters.map(parameter => parameter.name)).to.deep.equal(['uTest']);
        expect(batchInstance._materialOverrides.map(parameter => parameter.name)).to.deep.equal(['material_diffuse']);

        // the scope parameter reaches the scope
        batchInstance.setParameters(device);
        expect(device.scope.resolve('uTest').value).to.equal(3);

        // the override reaches a copy of the material buffer
        const bindGroup = batchInstance.getMaterialBindGroup(device);
        expect(bindGroup).to.exist;
        expect(bindGroup).to.not.equal(material.uniformBufferBindGroup);
        const copy = batchInstance._materialUniformBuffer;
        const offset = copy.format.get('material_diffuse').offset;
        expect(Array.from(copy.storageFloat32.subarray(offset, offset + 3))).to.deep.equal(diffuse);
    });
});
