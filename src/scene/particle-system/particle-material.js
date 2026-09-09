import { Debug } from '../../core/debug.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { PARTICLEORIENTATION_SCREEN, SHADER_FORWARD, SHADERDEF_UV0 } from '../constants.js';
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

        // particles use their own shader, which does not generate the scene textures
        this.sceneTexturesWrite = false;

        this.emitter = emitter;
        Debug.assert(emitter);
    }

    /** @ignore */
    getShaderVariant(params) {

        const { device, objDefs } = params;
        const { emitter } = this;

        // the camera's fog and tonemapping arrive as defines which take precedence over the
        // material's own, so the emitter's per-system opt-outs are applied on top of the merge
        const defines = ShaderUtils.getCoreDefines(this, params);
        if (!emitter.useFog) defines.set('FOG', 'NONE');
        if (!emitter.useTonemap) defines.set('TONEMAP', 'NONE');

        const options = {
            defines,
            pass: SHADER_FORWARD,
            useCpu: this.emitter.useCpu,
            normal: emitter.lighting ? ((emitter.normalMap !== null) ? 2 : 1) : 0,
            halflambert: this.emitter.halfLambert,
            stretch: this.emitter.stretch,
            alignToMotion: this.emitter.alignToMotion,
            soft: this.emitter.depthSoftening,
            mesh: this.emitter.useMesh,
            meshUv: objDefs & SHADERDEF_UV0,
            wrap: this.emitter.wrap && this.emitter.wrapBounds,
            localSpace: this.emitter.localSpace,

            // in Editor, screen space particles (children of 2D Screen) are still rendered in 3d space
            screenSpace: emitter.inTools ? false : this.emitter.screenSpace,

            blend: this.emitter.blendType,
            animTex: this.emitter._isAnimated(),
            animTexLoop: this.emitter.animLoop,
            customFace: this.emitter.orientation !== PARTICLEORIENTATION_SCREEN
        };

        const processingOptions = new ShaderProcessorOptions(params.viewUniformFormat, params.vertexFormat);

        const library = getProgramLibrary(device);
        library.register('particle', particle);

        return library.getProgram('particle', options, processingOptions, this.userId);
    }
}

export { ParticleMaterial };
