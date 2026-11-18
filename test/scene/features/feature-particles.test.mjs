import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { ParticleSystemComponentSystem } from '../../../src/framework/components/particle-system/system.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { FEATURE_PARTICLES } from '../../../src/scene/features/constants.js';
import { featureParticlesWebgl } from '../../../src/scene/features/feature-particles.js';
import { installFeatures } from '../../../src/scene/features/install-features.js';
import { ParticleEmitter } from '../../../src/scene/particle-system/particle-emitter.js';
import { particleChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/particle-chunks-glsl.js';
import { shaderChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/shader-chunks-glsl.js';
import { ShaderChunks } from '../../../src/scene/shader-lib/shader-chunks.js';
import { particleChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/particle-chunks-wgsl.js';
import { createApp } from '../../app.mjs';
import { createGraphicsDevice } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Particles feature', function () {

    it('has the same chunks in both languages, and none of them in the core chunks', function () {
        expect(Object.keys(particleChunksGLSL.chunks)).to.deep.equal(Object.keys(particleChunksWGSL.chunks));
        for (const name of Object.keys(particleChunksGLSL.chunks)) {
            expect(shaderChunksGLSL).to.not.have.property(name);
        }
    });

    it('registers the chunks of its language', function () {
        const device = createGraphicsDevice({ width: 1, height: 1 });
        try {
            installFeatures({ graphicsDevice: device }, [featureParticlesWebgl]);

            expect(device.features.has(FEATURE_PARTICLES)).to.equal(true);
            expect(ShaderChunks.get(device, SHADERLANGUAGE_GLSL).get('particle_shaderVS')).to.equal(particleChunksGLSL.chunks.particle_shaderVS);
            expect(ShaderChunks.get(device, SHADERLANGUAGE_WGSL).get('particle_shaderVS')).to.be.undefined;
        } finally {
            device.destroy();
        }
    });

    describe('application', function () {
        let app;

        beforeEach(function () {
            jsdomSetup();
            app = createApp();
        });

        afterEach(function () {
            sinon.restore();
            app.destroy();
            jsdomTeardown();
        });

        it('is installed by the particle system component system, for both languages', function () {
            expect(app.systems.particlesystem).to.be.an.instanceof(ParticleSystemComponentSystem);
            expect(app.graphicsDevice.features.has(FEATURE_PARTICLES)).to.equal(true);
            expect(ShaderChunks.get(app.graphicsDevice, SHADERLANGUAGE_GLSL).get('particle_shaderPS')).to.equal(particleChunksGLSL.chunks.particle_shaderPS);
            expect(ShaderChunks.get(app.graphicsDevice, SHADERLANGUAGE_WGSL).get('particle_shaderPS')).to.equal(particleChunksWGSL.chunks.particle_shaderPS);
        });

        it('asserts when a particle emitter is created without the feature', function () {
            app.graphicsDevice.features.delete(FEATURE_PARTICLES);
            const assert = sinon.stub(Debug, 'assert');

            const createEmitter = () => new ParticleEmitter(app.graphicsDevice, {});
            try {
                createEmitter();
            } catch (e) {
                // the null device cannot create the emitter's resources, only the assert matters
            }

            const failed = assert.getCalls().filter(call => !call.args[0]).map(call => call.args[1]);
            expect(failed).to.include('A particle emitter needs the particles feature to be installed.');
        });
    });
});
