import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { AppBase } from '../../../src/framework/app-base.js';
import { AppOptions } from '../../../src/framework/app-options.js';
import { ParticleSystemComponentSystem } from '../../../src/framework/components/particle-system/system.js';
import { Entity } from '../../../src/framework/entity.js';
import { FEATURE_PARTICLES } from '../../../src/framework/features/constants.js';
import {
    featureParticles, featureParticlesWebgl, featureParticlesWebgpu
} from '../../../src/framework/features/feature-particles.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { hasFeature } from '../../../src/scene/features/constants.js';
import { installFeatures } from '../../../src/scene/features/install-features.js';
import { ParticleEmitter } from '../../../src/scene/particle-system/particle-emitter.js';
import { particleChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/particle-chunks-glsl.js';
import { shaderChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/shader-chunks-glsl.js';
import { ShaderChunks } from '../../../src/scene/shader-lib/shader-chunks.js';
import { particleChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/particle-chunks-wgsl.js';
import { createApp } from '../../app.mjs';
import { createGraphicsDevice } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

const EMITTER_ASSERT = 'A particle emitter needs the particle shader chunks of its device, installed by featureParticles.';

describe('Particles feature', function () {

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

    // the messages of the debug asserts that fail while calling a function
    const failedAsserts = (fn) => {
        const assert = sinon.stub(Debug, 'assert');
        try {
            fn();
        } catch (e) {
            // the null device cannot create every resource, only the asserts matter
        }
        assert.restore();
        return assert.getCalls().filter(call => !call.args[0]).map(call => call.args[1]);
    };

    const glslChunk = () => ShaderChunks.get(app.graphicsDevice, SHADERLANGUAGE_GLSL).get('particle_shaderVS');
    const wgslChunk = () => ShaderChunks.get(app.graphicsDevice, SHADERLANGUAGE_WGSL).get('particle_shaderVS');

    it('has the same chunks in both languages, and none of them in the core chunks', function () {
        expect(Object.keys(particleChunksGLSL.chunks)).to.deep.equal(Object.keys(particleChunksWGSL.chunks));
        for (const name of Object.keys(particleChunksGLSL.chunks)) {
            expect(shaderChunksGLSL).to.not.have.property(name);
        }
    });

    it('installs the particle system component system, and the chunks of both languages', function () {
        app = createMinimalApp({ features: [featureParticles] });

        expect(hasFeature(app.graphicsDevice, FEATURE_PARTICLES)).to.equal(true);
        expect(app.systems.particlesystem).to.be.an.instanceof(ParticleSystemComponentSystem);
        expect(glslChunk()).to.equal(particleChunksGLSL.chunks.particle_shaderVS);
        expect(wgslChunk()).to.equal(particleChunksWGSL.chunks.particle_shaderVS);

        const entity = new Entity('Particles', app);
        entity.addComponent('particlesystem');
        expect(entity.particlesystem).to.exist;
    });

    it('installs the chunks of WebGL only with the WebGL feature', function () {
        app = createMinimalApp({ features: [featureParticlesWebgl] });

        expect(hasFeature(app.graphicsDevice, FEATURE_PARTICLES)).to.equal(true);
        expect(app.systems.particlesystem).to.be.an.instanceof(ParticleSystemComponentSystem);
        expect(glslChunk()).to.equal(particleChunksGLSL.chunks.particle_shaderVS);
        expect(wgslChunk()).to.be.undefined;
    });

    it('installs the chunks of WebGPU only with the WebGPU feature', function () {
        app = createMinimalApp({ features: [featureParticlesWebgpu] });

        expect(hasFeature(app.graphicsDevice, FEATURE_PARTICLES)).to.equal(true);
        expect(app.systems.particlesystem).to.be.an.instanceof(ParticleSystemComponentSystem);
        expect(glslChunk()).to.be.undefined;
        expect(wgslChunk()).to.equal(particleChunksWGSL.chunks.particle_shaderVS);
    });

    it('adds the component system once when several variants are installed', function () {
        app = createMinimalApp({ features: [featureParticlesWebgl, featureParticles, featureParticlesWebgpu] });

        expect(app.systems.list.filter(system => system instanceof ParticleSystemComponentSystem)).to.have.lengthOf(1);
        expect(glslChunk()).to.equal(particleChunksGLSL.chunks.particle_shaderVS);
        expect(wgslChunk()).to.equal(particleChunksWGSL.chunks.particle_shaderVS);
    });

    it('is installed by the test application', function () {
        app = createApp();

        expect(app.systems.particlesystem).to.be.an.instanceof(ParticleSystemComponentSystem);
        expect(hasFeature(app.graphicsDevice, FEATURE_PARTICLES)).to.equal(true);
    });

    it('leaves the application without particle systems when not listed', function () {
        app = createMinimalApp({});

        expect(app.systems.particlesystem).to.be.undefined;
        expect(hasFeature(app.graphicsDevice, FEATURE_PARTICLES)).to.equal(false);
        expect(glslChunk()).to.be.undefined;
        expect(wgslChunk()).to.be.undefined;
    });

    it('asserts when the component system is listed without the feature', function () {
        const failed = failedAsserts(() => {
            app = createMinimalApp({ componentSystems: [ParticleSystemComponentSystem] });
        });

        expect(failed.some(message => message?.includes('installed by featureParticles'))).to.equal(true);
    });

    describe('particle emitter', function () {

        // an application with the particles feature of the device the tests run on, or of the other
        // device, which leaves the device without its own chunks
        const createEmitterApp = (ownDevice) => {
            const emitterApp = createMinimalApp({});
            const isWebGPU = emitterApp.graphicsDevice.isWebGPU;
            installFeatures(emitterApp, [isWebGPU === ownDevice ? featureParticlesWebgpu : featureParticlesWebgl]);
            return emitterApp;
        };

        it('asserts when created without the chunks of its device', function () {
            app = createEmitterApp(false);

            const failed = failedAsserts(() => new ParticleEmitter(app.graphicsDevice, {}));
            expect(failed).to.include(EMITTER_ASSERT);
        });

        it('does not assert when created with the chunks of its device', function () {
            app = createEmitterApp(true);

            const failed = failedAsserts(() => new ParticleEmitter(app.graphicsDevice, {}));
            expect(failed).to.not.include(EMITTER_ASSERT);
        });
    });
});
