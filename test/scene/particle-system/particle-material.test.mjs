import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import { FOG_EXP, SHADER_FORWARD, TONEMAP_ACES } from '../../../src/scene/constants.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 * @import { Shader } from '../../../src/platform/graphics/shader.js'
 */

// the exposure uniform as declared by the GLSL and the WGSL tonemapping chunks
const EXPOSURE_UNIFORM = /uniform float exposure|uniform exposure: f32/;

// the screen space scale of the particle offset x by height / width, and of the direction of
// motion x by width / height, as written by the GLSL and the WGSL chunks
const OFFSET_ASPECT = /localPos\.x \*= \S*viewport_size\.y \* \S*viewport_size\.z/;
const MOTION_ASPECT = /velocityV\.x \*= \S*viewport_size\.x \* \S*viewport_size\.w/;

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
     * Generate the particle shader for a camera with both fog and tonemapping enabled.
     *
     * @param {object} options - Particle system component options.
     * @returns {Shader} The generated shader.
     */
    const createShader = (options) => {
        const entity = new Entity();
        entity.addComponent('particlesystem', { numParticles: 10, ...options });
        app.root.addChild(entity);

        const cameraShaderParams = new CameraShaderParams();
        cameraShaderParams.fog = FOG_EXP;
        cameraShaderParams.toneMapping = TONEMAP_ACES;

        return entity.particlesystem.emitter.material.getShaderVariant({
            device: app.graphicsDevice,
            scene: app.scene,
            objDefs: 0,
            pass: SHADER_FORWARD,
            cameraShaderParams
        });
    };

    /**
     * Generate the particle fragment shader for a camera with both fog and tonemapping enabled.
     *
     * @param {object} options - Particle system component options.
     * @returns {string} The generated fragment shader source.
     */
    const fragmentSource = (options) => {
        const shader = createShader(options);

        // a null source means the shader failed to preprocess
        expect(shader.definition.fshader).to.be.a('string');
        return shader.definition.fshader;
    };

    /**
     * Generate the particle vertex shader.
     *
     * @param {object} options - Particle system component options.
     * @param {boolean} gpu - Whether the emitter simulates on the GPU.
     * @returns {string} The generated vertex shader source.
     */
    const vertexSource = (options, gpu) => {
        app.graphicsDevice.supportsGpuParticles = gpu;
        const shader = createShader(options);

        // a null source means the shader failed to preprocess
        expect(shader.definition.vshader).to.be.a('string');
        return shader.definition.vshader;
    };

    it('follows the camera fog and tonemapping by default', function () {
        const source = fragmentSource({});
        expect(source).to.include('fog_color');
        expect(source).to.match(EXPOSURE_UNIFORM);
    });

    it('drops fog when useFog is false, even though the camera has it enabled', function () {
        // the camera's FOG define takes precedence over the material's own, so the opt-out has to
        // be applied after the two are merged - this is what silently broke the old noFog
        const source = fragmentSource({ useFog: false });
        expect(source).to.not.include('fog_color');
        expect(source).to.match(EXPOSURE_UNIFORM);
    });

    it('drops tonemapping when useTonemap is false, even though the camera has it enabled', function () {
        const source = fragmentSource({ useTonemap: false });
        expect(source).to.not.match(EXPOSURE_UNIFORM);
        expect(source).to.include('fog_color');
    });

    [true, false].forEach((gpu) => {
        it(`keeps screen space particles square on the ${gpu ? 'GPU' : 'CPU'} path`, function () {
            // clip space x spans the viewport width, so without these the particles stretch by
            // the aspect ratio of the canvas, and turn away from their motion when aligned to it
            const source = vertexSource({ screenSpace: true, alignToMotion: true }, gpu);
            expect(source).to.match(OFFSET_ASPECT);
            expect(source).to.match(MOTION_ASPECT);
        });
    });

    it('does not read the viewport size outside screen space', function () {
        expect(vertexSource({ alignToMotion: true }, true)).to.not.include('viewport_size');
        expect(vertexSource({ alignToMotion: true }, false)).to.not.include('viewport_size');
    });
});
