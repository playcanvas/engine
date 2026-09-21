import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, SHADOW_PCSS_32F } from '../../../src/scene/constants.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('PCSS cached cascades', function () {
    let app;
    let camera;
    let light;
    let casters;

    const renderData = cascade => light.getRenderData(camera.camera, cascade);
    const fitting = () => Array.from({ length: 4 }, (_, cascade) => {
        const data = renderData(cascade);
        return {
            position: data.shadowCamera.node.getPosition().toString(),
            near: data.shadowCamera.nearClip,
            far: data.shadowCamera.farClip,
            radius: data.projectionCompensation,
            matrix: Array.from(data.shadowMatrix.data)
        };
    });
    const update = (cascades) => {
        light.shadowUpdateOverrides = Array.from({ length: 4 }, (_, cascade) => (
            cascades.includes(cascade) ? SHADOWUPDATE_THISFRAME : SHADOWUPDATE_NONE
        ));
        app.render();
    };

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        app.graphicsDevice.textureFloatFilterable = true;
        const cameraEntity = new Entity('Camera');
        cameraEntity.addComponent('camera', { farClip: 40 });
        cameraEntity.setPosition(0, 2, 5);
        cameraEntity.lookAt(0, 0, 0);
        app.root.addChild(cameraEntity);
        camera = cameraEntity.camera;

        const entity = new Entity('Light');
        entity.addComponent('light', {
            type: 'directional',
            castShadows: true,
            numCascades: 4,
            shadowType: SHADOW_PCSS_32F,
            shadowResolution: 128,
            shadowDistance: 40
        });
        app.root.addChild(entity);
        light = entity.light.light;
        expect(light.shadowType).to.equal(SHADOW_PCSS_32F);

        casters = Array.from({ length: 4 }, (_, cascade) => {
            const caster = new Entity(`Caster ${cascade}`);
            caster.addComponent('render', { type: 'box' });
            caster.setLocalScale(200, 2, 200);
            caster.setPosition(0, cascade * 10, 0);
            caster.render.meshInstances[0].shadowCascadeMask = 1 << cascade;
            app.root.addChild(caster);
            return caster;
        });
        app.render();
        for (let cascade = 0; cascade < 4; cascade++) {
            expect(renderData(cascade).visibleCasters).to.eql(casters[cascade].render.meshInstances);
        }
    });

    afterEach(function () {
        app.destroy();
        jsdomTeardown();
    });

    it('keeps static fitting independent of the cascade update schedule', function () {
        const original = fitting();
        for (const cascades of [[0], [1, 3], [0, 2], [3]]) {
            update(cascades);
            expect(fitting()).to.eql(original);
        }
    });

    it('binds the depth range stored with each cached cascade when other casters move', function () {
        app.renderer.dispatchDirectLights([light], camera.camera);
        const originalParams = Array.from(light._shadowCascadeParams);
        const originalFitting = fitting();
        casters[0].setPosition(0, 100, 0);
        update([0]);
        app.renderer.dispatchDirectLights([light], camera.camera);

        expect(fitting()[0].far).not.to.equal(originalFitting[0].far);
        expect(fitting().slice(1)).to.eql(originalFitting.slice(1));
        expect(Array.from(light._shadowCascadeParams).slice(4)).to.eql(originalParams.slice(4));
        expect(Array.from(light._shadowCascadeParams).slice(0, 4)).to.eql(Array.from(new Float32Array([
            renderData(0).projectionCompensation,
            renderData(0).shadowCamera.farClip,
            renderData(0).shadowCamera.nearClip,
            1
        ])));
    });

    it('uses one camera for all fallback parameters of an unfitted cascade', function () {
        light.releaseRenderData();
        update([0]);
        expect(renderData(0).projectionCompensation).to.be.greaterThan(0);
        expect(renderData(1).projectionCompensation).to.equal(0);
        expect(renderData(1).shadowCamera.farClip).not.to.equal(renderData(0).shadowCamera.farClip);

        app.renderer.dispatchDirectLights([light], camera.camera);
        const params = Array.from(light._shadowCascadeParams);
        for (let cascade = 1; cascade < 4; cascade++) {
            expect(params.slice(cascade * 4, cascade * 4 + 4)).to.eql(params.slice(0, 4));
        }
    });

    it('removes the retained bounds when an updated cascade loses its casters', function () {
        const originalFar = renderData(0).shadowCamera.farClip;
        casters[3].render.castShadows = false;
        update([0, 3]);
        expect(renderData(3).shadowCasterAabbValid).to.equal(false);
        expect(renderData(0).shadowCamera.farClip).to.be.lessThan(originalFar);
        const original = fitting();
        update([0]);
        expect(fitting()).to.eql(original);
    });
});
