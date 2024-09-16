import { CULLFACE_NONE } from '../../platform/graphics/constants.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { BLEND_NONE, BLEND_NORMAL, DITHER_NONE } from '../constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { gsplat } from './shader-generator-gsplat.js';

const splatMainVS = /* glsl */ `
    uniform vec3 view_position;

    uniform sampler2D splatColor;

    varying mediump vec2 texCoord;
    varying mediump vec4 color;

    mediump vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);

    void main(void)
    {
        // calculate splat uv
        if (!calcSplatUV()) {
            gl_Position = discardVec;
            return;
        }

        // get center
        vec3 center = getCenter();

        // handle transforms
        mat4 model_view = matrix_view * matrix_model;
        vec4 splat_cam = model_view * vec4(center, 1.0);
        vec4 splat_proj = matrix_projection * splat_cam;

        // cull behind camera
        if (splat_proj.z < -splat_proj.w) {
            gl_Position = discardVec;
            return;
        }

        // get covariance
        vec3 covA, covB;
        getCovariance(covA, covB);

        vec4 v1v2 = calcV1V2(splat_cam.xyz, covA, covB, transpose(mat3(model_view)));

        // get color
        color = texelFetch(splatColor, splatUV, 0);

        // calculate scale based on alpha
        float scale = min(1.0, sqrt(-log(1.0 / 255.0 / color.a)) / 2.0);

        v1v2 *= scale;

        // early out tiny splats
        if (dot(v1v2.xy, v1v2.xy) < 4.0 && dot(v1v2.zw, v1v2.zw) < 4.0) {
            gl_Position = discardVec;
            return;
        }

        gl_Position = splat_proj + vec4((vertex_position.x * v1v2.xy + vertex_position.y * v1v2.zw) / viewport * splat_proj.w, 0, 0);

        texCoord = vertex_position.xy * scale / 2.0;

        #ifdef USE_SH1
            vec4 worldCenter = matrix_model * vec4(center, 1.0);
            vec3 viewDir = normalize((worldCenter.xyz / worldCenter.w - view_position) * mat3(matrix_model));
            color.xyz = max(color.xyz + evalSH(viewDir), 0.0);
        #endif

        #ifndef DITHER_NONE
            id = float(splatId);
        #endif
    }
`;

const splatMainFS = /* glsl */ `
    varying mediump vec2 texCoord;
    varying mediump vec4 color;

    void main(void)
    {
        gl_FragColor = evalSplat(texCoord, color);
    }
`;

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

        const programOptions = {
            defines: material.defines,
            pass: params.pass,
            gamma: params.renderParams.shaderOutputGamma,
            toneMapping: params.renderParams.toneMapping,
            vertex: options.vertex ?? splatMainVS,
            fragment: options.fragment ?? splatMainFS,
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
