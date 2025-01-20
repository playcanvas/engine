import { CULLFACE_NONE, SEMANTIC_ATTR13, SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { BLEND_NONE, BLEND_NORMAL, DITHER_NONE } from '../constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { getCoreDefines } from '../shader-lib/utils.js';
import { ShaderUtils } from '../../platform/graphics/shader-utils.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { ShaderGenerator } from '../shader-lib/programs/shader-generator.js';
import { hashCode } from '../../core/hash.js';

const defaultChunks = new Map(Object.entries(shaderChunks));

class GSplatShaderGenerator {
    generateKey(options) {
        const { vertex, fragment, dither, defines, chunks } = options;
        return `splat-${hashCode(vertex)}-${hashCode(fragment)}-${dither}-${ShaderGenerator.definesHash(defines)}-${chunks && Object.keys(chunks).sort().join(':')}`;
    }

    createShaderDefinition(device, options) {

        const defineMap = new Map(options.defines);

        // it would nice if DITHER type was defined like the others
        defineMap.set(`DITHER_${options.dither.toUpperCase()}`, true);

        const vs = options.vertex ?? shaderChunks.gsplatVS;
        const fs = options.fragment ?? shaderChunks.gsplatPS;
        const includes = options.chunks ? new Map(Object.entries({
            ...shaderChunks,
            ...options.chunks
        })) : defaultChunks;

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

/**
 * @typedef {object} SplatMaterialOptions - The options.
 * @property {string} [vertex] - Custom vertex shader, see SPLAT MANY example.
 * @property {string} [fragment] - Custom fragment shader, see SPLAT MANY example.
 * @property {string[]} [defines] - List of shader defines.
 * @property {Object<string, string>} [chunks] - Custom shader chunks.
 * @property {string} [dither] - Opacity dithering enum.
 *
 * @ignore
 */

/**
 * @param {SplatMaterialOptions} [options] - The options.
 * @returns {ShaderMaterial} The GS material.
 */
const createGSplatMaterial = (options = {}) => {

    const ditherEnum = options.dither ?? DITHER_NONE;
    const dither = ditherEnum !== DITHER_NONE;

    const material = new ShaderMaterial();
    material.name = 'splatMaterial';
    material.cull = CULLFACE_NONE;
    material.blendType = dither ? BLEND_NONE : BLEND_NORMAL;
    material.depthWrite = dither;

    material.getShaderVariant = function (params) {

        const { cameraShaderParams } = params;
        const programOptions = {
            defines: getCoreDefines(material, params),
            pass: params.pass,
            gamma: cameraShaderParams.shaderOutputGamma,
            toneMapping: cameraShaderParams.toneMapping,
            vertex: options.vertex,
            fragment: options.fragment,
            chunks: options.chunks,
            dither: ditherEnum
        };

        const processingOptions = new ShaderProcessorOptions(params.viewUniformFormat, params.viewBindGroupFormat);

        const library = getProgramLibrary(params.device);
        library.register('splat', gsplat);
        return library.getProgram('splat', programOptions, processingOptions);
    };

    material.update();

    return material;
};

export { createGSplatMaterial };
