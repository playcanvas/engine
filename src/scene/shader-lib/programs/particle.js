import { SEMANTIC_POSITION, SEMANTIC_TEXCOORD0, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../platform/graphics/constants.js';
import { ShaderDefinitionUtils } from '../../../platform/graphics/shader-definition-utils.js';
import { blendNames } from '../../constants.js';
import { ShaderGenerator } from './shader-generator.js';
import { ShaderChunks } from '../shader-chunks.js';

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

    createVertexDefines(options, attributes) {
        const vDefines = new Map(options.defines);

        if (options.mesh) vDefines.set('USE_MESH', '');
        if (options.meshUv) vDefines.set('USE_MESH_UV', '');
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

        // attributes
        attributes.particle_vertexData = SEMANTIC_POSITION;
        if (options.mesh && options.meshUv) {
            attributes.particle_uv = SEMANTIC_TEXCOORD0;
        }

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

        // TODO: considering adding support for material shader chunk overrides
        const shaderLanguage = device.isWebGPU ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL;
        const engineChunks = ShaderChunks.get(device, shaderLanguage);

        const attributes = {};
        const vDefines = this.createVertexDefines(options, attributes);
        const fDefines = this.createFragmentDefines(options);

        const executionDefine = `PARTICLE_${options.useCpu ? 'CPU' : 'GPU'}\n`;
        vDefines.set(executionDefine, '');
        fDefines.set(executionDefine, '');

        const includes = new Map(engineChunks);

        return ShaderDefinitionUtils.createDefinition(device, {
            name: 'ParticleShader',
            shaderLanguage: shaderLanguage,
            attributes: attributes,
            vertexCode: engineChunks.get('particle_shaderVS'),
            fragmentCode: engineChunks.get('particle_shaderPS'),
            fragmentDefines: fDefines,
            fragmentIncludes: includes,
            vertexIncludes: includes,
            vertexDefines: vDefines
        });
    }
}

const particle = new ShaderGeneratorParticle();

export { particle };
