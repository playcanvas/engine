import { expect } from 'chai';

import { TranslateGizmo } from '../../../src/extras/gizmo/transform/translate-gizmo.js';
import { Entity } from '../../../src/framework/entity.js';
import { Layer } from '../../../src/scene/layer.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('TransformGizmo', function () {

    let app;
    let gizmo;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const camera = new Entity('camera');
        camera.addComponent('camera');
        app.root.addChild(camera);

        const layer = new Layer({ name: 'Gizmo' });
        app.scene.layers.push(layer);
        gizmo = new TranslateGizmo(camera.camera, layer);
    });

    afterEach(function () {
        gizmo.destroy();
        app.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#setShapeEnabled', function () {

        it('disables and re-enables a shape', function () {
            gizmo.setShapeEnabled('x', false);
            expect(gizmo.isShapeEnabled('x')).to.equal(false);
            expect(gizmo.isShapeEnabled('y')).to.equal(true);

            gizmo.setShapeEnabled('x', true);
            expect(gizmo.isShapeEnabled('x')).to.equal(true);
        });

        it('forwards the deprecated enableShape to setShapeEnabled', function () {
            gizmo.enableShape('y', false);
            expect(gizmo.isShapeEnabled('y')).to.equal(false);
        });

    });

});
