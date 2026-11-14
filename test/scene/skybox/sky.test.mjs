import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { LAYERID_SKYBOX, SKYTYPE_DOME } from '../../../src/scene/constants.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Sky', function () {

    /** @type {import('../../../src/framework/application.js').Application} */
    let app;

    /** @type {Texture} */
    let envAtlas;

    const skyLayer = () => app.scene.layers.getLayerById(LAYERID_SKYBOX);

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const entity = new Entity('Camera');
        entity.addComponent('camera');
        app.root.addChild(entity);

        envAtlas = new Texture(app.graphicsDevice, { name: 'EnvAtlas', width: 4, height: 4 });
        app.scene.envAtlas = envAtlas;
    });

    afterEach(function () {
        app.destroy();
        envAtlas.destroy();
        jsdomTeardown();
    });

    describe('#enabled', function () {

        it('is enabled by default', function () {
            expect(app.scene.sky.enabled).to.equal(true);
            app.render();
            expect(app.scene.sky.skyMesh).to.not.equal(null);
        });

        it('creates no sky mesh while disabled, the environment atlas still lighting the scene', function () {
            app.scene.sky.enabled = false;
            app.render();
            app.render();
            expect(app.scene.sky.skyMesh).to.equal(null);
            expect(skyLayer().meshInstances).to.have.lengthOf(0);
            expect(app.scene.envAtlas).to.equal(envAtlas);
        });

        it('destroys the sky mesh when disabled, and creates it again when enabled', function () {
            const { sky } = app.scene;
            app.render();
            const { meshInstance } = sky.skyMesh;
            expect(skyLayer().meshInstances).to.include(meshInstance);

            sky.enabled = false;
            expect(sky.skyMesh).to.equal(null);
            expect(skyLayer().meshInstances).to.not.include(meshInstance);

            sky.enabled = true;
            expect(sky.skyMesh).to.not.equal(null);
            expect(skyLayer().meshInstances).to.include(sky.skyMesh.meshInstance);
        });

        it('does not update the shaders of the materials when toggled', function () {
            const { scene } = app;
            app.render();
            expect(scene.updateShaders).to.equal(false);

            scene.sky.enabled = false;
            expect(scene.updateShaders).to.equal(false);
            scene.sky.enabled = true;
            expect(scene.updateShaders).to.equal(false);
        });

        it('keeps the settings changed while disabled for when it is enabled', function () {
            const { sky } = app.scene;
            sky.enabled = false;
            sky.type = SKYTYPE_DOME;
            sky.depthWrite = true;
            app.render();
            expect(sky.skyMesh).to.equal(null);

            sky.enabled = true;
            const { material } = sky.skyMesh.meshInstance;
            expect(material.getDefine('SKYMESH')).to.not.equal(undefined);
            expect(material.depthWrite).to.equal(true);
        });
    });
});
