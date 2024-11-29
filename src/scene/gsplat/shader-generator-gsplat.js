import { hashCode } from '../../core/hash.js';
import { SEMANTIC_ATTR13, SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { ShaderUtils } from '../../platform/graphics/shader-utils.js';
import { GAMMA_NONE, GAMMA_SRGB, TONEMAP_ACES, TONEMAP_ACES2, TONEMAP_FILMIC, TONEMAP_HEJL, TONEMAP_LINEAR, TONEMAP_NEUTRAL, TONEMAP_NONE } from '../constants.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { ShaderGenerator } from '../shader-lib/programs/shader-generator.js';
import { ShaderPass } from '../shader-pass.js';

const tonemapNames = {
    [TONEMAP_FILMIC]: 'FILMIC',
    [TONEMAP_LINEAR]: 'LINEAR',
    [TONEMAP_HEJL]: 'HEJL',
    [TONEMAP_ACES]: 'ACES',
    [TONEMAP_ACES2]: 'ACES2',
    [TONEMAP_NEUTRAL]: 'NEUTRAL',
    [TONEMAP_NONE]: 'NONE'
};

const gammaNames = {
    [GAMMA_NONE]: 'NONE',
    [GAMMA_SRGB]: 'SRGB'
};

class GSplatShaderGenerator {
    generateKey(options) {
        const vsHash = hashCode(options.vertex);
        const fsHash = hashCode(options.fragment);
        const definesHash = ShaderGenerator.definesHash(options.defines);
        return `splat-${options.pass}-${options.gamma}-${options.toneMapping}-${vsHash}-${fsHash}-${options.dither}-${definesHash}`;
    }

    createShaderDefinition(device, options) {
        const shaderPassInfo = ShaderPass.get(device).getByIndex(options.pass);
        const shaderPassDefines = shaderPassInfo.shaderDefines;

        const defineMap = new Map();

        // define tonemap
        defineMap.set('TONEMAP', tonemapNames[options.toneMapping] ?? true);

        // define gamma
        defineMap.set('GAMMA', gammaNames[options.gamma] ?? true);

        defineMap.set(`DITHER_${options.dither.toUpperCase()}`, true);

        // add user defines
        options.defines.forEach((value, key) => {
            defineMap.set(key, value);
        });

        const defines = `${shaderPassDefines}\n`;
        const vs = defines + (options.vertex ?? shaderChunks.gsplatMainVS);
        const fs = defines + (options.fragment ?? shaderChunks.gsplatMainPS);
        const includes = new Map(Object.entries(shaderChunks));

        return ShaderUtils.createDefinition(device, {
            name: 'SplatShader',
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                vertex_id_attrib: SEMANTIC_ATTR13
            },
            vertexCode: vs,
            vertexDefines: defineMap,
            vertexIncludes: includes,
            fragmentCode: fs,
            fragmentDefines: defineMap,
            fragmentIncludes: includes
        });
    }
}

const gsplat = new GSplatShaderGenerator();

export { gsplat };
