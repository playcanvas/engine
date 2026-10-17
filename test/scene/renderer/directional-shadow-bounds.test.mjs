import { expect } from 'chai';
import sinon from 'sinon';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { Vec4 } from '../../../src/core/math/vec4.js';
import { BoundingBox } from '../../../src/core/shape/bounding-box.js';
import { Entity } from '../../../src/framework/entity.js';
import { SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, SHADOW_VSM_16F } from '../../../src/scene/constants.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Directional shadow bounds', function () {
    let app;
    let lightEntity;
    let light;
    let cull;
    let cullBounds;
    let renderFace;

    const bounds = new BoundingBox(new Vec3(0, 1, 0), new Vec3(2, 1, 1));

    const createCamera = (x) => {
        const entity = new Entity('Camera');
        entity.addComponent('camera');
        entity.setPosition(x, 3, 8);
        entity.lookAt(0, 0, 0);
        app.root.addChild(entity);
        return entity.camera;
    };

    const createCaster = (x, y, z) => {
        const entity = new Entity('Caster');
        entity.addComponent('render', { type: 'box' });
        entity.setPosition(x, y, z);
        app.root.addChild(entity);
        return entity.render.meshInstances[0];
    };

    // the position of a world space point in the shadow map
    const project = (point) => {
        const result = new Vec4(point.x, point.y, point.z, 1);
        light.getRenderData(null, 0).shadowMatrix.transformVec4(result, result);
        return new Vec3(result.x / result.w, result.y / result.w, result.z / result.w);
    };

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        // two cameras, which share the shadow of the bounds, and render cascades of their own without
        createCamera(-2);
        createCamera(2);

        lightEntity = new Entity('Light');
        lightEntity.addComponent('light', { type: 'directional', castShadows: true, numCascades: 2, cascadeBlend: 0.2 });
        lightEntity.setEulerAngles(40, 30, 0);
        app.root.addChild(lightEntity);
        light = lightEntity.light.light;

        createCaster(0, 1, 0);

        cull = sinon.spy(app.renderer._shadowRendererDirectional, 'cull');
        cullBounds = sinon.spy(app.renderer._shadowRendererDirectional, 'cullBounds');
        renderFace = sinon.spy(app.renderer.shadowRenderer, 'renderFace');
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
        jsdomTeardown();
    });

    it('renders one shadow for all cameras', function () {
        lightEntity.light.shadowBounds = bounds;
        app.render();
        expect(cull.called).to.equal(false);
        expect(cullBounds.callCount).to.equal(1);
        expect(renderFace.callCount).to.equal(1);
        expect(renderFace.firstCall.args[1]).to.equal(null);

        app.render();
        expect(cullBounds.callCount).to.equal(2);
        expect(renderFace.callCount).to.equal(2);
    });

    it('renders the cascades of each camera without bounds', function () {
        app.render();
        expect(cull.callCount).to.equal(2);
        expect(cullBounds.called).to.equal(false);
        expect(renderFace.callCount).to.equal(4);
    });

    it('renders a single cascade without blending, and restores the cascades', function () {
        const keyCascades = light.key;
        lightEntity.light.shadowBounds = bounds;
        expect(light.shadowCascadeCount).to.equal(1);
        expect(light.numShadowFaces).to.equal(1);
        expect(light.usesCascadeBlend).to.equal(false);
        expect(lightEntity.light.numCascades).to.equal(2);
        expect(light.key & (1 << 9)).to.equal(0);
        expect(light.key & (1 << 8)).to.equal(0);

        lightEntity.light.shadowBounds = null;
        expect(light.shadowCascadeCount).to.equal(2);
        expect(light.numShadowFaces).to.equal(2);
        expect(light.usesCascadeBlend).to.equal(true);
        expect(light.key).to.equal(keyCascades);
    });

    it('fits the shadow map to the bounds as seen from the light', function () {
        lightEntity.light.shadowBounds = bounds;
        app.render();

        // the corners of the bounds map inside the border of the shadow map, and within its depth
        const border = 2 / light.shadowResolution;
        const min = bounds.getMin();
        const max = bounds.getMax();
        for (let i = 0; i < 8; i++) {
            const corner = new Vec3(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z);
            const p = project(corner);
            expect(p.x).to.be.within(border - 1e-4, 1 - border + 1e-4);
            expect(p.y).to.be.within(border - 1e-4, 1 - border + 1e-4);
            expect(p.z).to.be.within(0, 1);
        }

        // a point beside the bounds, as seen from the light, maps outside of the shadow map
        const beside = project(new Vec3(30, 1, 0));
        const outside = beside.x < 0 || beside.x > 1 || beside.y < 0 || beside.y > 1;
        expect(outside).to.equal(true);

        // square texels, and the world space half size of the whole shadow map for PCSS
        const data = light.getRenderData(null, 0);
        expect(data.shadowCamera.aspectRatio).to.equal(1);
        expect(data.projectionCompensation).to.be.closeTo(data.shadowCamera.orthoHeight / data.shadowViewport.z, 1e-6);
    });

    it('leaves a border wider than the blur of a VSM', function () {
        lightEntity.light.shadowType = SHADOW_VSM_16F;
        if (!light._isVsm) {
            this.skip();
        }
        lightEntity.light.vsmBlurSize = 25;
        lightEntity.light.shadowBounds = bounds;
        app.render();

        const viewport = light.getRenderData(null, 0).shadowViewport;
        expect(Math.round(viewport.x * light.shadowResolution)).to.equal(13);
        expect(Math.round(viewport.y * light.shadowResolution)).to.equal(13);
    });

    it('includes the casters toward the light, and skips the ones beside or behind the bounds', function () {
        // the light shines along the negative y axis of its entity
        const towardLight = lightEntity.up.clone().mulScalar(10);
        const above = createCaster(towardLight.x, 1 + towardLight.y, towardLight.z);
        const behind = createCaster(-towardLight.x, 1 - towardLight.y, -towardLight.z);
        const beside = createCaster(40, 1, 0);

        lightEntity.light.shadowBounds = bounds;
        app.render();

        const casters = light.getRenderData(null, 0).visibleCasters;
        expect(casters).to.include(above);
        expect(casters).not.to.include(behind);
        expect(casters).not.to.include(beside);

        // the depth range reaches the caster toward the light
        expect(project(above.aabb.center).z).to.be.within(0, 1);
    });

    it('renders a cached shadow once, and again when the bounds change', function () {
        lightEntity.light.shadowUpdateMode = SHADOWUPDATE_NONE;
        lightEntity.light.shadowBounds = bounds;
        expect(lightEntity.light.shadowUpdateMode).to.equal(SHADOWUPDATE_THISFRAME);
        app.render();
        app.render();
        expect(renderFace.callCount).to.equal(1);
        expect(lightEntity.light.shadowUpdateMode).to.equal(SHADOWUPDATE_NONE);

        // the same bounds do not render it again
        lightEntity.light.shadowBounds = bounds.clone();
        app.render();
        expect(renderFace.callCount).to.equal(1);

        const moved = bounds.clone();
        moved.center.x += 1;
        lightEntity.light.shadowBounds = moved;
        app.render();
        app.render();
        expect(renderFace.callCount).to.equal(2);
        expect(project(moved.center).x).to.be.within(0, 1);
    });

    it('renders a cascade cached by shadowUpdateOverrides again when the bounds change', function () {
        lightEntity.light.shadowBounds = bounds;
        app.render();
        expect(renderFace.callCount).to.equal(1);

        // the rendered shadow is cached
        light.shadowUpdateOverrides = [SHADOWUPDATE_NONE];
        app.render();
        expect(renderFace.callCount).to.equal(1);

        const moved = bounds.clone();
        moved.center.x += 1;
        lightEntity.light.shadowBounds = moved;
        app.render();
        app.render();
        expect(renderFace.callCount).to.equal(2);
        expect(project(moved.center).x).to.be.within(0, 1);
    });

    it('renders a cached shadow again when the bounds from the getter are modified and set again', function () {
        lightEntity.light.shadowUpdateMode = SHADOWUPDATE_NONE;
        lightEntity.light.shadowBounds = bounds;
        app.render();
        expect(renderFace.callCount).to.equal(1);

        const current = lightEntity.light.shadowBounds;
        current.center.x += 1;
        lightEntity.light.shadowBounds = current;
        app.render();
        app.render();
        expect(renderFace.callCount).to.equal(2);
        expect(project(current.center).x).to.be.within(0, 1);
    });

    it('copies the bounds, and clones them with the entity', function () {
        const source = bounds.clone();
        lightEntity.light.shadowBounds = source;
        source.center.x = 100;
        expect(lightEntity.light.shadowBounds.center.x).to.equal(0);
        expect(lightEntity.light.shadowBounds).not.to.equal(source);

        const clone = lightEntity.clone();
        expect(clone.light.shadowBounds.equals(bounds)).to.equal(true);
        expect(clone.light.shadowBounds).not.to.equal(lightEntity.light.shadowBounds);
        expect(clone.light.light.shadowCascadeCount).to.equal(1);
        clone.destroy();
    });
});
