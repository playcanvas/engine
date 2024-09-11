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
            J1, 0., J2.x, 
            0., J1, J2.y, 
            0., 0., 0.
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
    varying mediump vec2 texCoord;
    varying mediump vec4 color;

    #ifndef DITHER_NONE
        varying float id;
    #endif

    #ifdef PICK_PASS
        uniform vec4 uColor;
    #endif

    vec4 evalSplat() {
        mediump float A = dot(texCoord, texCoord);
        if (A > 1.0) {
            discard;
        }

        mediump float B = exp(-A * 4.0) * color.a;
        if (B < 1.0 / 255.0) {
            discard;
        }

        #ifdef PICK_PASS
            if (B < 0.3) discard;
            return(uColor);
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
        return `splat-${options.pass}-${options.gamma}-${options.toneMapping}-${vsHash}-${fsHash}-${options.dither}}`;
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

        return ShaderUtils.createDefinition(device, {
            name: 'SplatShader',
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                vertex_id_attrib: SEMANTIC_ATTR13
            },
            vertexCode: vs,
            fragmentCode: fs
        });
    }
}

const gsplat = new GSplatShaderGenerator();

export { gsplat };
