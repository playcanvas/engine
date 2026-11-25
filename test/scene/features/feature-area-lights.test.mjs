import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Entity } from '../../../src/framework/entity.js';
import { PIXELFORMAT_RGBA16F, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { LIGHTSHAPE_DISK, LIGHTSHAPE_PUNCTUAL, LIGHTSHAPE_RECT, LIGHTSHAPE_SPHERE } from '../../../src/scene/constants.js';
import { FEATURE_AREA_LIGHTS, hasFeature } from '../../../src/scene/features/constants.js';
import { featureAreaLightsWebgl, featureAreaLightsWebgpu } from '../../../src/scene/features/feature-area-lights.js';
import { installFeatures } from '../../../src/scene/features/install-features.js';
import { areaLightChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/area-light-chunks-glsl.js';
import { shaderChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/shader-chunks-glsl.js';
import { ShaderChunks } from '../../../src/scene/shader-lib/shader-chunks.js';
import { areaLightChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/area-light-chunks-wgsl.js';
import { shaderChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/shader-chunks-wgsl.js';
import { createApp } from '../../app.mjs';
import { createGraphicsDevice } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Area lights feature', function () {

    it('keeps the area light chunks out of the core chunks', function () {
        for (const name of Object.keys(areaLightChunksGLSL.chunks)) {
            expect(shaderChunksGLSL).to.not.have.property(name);
        }
        for (const name of Object.keys(areaLightChunksWGSL.chunks)) {
            expect(shaderChunksWGSL).to.not.have.property(name);
        }
        expect(Object.keys(areaLightChunksGLSL.chunks)).to.deep.equal(Object.keys(areaLightChunksWGSL.chunks));
    });

    describe('installation', function () {
        let device;

        beforeEach(function () {
            device = createGraphicsDevice({ width: 1, height: 1 });
        });

        afterEach(function () {
            device.destroy();
        });

        it('registers the chunks of its language and the LUT textures', function () {
            const setValue = sinon.spy(device.scope.resolve('areaLightsLutTex1'), 'setValue');

            installFeatures({ graphicsDevice: device }, [featureAreaLightsWebgl]);

            expect(hasFeature(device, FEATURE_AREA_LIGHTS)).to.equal(true);
            expect(ShaderChunks.get(device, SHADERLANGUAGE_GLSL).get('ltcPS')).to.equal(areaLightChunksGLSL.chunks.ltcPS);
            expect(ShaderChunks.get(device, SHADERLANGUAGE_WGSL).get('ltcPS')).to.be.undefined;
            expect(setValue.calledOnce).to.equal(true);
            expect(setValue.firstCall.args[0].name).to.equal('AreaLightLUT');
            sinon.restore();
        });

        it('creates the LUT textures from the LUT data', function () {
            const setValue1 = sinon.spy(device.scope.resolve('areaLightsLutTex1'), 'setValue');
            const setValue2 = sinon.spy(device.scope.resolve('areaLightsLutTex2'), 'setValue');

            installFeatures({ graphicsDevice: device }, [featureAreaLightsWebgl]);

            const texture1 = setValue1.firstCall.args[0];
            const texture2 = setValue2.firstCall.args[0];
            for (const texture of [texture1, texture2]) {
                expect(texture.width).to.equal(64);
                expect(texture.height).to.equal(64);
                expect(texture.format).to.equal(PIXELFORMAT_RGBA16F);
                expect(texture._levels[0]).to.have.lengthOf(64 * 64 * 4);
            }

            // the half float bits of the texel at (32, 32) in each table
            const offset = (64 * 32 + 32) * 4;
            expect(Array.from(texture1._levels[0].subarray(offset, offset + 4))).to.deep.equal([0x3902, 0xb307, 0x3841, 0x34ff]);
            expect(Array.from(texture2._levels[0].subarray(offset, offset + 4))).to.deep.equal([0x3b0f, 0x1a13, 0x0000, 0x3224]);
            sinon.restore();
        });

        it('creates the LUT textures once when installed for both devices', function () {
            const setValue = sinon.spy(device.scope.resolve('areaLightsLutTex1'), 'setValue');

            installFeatures({ graphicsDevice: device }, [featureAreaLightsWebgl, featureAreaLightsWebgpu]);

            expect(setValue.calledOnce).to.equal(true);
            sinon.restore();
        });
    });

    // a missing feature is reported by asserts in debug builds, rather than handled
    describe('without the feature', function () {
        let app;
        let assert;

        const failedAsserts = () => assert.getCalls().filter(call => !call.args[0]).map(call => call.args[1]);

        beforeEach(function () {
            jsdomSetup();
            app = createApp();

            // as if the application did not install the area lights feature
            app.graphicsDevice.featureNames.delete(FEATURE_AREA_LIGHTS);
            assert = sinon.stub(Debug, 'assert');

            const camera = new Entity('Camera');
            camera.addComponent('camera');
            app.root.addChild(camera);
        });

        afterEach(function () {
            sinon.restore();
            app.destroy();
            jsdomTeardown();
        });

        it('asserts when a light is given an area shape', function () {
            const light = new Entity('Light');
            light.addComponent('light', { type: 'spot' });
            light.light.shape = LIGHTSHAPE_RECT;

            expect(failedAsserts()).to.include('A light of an area shape needs the area lights feature to be installed.');
        });

        it('does not assert for a punctual light', function () {
            const light = new Entity('Light');
            light.addComponent('light', { type: 'spot' });
            light.light.shape = LIGHTSHAPE_RECT;
            assert.resetHistory();
            light.light.shape = LIGHTSHAPE_PUNCTUAL;

            expect(failedAsserts()).to.deep.equal([]);
        });

        it('asserts when clustered area lights generate a lit shader', function () {
            app.scene.clusteredLightingEnabled = true;
            app.scene.lighting.areaLightsEnabled = true;
            const box = new Entity('Box');
            box.addComponent('render', { type: 'box' });
            app.root.addChild(box);

            app.render();

            expect(failedAsserts().some(message => message.startsWith('Area lights need the area lights feature'))).to.equal(true);
        });
    });

    // the feature brings the LUT tables, so the setter is a stub reporting its removal. It takes no
    // parameters, so callers that check for the old two parameter setter skip calling it.
    it('reports setAreaLightLuts as removed', function () {
        jsdomSetup();
        const app = createApp();
        const removed = sinon.stub(Debug, 'removed');
        try {
            expect(app.setAreaLightLuts).to.have.lengthOf(0);
            app.setAreaLightLuts([0], [0]);
            expect(removed.calledOnce).to.equal(true);
            expect(removed.firstCall.args[0]).to.include('AppBase#setAreaLightLuts is removed');
        } finally {
            sinon.restore();
            app.destroy();
            jsdomTeardown();
        }
    });

    // the clustered area light code moved to clusteredLightAreaPS, so shaders with clustered area
    // lights of every shape must still compile
    it('compiles lit shaders with clustered area lights', function () {
        jsdomSetup();
        const app = createApp();
        const error = sinon.spy(console, 'error');
        try {
            app.scene.clusteredLightingEnabled = true;
            app.scene.lighting.areaLightsEnabled = true;

            const camera = new Entity('Camera');
            camera.addComponent('camera');
            app.root.addChild(camera);
            for (const shape of [LIGHTSHAPE_RECT, LIGHTSHAPE_DISK, LIGHTSHAPE_SPHERE]) {
                const light = new Entity(`Light${shape}`);
                light.addComponent('light', { type: 'omni', shape });
                app.root.addChild(light);
            }
            const box = new Entity('Box');
            box.addComponent('render', { type: 'box' });
            app.root.addChild(box);

            app.render();

            const errors = error.getCalls().map(call => String(call.args[0]));
            expect(errors).to.deep.equal([]);
        } finally {
            sinon.restore();
            app.destroy();
            jsdomTeardown();
        }
    });
});
