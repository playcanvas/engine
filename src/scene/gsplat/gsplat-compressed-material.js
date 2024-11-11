import { CULLFACE_NONE, SEMANTIC_ATTR13, SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { BLEND_NONE, BLEND_NORMAL, DITHER_NONE, TONEMAP_LINEAR } from '../constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';

import { hashCode } from '../../core/hash.js';
import { ShaderUtils } from '../../platform/graphics/shader-utils.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { ShaderGenerator } from '../shader-lib/programs/shader-generator.js';
import { ShaderPass } from '../shader-pass.js';

const splatCoreVS = /* glsl */ `
    uniform mat4 matrix_model;
    uniform mat4 matrix_view;
    uniform mat4 matrix_projection;

    uniform vec2 viewport;
    uniform vec4 tex_params;                  // num splats, packed width, chunked width

    uniform highp usampler2D splatOrder;
    uniform highp usampler2D packedTexture;
    uniform highp sampler2D chunkTexture;

    attribute vec3 vertex_position;
    attribute uint vertex_id_attrib;

    #ifndef DITHER_NONE
        varying float id;
    #endif

    uint orderId;
    uint splatId;
    ivec2 packedUV;
    ivec2 chunkUV;

    vec4 chunkDataA;    // x: min_x, y: min_y, z: min_z, w: max_x
    vec4 chunkDataB;    // x: max_y, y: max_z, z: scale_min_x, w: scale_min_y
    vec4 chunkDataC;    // x: scale_min_z, y: scale_max_x, z: scale_max_y, w: scale_max_z
    uvec4 packedData;   // x: position bits, y: rotation bits, z: scale bits, w: color bits

    // calculate the current splat index and uvs
    bool calcSplatUV() {
        uint numSplats = uint(tex_params.x);
        uint packedWidth = uint(tex_params.y);
        uint chunkWidth = uint(tex_params.z);

        // calculate splat index
        orderId = vertex_id_attrib + uint(vertex_position.z);

        // checkout for out of bounds
        if (orderId >= numSplats) {
            return false;
        }

        // calculate packedUV
        ivec2 orderUV = ivec2(
            int(orderId % packedWidth),
            int(orderId / packedWidth)
        );
        splatId = texelFetch(splatOrder, orderUV, 0).r;
        packedUV = ivec2(
            int(splatId % packedWidth),
            int(splatId / packedWidth)
        );

        // calculate chunkUV
        uint chunkId = splatId / 256u;
        chunkUV = ivec2(
            int((chunkId % chunkWidth) * 3u),
            int(chunkId / chunkWidth)
        );

        return true;
    }

    // read chunk and packed data from textures
    void readData() {
        chunkDataA = texelFetch(chunkTexture, chunkUV, 0);
        chunkDataB = texelFetch(chunkTexture, ivec2(chunkUV.x + 1, chunkUV.y), 0);
        chunkDataC = texelFetch(chunkTexture, ivec2(chunkUV.x + 2, chunkUV.y), 0);
        packedData = texelFetch(packedTexture, packedUV, 0);
    }

    vec3 unpack111011(uint bits) {
        return vec3(
            float(bits >> 21u) / 2047.0,
            float((bits >> 11u) & 0x3ffu) / 1023.0,
            float(bits & 0x7ffu) / 2047.0
        );
    }

    vec4 unpack8888(uint bits) {
        return vec4(
            float(bits >> 24u) / 255.0,
            float((bits >> 16u) & 0xffu) / 255.0,
            float((bits >> 8u) & 0xffu) / 255.0,
            float(bits & 0xffu) / 255.0
        );
    }

    float norm = 1.0 / (sqrt(2.0) * 0.5);

    vec4 unpackRotation(uint bits) {
        float a = (float((bits >> 20u) & 0x3ffu) / 1023.0 - 0.5) * norm;
        float b = (float((bits >> 10u) & 0x3ffu) / 1023.0 - 0.5) * norm;
        float c = (float(bits & 0x3ffu) / 1023.0 - 0.5) * norm;
        float m = sqrt(1.0 - (a * a + b * b + c * c));

        uint mode = bits >> 30u;
        if (mode == 0u) return vec4(m, a, b, c);
        if (mode == 1u) return vec4(a, m, b, c);
        if (mode == 2u) return vec4(a, b, m, c);
        return vec4(a, b, c, m);
    }

    vec3 getCenter() {
        return mix(chunkDataA.xyz, vec3(chunkDataA.w, chunkDataB.xy), unpack111011(packedData.x));
    }

    vec4 getRotation() {
        return unpackRotation(packedData.y);
    }

    vec3 getScale() {
        return exp(mix(vec3(chunkDataB.zw, chunkDataC.x), chunkDataC.yzw, unpack111011(packedData.z)));
    }

    vec4 getColor() {
        return unpack8888(packedData.w);
    }

    mat3 quatToMat3(vec4 R) {
        float x = R.x;
        float y = R.y;
        float z = R.z;
        float w = R.w;
        return mat3(
            1.0 - 2.0 * (z * z + w * w),
                  2.0 * (y * z + x * w),
                  2.0 * (y * w - x * z),
                  2.0 * (y * z - x * w),
            1.0 - 2.0 * (y * y + w * w),
                  2.0 * (z * w + x * y),
                  2.0 * (y * w + x * z),
                  2.0 * (z * w - x * y),
            1.0 - 2.0 * (y * y + z * z)
        );
    }

    // Given a rotation matrix and scale vector, compute 3d covariance A and B
    void getCovariance(out vec3 covA, out vec3 covB) {
        mat3 rot = quatToMat3(getRotation());
        vec3 scale = getScale();

        // M = S * R
        mat3 M = transpose(mat3(
            scale.x * rot[0],
            scale.y * rot[1],
            scale.z * rot[2]
        ));

        covA = vec3(dot(M[0], M[0]), dot(M[0], M[1]), dot(M[0], M[2]));
        covB = vec3(dot(M[1], M[1]), dot(M[1], M[2]), dot(M[2], M[2]));
    }

    // calculate 2d covariance vectors
    vec4 calcV1V2(in vec3 splat_cam, in vec3 covA, in vec3 covB, mat3 W) {
        mat3 Vrk = mat3(
            covA.x, covA.y, covA.z, 
            covA.y, covB.x, covB.y,
            covA.z, covB.y, covB.z
        );

        float focal = viewport.x * matrix_projection[0][0];

        float J1 = focal / splat_cam.z;
        vec2 J2 = -J1 / splat_cam.z * splat_cam.xy;
        mat3 J = mat3(
            J1, 0.0, J2.x, 
            0.0, J1, J2.y, 
            0.0, 0.0, 0.0
        );

        mat3 T = W * J;
        mat3 cov = transpose(T) * Vrk * T;

        float diagonal1 = cov[0][0] + 0.3;
        float offDiagonal = cov[0][1];
        float diagonal2 = cov[1][1] + 0.3;

        float mid = 0.5 * (diagonal1 + diagonal2);
        float radius = length(vec2((diagonal1 - diagonal2) / 2.0, offDiagonal));
        float lambda1 = mid + radius;
        float lambda2 = max(mid - radius, 0.1);
        vec2 diagonalVector = normalize(vec2(offDiagonal, lambda1 - diagonal1));

        vec2 v1 = min(sqrt(2.0 * lambda1), 1024.0) * diagonalVector;
        vec2 v2 = min(sqrt(2.0 * lambda2), 1024.0) * vec2(diagonalVector.y, -diagonalVector.x);

        return vec4(v1, v2);
    }
`;

const splatCoreFS = /* glsl */ `
    #ifndef DITHER_NONE
        varying float id;
    #endif

    #ifdef PICK_PASS
        uniform vec4 uColor;
    #endif

    vec4 evalSplat(vec2 texCoord, vec4 color) {
        mediump float A = dot(texCoord, texCoord);
        if (A > 1.0) {
            discard;
        }

        mediump float B = exp(-A * 4.0) * color.a;
        if (B < 1.0 / 255.0) {
            discard;
        }

        #ifdef PICK_PASS
            if (B < 0.3) {
                discard;
            }
            return uColor;
        #endif

        #ifndef DITHER_NONE
            opacityDither(B, id * 0.013);
        #endif

        #ifdef TONEMAP_ENABLED
            return vec4(gammaCorrectOutput(toneMap(decodeGamma(color.rgb))), B);
        #else
            return vec4(color.rgb, B);
        #endif
    }
`;

class GSplatCompressedShaderGenerator {
    generateKey(options) {
        const vsHash = hashCode(options.vertex);
        const fsHash = hashCode(options.fragment);
        const definesHash = ShaderGenerator.definesHash(options.defines);
        return `splat-${options.pass}-${options.gamma}-${options.toneMapping}-${vsHash}-${fsHash}-${options.dither}-${definesHash}}`;
    }

    createShaderDefinition(device, options) {

        const shaderPassInfo = ShaderPass.get(device).getByIndex(options.pass);
        const shaderPassDefines = shaderPassInfo.shaderDefines;

        const defines =
            `${shaderPassDefines
            }#define DITHER_${options.dither.toUpperCase()}\n` +
            `#define TONEMAP_${options.toneMapping === TONEMAP_LINEAR ? 'DISABLED' : 'ENABLED'}\n`;

        const vs = defines + splatCoreVS + options.vertex;
        const fs = defines + shaderChunks.decodePS +
            (options.dither === DITHER_NONE ? '' : shaderChunks.bayerPS + shaderChunks.opacityDitherPS) +
            ShaderGenerator.tonemapCode(options.toneMapping) +
            ShaderGenerator.gammaCode(options.gamma) +
            splatCoreFS + options.fragment;

        const defineMap = new Map();
        options.defines.forEach(value => defineMap.set(value, true));

        return ShaderUtils.createDefinition(device, {
            name: 'SplatShader',
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                vertex_id_attrib: SEMANTIC_ATTR13
            },
            vertexCode: vs,
            fragmentCode: fs,
            fragmentDefines: defineMap,
            vertexDefines: defineMap
        });
    }
}

