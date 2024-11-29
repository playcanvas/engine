import { CULLFACE_NONE } from '../../platform/graphics/constants.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { BLEND_NONE, BLEND_NORMAL, DITHER_NONE } from '../constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { getMaterialShaderDefines } from '../shader-lib/utils.js';
import { gsplat } from './shader-generator-gsplat.js';

/**
 * @typedef {object} SplatMaterialOptions - The options.
 * @property {string} [vertex] - Custom vertex shader, see SPLAT MANY example.
 * @property {string} [fragment] - Custom fragment shader, see SPLAT MANY example.
 * @property {string} [dither] - Opacity dithering enum.
 * @property {string[]} [defines] - List of shader defines.
 *
 * @ignore
 */

/**
 * @param {SplatMaterialOptions} [options] - The options.
 * @returns {Material} The GS material.
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
            defines: getMaterialShaderDefines(material, cameraShaderParams),
            pass: params.pass,
            gamma: cameraShaderParams.shaderOutputGamma,
            toneMapping: cameraShaderParams.toneMapping,
            vertex: options.vertex,
            fragment: options.fragment,
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
