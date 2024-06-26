import { CULLFACE_NONE } from "../../platform/graphics/constants.js";
import { ShaderProcessorOptions } from "../../platform/graphics/shader-processor-options.js";
import { BLEND_NONE, BLEND_NORMAL, DITHER_NONE } from "../constants.js";
import { Material } from "../materials/material.js";
import { getProgramLibrary } from "../shader-lib/get-program-library.js";
import { gsplat } from "./shader-generator-gsplat.js";

const splatMainVS = `
    vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);

    void main(void)
    {
        // calculate splat uv
        if (!calcSplatUV()) {
            gl_Position = discardVec;
            return;
        }

        // read data
        readData();

        vec4 pos;
        if (!evalSplat(pos)) {
            gl_Position = discardVec;
            return;
        }

        gl_Position = pos;

        texCoord = vertex_position.xy;
        color = getColor();

        #ifndef DITHER_NONE
            id = float(splatId);
        #endif
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
 * @property {string} [vertex] - Custom vertex shader, see SPLAT MANY example.
 * @property {string} [fragment] - Custom fragment shader, see SPLAT MANY example.
 * @property {string} [dither] - Opacity dithering enum.
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

    const material = new Material();
    material.name = 'splatMaterial';
    material.cull = CULLFACE_NONE;
    material.blendType = dither ? BLEND_NONE : BLEND_NORMAL;
    material.depthWrite = dither;

    material.getShaderVariant = function (device, scene, defs, renderParams, pass, sortedLights, viewUniformFormat, viewBindGroupFormat) {

        const programOptions = {
            pass: pass,
            gamma: renderParams.gammaCorrection,
            toneMapping: renderParams.toneMapping,
            vertex: options.vertex ?? splatMainVS,
            fragment: options.fragment ?? splatMainFS,
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