const gsplatCompressed = new GSplatCompressedShaderGenerator();

const splatMainVS = /* glsl */ `
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

        // read chunk data and packed data
        readData();

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
        color = getColor();

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
 */

/**
 * @param {SplatMaterialOptions} [options] - The options.
 * @returns {Material} The GS material.
 */
const createGSplatCompressedMaterial = (options = {}) => {

    const ditherEnum = options.dither ?? DITHER_NONE;
    const dither = ditherEnum !== DITHER_NONE;

    const material = new ShaderMaterial();
    material.name = 'compressedSplatMaterial';
    material.cull = CULLFACE_NONE;
    material.blendType = dither ? BLEND_NONE : BLEND_NORMAL;
    material.depthWrite = dither;

    material.getShaderVariant = function (params) {

        const programOptions = {
            defines: material.defines,
            pass: params.pass,
            gamma: params.cameraShaderParams.shaderOutputGamma,
            toneMapping: params.cameraShaderParams.toneMapping,
            vertex: options.vertex ?? splatMainVS,
            fragment: options.fragment ?? splatMainFS,
            dither: ditherEnum
        };

        const processingOptions = new ShaderProcessorOptions(params.viewUniformFormat, params.viewBindGroupFormat);

        const library = getProgramLibrary(params.device);
        library.register('splat-compressed', gsplatCompressed);
        return library.getProgram('splat-compressed', programOptions, processingOptions);
    };

    material.update();

    return material;
};

export { createGSplatCompressedMaterial };
