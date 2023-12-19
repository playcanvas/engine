import {
    BLEND_NORMAL, BLEND_NONE,
    ShaderProcessorOptions,
    getProgramLibrary,
    CULLFACE_BACK,
    CULLFACE_NONE,
    Material,
    SHADER_FORWARDHDR,
    TONEMAP_LINEAR,
    GAMMA_SRGBHDR,
    GAMMA_NONE
} from "playcanvas";
import { splat } from "./shader-generator-splat.js";

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
 * @property {boolean} [dither] - True if opacity dithering should be used instead of opacity.
 */

/**
 * @param {import('playcanvas').GraphicsDevice} device - The graphics device to use
 * for the material creation.
 * @param {SplatMaterialOptions} [options] - The options.
 * @returns {Material} The GS material.
 */
const createSplatMaterial = (options = {}) => {

    const { debugRender, dither } = options;

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
            dither: !!dither
        };

        const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat);

        const library = getProgramLibrary(device);
        library.register('splat', splat);
        return library.getProgram('splat', programOptions, processingOptions);
    };

    material.update();

    return material;
};

export { createSplatMaterial };
