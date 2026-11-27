import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { AppBase } from '../../../src/framework/app-base.js';
import { AppOptions } from '../../../src/framework/app-options.js';
import { GSplatComponentSystem } from '../../../src/framework/components/gsplat/system.js';
import { Entity } from '../../../src/framework/entity.js';
import { FEATURE_GSPLAT } from '../../../src/framework/features/constants.js';
import {
    featureGsplat, featureGsplatWebgl, featureGsplatWebgpu
} from '../../../src/framework/features/feature-gsplat.js';
import { GSplatHandler } from '../../../src/framework/handlers/gsplat.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { hasFeature } from '../../../src/scene/features/constants.js';
import { gsplatChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/gsplat-chunks-glsl.js';
import { ShaderChunks } from '../../../src/scene/shader-lib/shader-chunks.js';
import { gsplatChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/gsplat-chunks-wgsl.js';
import { createApp } from '../../app.mjs';
import { createGraphicsDevice } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Gsplat feature', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
    });

    afterEach(function () {
        sinon.restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    // an application with only the given options, rather than everything the test app registers
    const createMinimalApp = (options) => {
        const canvas = document.createElement('canvas');
        const appOptions = new AppOptions();
        appOptions.graphicsDevice = createGraphicsDevice(canvas);
        Object.assign(appOptions, options);

        const minimal = new AppBase(canvas);
        minimal.init(appOptions);
        return minimal;
    };

    // a chunk the gsplat feature registers in both languages
    const chunkName = Object.keys(gsplatChunksGLSL).find(name => name in gsplatChunksWGSL);
    const glslChunk = () => ShaderChunks.get(app.graphicsDevice, SHADERLANGUAGE_GLSL).get(chunkName);
    const wgslChunk = () => ShaderChunks.get(app.graphicsDevice, SHADERLANGUAGE_WGSL).get(chunkName);

    it('installs the gsplat component system, the gsplat handler, and the chunks of both languages', function () {
        app = createMinimalApp({ features: [featureGsplat] });

        expect(hasFeature(app.graphicsDevice, FEATURE_GSPLAT)).to.equal(true);
        expect(app.systems.gsplat).to.be.an.instanceof(GSplatComponentSystem);
        expect(app.loader.getHandler('gsplat')).to.be.an.instanceof(GSplatHandler);
        expect(glslChunk()).to.equal(gsplatChunksGLSL[chunkName]);
        expect(wgslChunk()).to.equal(gsplatChunksWGSL[chunkName]);

        const entity = new Entity('Splat', app);
        entity.addComponent('gsplat');
        expect(entity.gsplat).to.exist;
    });

    it('installs the chunks of WebGL only with the WebGL feature', function () {
        app = createMinimalApp({ features: [featureGsplatWebgl] });

        expect(app.systems.gsplat).to.be.an.instanceof(GSplatComponentSystem);
        expect(app.loader.getHandler('gsplat')).to.be.an.instanceof(GSplatHandler);
        expect(glslChunk()).to.equal(gsplatChunksGLSL[chunkName]);
        expect(wgslChunk()).to.be.undefined;
    });

    it('installs the chunks of WebGPU only with the WebGPU feature', function () {
        app = createMinimalApp({ features: [featureGsplatWebgpu] });

        expect(app.systems.gsplat).to.be.an.instanceof(GSplatComponentSystem);
        expect(app.loader.getHandler('gsplat')).to.be.an.instanceof(GSplatHandler);
        expect(glslChunk()).to.be.undefined;
        expect(wgslChunk()).to.equal(gsplatChunksWGSL[chunkName]);
    });

    it('adds the component system and the handler once when several variants are installed', function () {
        app = createMinimalApp({ features: [featureGsplatWebgl, featureGsplat, featureGsplatWebgpu] });

        expect(app.systems.list.filter(system => system instanceof GSplatComponentSystem)).to.have.lengthOf(1);
        expect(glslChunk()).to.equal(gsplatChunksGLSL[chunkName]);
        expect(wgslChunk()).to.equal(gsplatChunksWGSL[chunkName]);
    });

    it('is installed by the test application', function () {
        app = createApp();

        expect(app.systems.gsplat).to.be.an.instanceof(GSplatComponentSystem);
        expect(app.loader.getHandler('gsplat')).to.be.an.instanceof(GSplatHandler);
        expect(hasFeature(app.graphicsDevice, FEATURE_GSPLAT)).to.equal(true);
    });

    it('leaves the application without gsplats when not listed', function () {
        app = createMinimalApp({});

        expect(app.systems.gsplat).to.be.undefined;
        expect(app.loader.getHandler('gsplat')).to.be.undefined;
        expect(hasFeature(app.graphicsDevice, FEATURE_GSPLAT)).to.equal(false);
        expect(glslChunk()).to.be.undefined;
    });

    it('asserts when the component system is listed without the feature', function () {
        const assert = sinon.stub(Debug, 'assert');
        app = createMinimalApp({ componentSystems: [GSplatComponentSystem] });
        assert.restore();

        const failed = assert.getCalls().filter(call => !call.args[0]).map(call => call.args[1]);
        expect(failed.some(message => message?.includes('installed by featureGsplat'))).to.equal(true);
    });
});
