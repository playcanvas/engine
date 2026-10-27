import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { LAYERID_WORLD } from '../../../src/scene/constants.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Culler', function () {

    /** @type {import('../../../src/framework/application.js').Application} */
    let app;

    const createCamera = (name) => {
        const entity = new Entity(name);
        entity.addComponent('camera');
        entity.setPosition(0, 0, 5);
        app.root.addChild(entity);
        return entity.camera;
    };

    const createBox = (z) => {
        const entity = new Entity('Box');
        entity.addComponent('render', { type: 'box' });
        entity.setPosition(0, 0, z);
        app.root.addChild(entity);
        return entity.render.meshInstances[0];
    };

    // whether the camera renders the mesh instance in the last frame
    const rendered = (cameraComponent, meshInstance) => {
        const layer = app.scene.layers.getLayerById(LAYERID_WORLD);
        return layer.getCulledInstances(cameraComponent.camera).opaque.includes(meshInstance);
    };

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app.destroy();
        jsdomTeardown();
    });

    describe('#cullMeshInstances', function () {

        it('culls by the frustum only for the cameras which frustum cull', function () {
            const culling = createCamera('Culling');
            const notCulling = createCamera('NotCulling');
            notCulling.frustumCulling = false;

            // behind the cameras
            const box = createBox(20);
            app.render();
            expect(rendered(culling, box)).to.equal(false);
            expect(rendered(notCulling, box)).to.equal(true);
        });

        it('evaluates the visibility function for the cameras which do not frustum cull too', function () {
            const first = createCamera('First');
            const second = createCamera('Second');
            second.frustumCulling = false;

            const box = createBox(0);
            box.isVisibleFunc = camera => camera === first.camera;
            app.render();
            expect(rendered(first, box)).to.equal(true);
            expect(rendered(second, box)).to.equal(false);

            box.isVisibleFunc = camera => camera === second.camera;
            app.render();
            expect(rendered(first, box)).to.equal(false);
            expect(rendered(second, box)).to.equal(true);
        });

        it('renders a mesh instance with culling disabled for every camera, ignoring its visibility function', function () {
            const culling = createCamera('Culling');
            const notCulling = createCamera('NotCulling');
            notCulling.frustumCulling = false;

            const box = createBox(20);
            box.cull = false;
            box.isVisibleFunc = () => false;
            app.render();
            expect(rendered(culling, box)).to.equal(true);
            expect(rendered(notCulling, box)).to.equal(true);
        });
    });
});
