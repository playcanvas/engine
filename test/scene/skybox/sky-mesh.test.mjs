import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { LAYERID_SKYBOX } from '../../../src/scene/constants.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('SkyMesh', function () {

    /** @type {import('../../../src/framework/application.js').Application} */
    let app;

    /** @type {Texture} */
    let envAtlas;

    const createCamera = (name) => {
        const entity = new Entity(name);
        entity.addComponent('camera');
        app.root.addChild(entity);
        return entity.camera;
    };

    // whether the camera renders the sky in the last frame
    const skyRendered = (cameraComponent) => {
        const layer = app.scene.layers.getLayerById(LAYERID_SKYBOX);
        const { meshInstance } = app.scene.sky.skyMesh;
        return layer.getCulledInstances(cameraComponent.camera).opaque.includes(meshInstance);
    };

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        envAtlas = new Texture(app.graphicsDevice, { name: 'EnvAtlas', width: 4, height: 4 });
        app.scene.envAtlas = envAtlas;
    });

    afterEach(function () {
        app.destroy();
        envAtlas.destroy();
        jsdomTeardown();
    });

    it('is rendered only by the cameras rendering the sky of the scene', function () {
        const first = createCamera('First');
        const second = createCamera('Second');
        expect(second.camera.skyVisible).to.equal(true);

        second.camera.skyVisible = false;
        app.render();
        expect(skyRendered(first)).to.equal(true);
        expect(skyRendered(second)).to.equal(false);

        second.camera.skyVisible = true;
        app.render();
        expect(skyRendered(second)).to.equal(true);
    });

    it('stays hidden from a camera when the sky is rebuilt', function () {
        const first = createCamera('First');
        const second = createCamera('Second');
        second.camera.skyVisible = false;
        app.render();
        const { meshInstance } = app.scene.sky.skyMesh;

        // changing the sky settings rebuilds the sky mesh
        app.scene.skyboxMip = 1;
        app.render();
        expect(app.scene.sky.skyMesh.meshInstance).to.not.equal(meshInstance);
        expect(skyRendered(first)).to.equal(true);
        expect(skyRendered(second)).to.equal(false);
    });

    it('is hidden from a camera which does not frustum cull', function () {
        const first = createCamera('First');
        const second = createCamera('Second');
        first.frustumCulling = false;
        second.frustumCulling = false;
        second.camera.skyVisible = false;
        app.render();
        expect(skyRendered(first)).to.equal(true);
        expect(skyRendered(second)).to.equal(false);
    });
});
