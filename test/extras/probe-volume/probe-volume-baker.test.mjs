import { expect } from 'chai';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { BoundingBox } from '../../../src/core/shape/bounding-box.js';
import { ProbeVolumeBaker } from '../../../src/extras/probe-volume/probe-volume-baker.js';
import { Entity } from '../../../src/framework/entity.js';
import { GraphicsDevice } from '../../../src/platform/graphics/graphics-device.js';
import { LAYERID_SKYBOX, LAYERID_UI, LAYERID_WORLD } from '../../../src/scene/constants.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('ProbeVolumeBaker', function () {

    // a device with the given float rendering capabilities, choosing its formats as a graphics
    // device does
    const createDevice = capabilities => Object.assign(Object.create(GraphicsDevice.prototype), {
        isWebGPU: false,
        textureRG11B10Renderable: false,
        textureHalfFloatRenderable: false,
        textureFloatRenderable: false,
        textureFloatFilterable: false,
        textureFloatBlendable: false
    }, capabilities);

    describe('.isSupported', function () {

        it('returns true for a device rendering to half floats', function () {
            expect(ProbeVolumeBaker.isSupported(createDevice({ textureHalfFloatRenderable: true }))).to.be.true;
        });

        it('returns true for a device rendering to full floats it filters and blends, without half floats', function () {
            expect(ProbeVolumeBaker.isSupported(createDevice({
                textureFloatRenderable: true,
                textureFloatFilterable: true,
                textureFloatBlendable: true
            }))).to.be.true;
        });

        it('returns false for a device rendering to full floats it cannot filter or blend, without half floats', function () {
            expect(ProbeVolumeBaker.isSupported(createDevice({ textureFloatRenderable: true }))).to.be.false;
        });

        it('returns false for a device rendering to no float textures', function () {
            expect(ProbeVolumeBaker.isSupported(createDevice({ textureRG11B10Renderable: true }))).to.be.false;
        });
    });

    describe('#captureGeometry', function () {

        it('rejects on a device which cannot bake, without starting a capture', async function () {
            const baker = new ProbeVolumeBaker({ graphicsDevice: createDevice({}) }, /** @type {any} */ ({}));

            let error = null;
            try {
                await baker.captureGeometry();
            } catch (e) {
                error = e;
            }

            expect(error).to.be.an('error');
            expect(error.message).to.contain('ProbeVolumeBaker.isSupported');
            expect(baker.baking).to.be.false;
        });
    });

    describe('#_setShadowBounds', function () {
        let app;

        const bounds = new BoundingBox(new Vec3(0, 1, 0), new Vec3(4, 1, 3));

        const addLight = (data) => {
            const entity = new Entity();
            entity.addComponent('light', data);
            app.root.addChild(entity);
            return entity.light;
        };

        beforeEach(function () {
            jsdomSetup();
            app = createApp();
        });

        afterEach(function () {
            app.destroy();
            jsdomTeardown();
        });

        it('fits the shadow casting directional lights of the captured layers, and returns their own bounds', function () {
            const own = new BoundingBox(new Vec3(5, 0, 0), new Vec3(1, 1, 1));
            const sun = addLight({ type: 'directional', castShadows: true });
            sun.shadowBounds = own;
            const unshadowed = addLight({ type: 'directional', castShadows: false });
            const omni = addLight({ type: 'omni', castShadows: true });
            const uncaptured = addLight({ type: 'directional', castShadows: true, layers: [LAYERID_UI] });

            const lights = new ProbeVolumeBaker(app)._setShadowBounds([LAYERID_WORLD, LAYERID_SKYBOX], bounds);

            expect(lights).to.have.lengthOf(1);
            expect(lights[0].light).to.equal(sun.light);
            expect(lights[0].bounds.equals(own)).to.be.true;
            expect(sun.shadowBounds.equals(bounds)).to.be.true;
            expect(unshadowed.shadowBounds).to.be.null;
            expect(omni.shadowBounds).to.be.null;
            expect(uncaptured.shadowBounds).to.be.null;
        });

        it('fits a light of several captured layers once', function () {
            const sun = addLight({ type: 'directional', castShadows: true, layers: [LAYERID_WORLD, LAYERID_UI] });

            const lights = new ProbeVolumeBaker(app)._setShadowBounds([LAYERID_WORLD, LAYERID_UI], bounds);

            expect(lights).to.have.lengthOf(1);
            expect(lights[0].bounds).to.be.null;
            expect(sun.shadowBounds.equals(bounds)).to.be.true;
        });

        it('keeps the shadows fitted to each camera without bounds', function () {
            const sun = addLight({ type: 'directional', castShadows: true });

            expect(new ProbeVolumeBaker(app)._setShadowBounds([LAYERID_WORLD], null)).to.be.empty;
            expect(sun.shadowBounds).to.be.null;
        });
    });
});
