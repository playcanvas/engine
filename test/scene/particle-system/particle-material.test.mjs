import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import { FOG_EXP, SHADER_FORWARD, TONEMAP_ACES } from '../../../src/scene/constants.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 */

describe('ParticleMaterial', function () {
    /** @type {Application} */
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        // the null device skips particle systems by default - enable them so the emitter is created
        app.graphicsDevice.disableParticleSystem = false;
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    /**
     * Generate the particle fragment shader for a camera which has both fog and tonemapping enabled.
     *
     * @param {object} options - Particle system component options.
     * @returns {string} The generated fragment shader source.
     */
    const fragmentSource = (options) => {
        const entity = new Entity();
        entity.addComponent('particlesystem', { numParticles: 10, ...options });
        app.root.addChild(entity);

        const cameraShaderParams = new CameraShaderParams();
        cameraShaderParams.fog = FOG_EXP;
        cameraShaderParams.toneMapping = TONEMAP_ACES;

        const shader = entity.particlesystem.emitter.material.getShaderVariant({
            device: app.graphicsDevice,
            scene: app.scene,
            objDefs: 0,
            pass: SHADER_FORWARD,
            cameraShaderParams
        });

        // a null source means the shader failed to preprocess
        expect(shader.definition.fshader).to.be.a('string');
        return shader.definition.fshader;
    };

    it('follows the camera fog and tonemapping by default', function () {
        const source = fragmentSource({});
        expect(source).to.include('fog_color');
        expect(source).to.include('uniform float exposure');
    });

    it('drops fog when useFog is false, even though the camera has it enabled', function () {
        // the camera's FOG define takes precedence over the material's own, so the opt-out has to
        // be applied after the two are merged - this is what silently broke the old noFog
        const source = fragmentSource({ useFog: false });
        expect(source).to.not.include('fog_color');
        expect(source).to.include('uniform float exposure');
    });

    it('drops tonemapping when useTonemap is false, even though the camera has it enabled', function () {
        const source = fragmentSource({ useTonemap: false });
        expect(source).to.not.include('uniform float exposure');
        expect(source).to.include('fog_color');
    });
});
