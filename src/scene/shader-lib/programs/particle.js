import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { blendNames } from '../../constants.js';
import { shaderChunks } from '../chunks/chunks.js';
import { ShaderGenerator } from './shader-generator.js';

const normalTypeNames = [
    'NONE',
    'VERTEX',
    'MAP'
];

class ShaderGeneratorParticle extends ShaderGenerator {
    generateKey(options) {
        const definesHash = ShaderGenerator.definesHash(options.defines);
        let key = `particle_${definesHash}_`;
        for (const prop in options) {
            if (options.hasOwnProperty(prop)) {
                key += options[prop];
            }
        }
        return key;
    }

    createVertexDefines(options) {
        const vDefines = new Map(options.defines);

        if (options.mesh) vDefines.set('USE_MESH', '');
        if (options.localSpace) vDefines.set('LOCAL_SPACE', '');
        if (options.screenSpace) vDefines.set('SCREEN_SPACE', '');
        if (options.animTex) vDefines.set('ANIMTEX', '');
        if (options.soft > 0) vDefines.set('SOFT', '');
        if (options.stretch > 0.0) vDefines.set('STRETCH', '');
        if (options.customFace) vDefines.set('CUSTOM_FACE', '');
        if (options.pack8) vDefines.set('PACK8', '');
        if (options.localSpace) vDefines.set('LOCAL_SPACE', '');
        if (options.animTexLoop) vDefines.set('ANIMTEX_LOOP', '');
        if (options.wrap) vDefines.set('WRAP', '');
        if (options.alignToMotion) vDefines.set('ALIGN_TO_MOTION', '');

        vDefines.set('NORMAL', normalTypeNames[options.normal]);

        return vDefines;
    }

    createFragmentDefines(options) {
        const fDefines = new Map(options.defines);

        if (options.soft > 0) fDefines.set('SOFT', '');
        if (options.halflambert) fDefines.set('HALF_LAMBERT', '');

        fDefines.set('NORMAL', normalTypeNames[options.normal]);
        fDefines.set('BLEND', blendNames[options.blend]);

        return fDefines;
    }

    createShaderDefinition(device, options) {

        const vDefines = this.createVertexDefines(options);
        const fDefines = this.createFragmentDefines(options);

        const executionDefine = `PARTICLE_${options.useCpu ? 'CPU' : 'GPU'}\n`;
        vDefines.set(executionDefine, '');
        fDefines.set(executionDefine, '');

        const includes = new Map(Object.entries({
            ...shaderChunks,
            ...options.chunks
        }));

        return ShaderUtils.createDefinition(device, {
            name: 'ParticleShader',
            vertexCode: shaderChunks.particle_shaderVS,
            fragmentCode: shaderChunks.particle_shaderPS,
            fragmentDefines: fDefines,
            fragmentIncludes: includes,
            vertexIncludes: includes,
            vertexDefines: vDefines
        });
    }
}

const particle = new ShaderGeneratorParticle();

export { particle };
