import { CULLFACE_BACK, CULLFACE_NONE } from "../../platform/graphics/constants.js";
import { ShaderProcessorOptions } from "../../platform/graphics/shader-processor-options.js";
import { BLEND_NONE, BLEND_NORMAL, DITHER_NONE, GAMMA_NONE, GAMMA_SRGBHDR, SHADER_FORWARDHDR, TONEMAP_LINEAR } from "../constants.js";
import { Material } from "../materials/material.js";
import { getProgramLibrary } from "../shader-lib/get-program-library.js";
import { gsplat } from "./shader-generator-gsplat.js";

const splatMainVS = `
    void main(void)
    {
        vec3 centerLocal = evalCenter();
        vec4 centerWorld = matrix_model * vec4(centerLocal, 1.0);

        gl_Position = evalSplat(centerWorld);
    }
`;

const splatMainFS = `
    void main(void)
    {
        gl_FragColor = evalSplat();
    }
`;

/**
 * @typedef {object} SplatMaterialOptions - The options.
 * @property {boolean} [debugRender] - Adds #define DEBUG_RENDER for shader.
 * @property {string} [vertex] - Custom vertex shader, see SPLAT MANY example.
 * @property {string} [fragment] - Custom fragment shader, see SPLAT MANY example.
 * @property {string} [dither] - Opacity dithering enum.
 */

/**
 * @param {SplatMaterialOptions} [options] - The options.
 * @returns {Material} The GS material.
 */
const createGSplatMaterial = (options = {}) => {

    const { debugRender } = options;

    const ditherEnum = options.dither ?? DITHER_NONE;
    const dither = ditherEnum !== DITHER_NONE;

    const material = new Material();
    material.name = 'splatMaterial';
    material.cull = debugRender ? CULLFACE_BACK : CULLFACE_NONE;
    material.blendType = dither ? BLEND_NONE : BLEND_NORMAL;
    material.depthWrite = dither;

    material.getShaderVariant = function (device, scene, defs, unused, pass, sortedLights, viewUniformFormat, viewBindGroupFormat) {

        const programOptions = {
            pass: pass,
            gamma: (pass === SHADER_FORWARDHDR ? (scene.gammaCorrection ? GAMMA_SRGBHDR : GAMMA_NONE) : scene.gammaCorrection),
            toneMapping: (pass === SHADER_FORWARDHDR ? TONEMAP_LINEAR : scene.toneMapping),
            vertex: options.vertex ?? splatMainVS,
            fragment: options.fragment ?? splatMainFS,
            debugRender: debugRender,
            dither: ditherEnum
        };

        const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat);

        const library = getProgramLibrary(device);
        library.register('splat', gsplat);
        return library.getProgram('splat', programOptions, processingOptions);
    };

    material.update();

    return material;
};

export { createGSplatMaterial };
