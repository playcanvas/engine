import { expect } from 'chai';

import { BoxGizmo } from '../../../src/extras/gizmo/handle/box-gizmo.js';
import { Entity } from '../../../src/framework/entity.js';
import { Layer } from '../../../src/scene/layer.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('BoxGizmo', function () {

    let app;
    let gizmo;

    const fillBiases = () => gizmo._renderer._boxes.items.map(item => item.shape.depthBias);

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 0, 10);
        app.root.addChild(camera);

        const layer = new Layer({ name: 'Gizmo' });
        app.scene.layers.push(layer);
        gizmo = new BoxGizmo(camera.camera, layer);
    });

    afterEach(function () {
        gizmo.destroy();
        app.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#fillDepthBias', function () {

        it('defaults to 2', function () {
            expect(gizmo.fillDepthBias).to.equal(2);
            gizmo.prerender();
            expect(fillBiases()).to.deep.equal([2]);
        });

        it('updates fills already drawn', function () {
            gizmo.prerender();
            gizmo.fillDepthBias = -8;
            expect(gizmo.fillDepthBias).to.equal(-8);
            expect(fillBiases()).to.deep.equal([-8]);
        });

        it('applies to fills drawn later', function () {
            gizmo.fillDepthBias = -8;
            gizmo.prerender();
            expect(fillBiases()).to.deep.equal([-8]);
        });

    });

});
