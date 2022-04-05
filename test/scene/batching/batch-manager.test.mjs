import { Application } from '../../../src/framework/application.js';
import { Entity } from '../../../src/framework/entity.js';
import { LAYERID_WORLD } from '../../../src/scene/constants.js';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';

describe('BatchManager', function () {

    beforeEach(function () {
        const canvas = new HTMLCanvasElement(500, 500);
        this.app = new Application(canvas);

        this.bg = this.app.batcher.addGroup('Test Group', false, 100);
    });

    afterEach(function () {
        this.app.destroy();
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

        this.app.root.addChild(e1);
        this.app.root.addChild(e2);

        this.app.batcher.generate();

        const layer = this.app.scene.layers.getLayerById(LAYERID_WORLD);
        const instances = layer.opaqueMeshInstances;

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

        this.app.root.addChild(e1);
        this.app.root.addChild(e2);

        this.app.batcher.generate();

        e2.enabled = false;

        expect(this.app.batcher._dirtyGroups[0]).to.equal(this.bg.id);
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

        this.app.root.addChild(e1);
        this.app.root.addChild(e2);

        this.app.batcher.generate();

        expect(this.app.batcher._batchList.length).to.equal(0);

    });
});
