import { hashCode } from '../../core/hash.js';
import { SEMANTIC_ATTR13, SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { ShaderUtils } from '../../platform/graphics/shader-utils.js';
import { DITHER_NONE, TONEMAP_LINEAR } from '../constants.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { ShaderGenerator } from '../shader-lib/programs/shader-generator.js';
import { ShaderPass } from '../shader-pass.js';

const splatCoreVS = /* glsl */ `
    uniform mat4 matrix_model;
    uniform mat4 matrix_view;
    uniform mat4 matrix_projection;

    uniform vec2 viewport;
    uniform vec4 tex_params;            // num splats, texture width

    uniform highp usampler2D splatOrder;
    uniform highp usampler2D transformA;
    uniform highp sampler2D transformB;

    attribute vec3 vertex_position;
    attribute uint vertex_id_attrib;

    #ifndef DITHER_NONE
        varying float id;
    #endif

    uint orderId;
    uint splatId;
    ivec2 splatUV;

    // calculate the current splat index and uv
    bool calcSplatUV() {
        uint numSplats = uint(tex_params.x);
        uint textureWidth = uint(tex_params.y);

        // calculate splat index
        orderId = vertex_id_attrib + uint(vertex_position.z);

        if (orderId >= numSplats) {
            return false;
        }

        ivec2 orderUV = ivec2(
            int(orderId % textureWidth),
            int(orderId / textureWidth)
        );

        // calculate splatUV
        splatId = texelFetch(splatOrder, orderUV, 0).r;
        splatUV = ivec2(
            int(splatId % textureWidth),
            int(splatId / textureWidth)
        );

        return true;
    }

    uvec4 tA;

    vec3 getCenter() {
        tA = texelFetch(transformA, splatUV, 0);
        return uintBitsToFloat(tA.xyz);
    }

    void getCovariance(out vec3 covA, out vec3 covB) {
        vec4 tB = texelFetch(transformB, splatUV, 0);
        vec2 tC = unpackHalf2x16(tA.w);

        covA = tB.xyz;
        covB = vec3(tC.x, tC.y, tB.w);
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


    // Spherical Harmonics

    vec3 unpack111011(uint bits) {
        return vec3(
            float(bits >> 21u) / 2047.0,
            float((bits >> 11u) & 0x3ffu) / 1023.0,
            float(bits & 0x7ffu) / 2047.0
        );
    }

    // fetch quantized spherical harmonic coefficients
    void fetchScale(in uvec4 t, out float scale, out vec3 a, out vec3 b, out vec3 c) {
        scale = uintBitsToFloat(t.x);
        a = unpack111011(t.y) * 2.0 - 1.0;
        b = unpack111011(t.z) * 2.0 - 1.0;
        c = unpack111011(t.w) * 2.0 - 1.0;
    }

    // fetch quantized spherical harmonic coefficients
    void fetch(in uvec4 t, out vec3 a, out vec3 b, out vec3 c, out vec3 d) {
        a = unpack111011(t.x) * 2.0 - 1.0;
        b = unpack111011(t.y) * 2.0 - 1.0;
        c = unpack111011(t.z) * 2.0 - 1.0;
        d = unpack111011(t.w) * 2.0 - 1.0;
    }

    #if defined(USE_SH1)
        #define SH_C1 0.4886025119029199f

        uniform highp usampler2D splatSH_1to3;
    #if defined(USE_SH2)
        #define SH_C2_0 1.0925484305920792f
        #define SH_C2_1 -1.0925484305920792f
        #define SH_C2_2 0.31539156525252005f
        #define SH_C2_3 -1.0925484305920792f
        #define SH_C2_4 0.5462742152960396f

        uniform highp usampler2D splatSH_4to7;
        uniform highp usampler2D splatSH_8to11;
    #if defined(USE_SH3)
        #define SH_C3_0 -0.5900435899266435f
        #define SH_C3_1 2.890611442640554f
        #define SH_C3_2 -0.4570457994644658f
        #define SH_C3_3 0.3731763325901154f
        #define SH_C3_4 -0.4570457994644658f
        #define SH_C3_5 1.445305721320277f
        #define SH_C3_6 -0.5900435899266435f

        uniform highp usampler2D splatSH_12to15;
    #endif
    #endif
    #endif

    vec3 evalSH(in vec3 dir) {
        vec3 result = vec3(0.0);

        // see https://github.com/graphdeco-inria/gaussian-splatting/blob/main/utils/sh_utils.py
    #if defined(USE_SH1)
        // 1st degree
        float x = dir.x;
        float y = dir.y;
        float z = dir.z;

        float scale;
        vec3 sh1, sh2, sh3;
        fetchScale(texelFetch(splatSH_1to3, splatUV, 0), scale, sh1, sh2, sh3);
        result += SH_C1 * (-sh1 * y + sh2 * z - sh3 * x);

    #if defined(USE_SH2)
        // 2nd degree
        float xx = x * x;
        float yy = y * y;
        float zz = z * z;
        float xy = x * y;
        float yz = y * z;
        float xz = x * z;

        vec3 sh4, sh5, sh6, sh7;
        vec3 sh8, sh9, sh10, sh11;
        fetch(texelFetch(splatSH_4to7, splatUV, 0), sh4, sh5, sh6, sh7);
        fetch(texelFetch(splatSH_8to11, splatUV, 0), sh8, sh9, sh10, sh11);
        result +=
            sh4 * (SH_C2_0 * xy) *  +
            sh5 * (SH_C2_1 * yz) +
            sh6 * (SH_C2_2 * (2.0 * zz - xx - yy)) +
            sh7 * (SH_C2_3 * xz) +
            sh8 * (SH_C2_4 * (xx - yy));

    #if defined(USE_SH3)
        // 3rd degree
        vec3 sh12, sh13, sh14, sh15;
        fetch(texelFetch(splatSH_12to15, splatUV, 0), sh12, sh13, sh14, sh15);
        result +=
            sh9  * (SH_C3_0 * y * (3.0 * xx - yy)) +
            sh10 * (SH_C3_1 * xy * z) +
            sh11 * (SH_C3_2 * y * (4.0 * zz - xx - yy)) +
            sh12 * (SH_C3_3 * z * (2.0 * zz - 3.0 * xx - 3.0 * yy)) +
            sh13 * (SH_C3_4 * x * (4.0 * zz - xx - yy)) +
            sh14 * (SH_C3_5 * z * (xx - yy)) +
            sh15 * (SH_C3_6 * x * (xx - 3.0 * yy));
    #endif
    #endif
        result *= scale;
    #endif

        return result;
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

        const defines =
            `${shaderPassDefines}\n` +
            `#define DITHER_${options.dither.toUpperCase()}\n` +
            `#define TONEMAP_${options.toneMapping === TONEMAP_LINEAR ? 'DISABLED' : 'ENABLED'}\n`;

        const vs = defines + splatCoreVS + options.vertex;
        const fs = defines + shaderChunks.decodePS +
            (options.dither === DITHER_NONE ? '' : shaderChunks.bayerPS + shaderChunks.opacityDitherPS) +
            ShaderGenerator.tonemapCode(options.toneMapping) +
            ShaderGenerator.gammaCode(options.gamma) +
            splatCoreFS + options.fragment;

        const defineMap = new Map();
        options.defines.forEach((value, key) => {
            defineMap.set(key, value);
        });

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

const gsplat = new GSplatShaderGenerator();

export { gsplat };
