import { Debug } from '../../core/debug.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import {
    GAMMA_NONE,
    PARTICLEORIENTATION_SCREEN,
    SHADER_FORWARD,
    SHADERDEF_UV0,
    TONEMAP_LINEAR
} from '../constants.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { Material } from '../materials/material.js';
import { particle } from '../shader-lib/programs/particle.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';

/**
 * @import { ParticleEmitter } from './particle-emitter.js'
 */

/**
 * A material for rendering particle geometry by the particle emitter.
 *
 * @category Graphics
 * @ignore
 */
class ParticleMaterial extends Material {
    /**
     * The color of the particles.
     *
     * @type {ParticleEmitter}
     */
    emitter = null;

    constructor(emitter) {
        super();

        this.emitter = emitter;
        Debug.assert(emitter);
    }

    getShaderVariant(params) {

        const { device, scene, cameraShaderParams, objDefs } = params;
        const { emitter } = this;
        const options = {
            defines: ShaderUtils.getCoreDefines(this, params),
            pass: SHADER_FORWARD,
            useCpu: this.emitter.useCpu,
            normal: emitter.lighting ? ((emitter.normalMap !== null) ? 2 : 1) : 0,
            halflambert: this.emitter.halfLambert,
            stretch: this.emitter.stretch,
            alignToMotion: this.emitter.alignToMotion,
            soft: this.emitter.depthSoftening,
            mesh: this.emitter.useMesh,
            meshUv: objDefs & SHADERDEF_UV0,
            gamma: cameraShaderParams?.shaderOutputGamma ?? GAMMA_NONE,
            toneMap: cameraShaderParams?.toneMapping ?? TONEMAP_LINEAR,
            fog: (scene && !this.emitter.noFog) ? scene.fog.type : 'none',
            wrap: this.emitter.wrap && this.emitter.wrapBounds,
            localSpace: this.emitter.localSpace,

            // in Editor, screen space particles (children of 2D Screen) are still rendered in 3d space
            screenSpace: emitter.inTools ? false : this.emitter.screenSpace,

            blend: this.emitter.blendType,
            animTex: this.emitter._isAnimated(),
            animTexLoop: this.emitter.animLoop,
            pack8: this.emitter.pack8,
            customFace: this.emitter.orientation !== PARTICLEORIENTATION_SCREEN
        };

        const processingOptions = new ShaderProcessorOptions(params.viewUniformFormat, params.viewBindGroupFormat, params.vertexFormat);

        const library = getProgramLibrary(device);
        library.register('particle', particle);

        return library.getProgram('particle', options, processingOptions, this.userId);
    }
}

export { ParticleMaterial };
