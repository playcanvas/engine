import { hashCode } from "../../core/hash.js";
import { SEMANTIC_ATTR13, SEMANTIC_POSITION } from "../../platform/graphics/constants.js";
import { ShaderUtils } from "../../platform/graphics/shader-utils.js";
import { DITHER_NONE, TONEMAP_LINEAR } from "../constants.js";
import { shaderChunks } from "../shader-lib/chunks/chunks.js";
import { ShaderGenerator } from "../shader-lib/programs/shader-generator.js";
import { ShaderPass } from "../shader-pass.js";

const splatCoreVS = /* glsl */ `
    uniform mat4 matrix_model;
    uniform mat4 matrix_view;
    uniform mat4 matrix_projection;

    uniform vec2 viewport;
    uniform vec4 tex_params;            // num splats, texture width

    uniform highp usampler2D splatOrder;
    uniform highp sampler2D transformA;
    uniform highp sampler2D transformB;
    uniform highp sampler2D transformC;
    uniform sampler2D splatColor;

    attribute vec3 vertex_position;
    attribute uint vertex_id_attrib;

    varying vec2 texCoord;
    varying vec4 color;

    #ifndef DITHER_NONE
        varying float id;
    #endif

    uint orderId;
    uint splatId;
    ivec2 splatUV;

    vec3 center;
    vec3 covA;
    vec3 covB;

    // calculate the current splat index and uv
    bool calcSplatUV() {
        uint numSplats = uint(tex_params.x);
        uint textureWidth = uint(tex_params.y);

        // calculate splat index
        orderId = vertex_id_attrib + uint(vertex_position.z);

        if (orderId > numSplats) {
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

    // read chunk and packed data from textures
    void readData() {
        vec4 tA = texelFetch(transformA, splatUV, 0);
        vec4 tB = texelFetch(transformB, splatUV, 0);
        vec4 tC = texelFetch(transformC, splatUV, 0);

        center = tA.xyz;
        covA = tB.xyz;
        covB = vec3(tA.w, tB.w, tC.x);
    }

    vec4 getColor() {
        return texelFetch(splatColor, splatUV, 0);
    }

    // evaluate the splat position
    bool evalSplat(out vec4 result)
    {
        vec4 centerWorld = matrix_model * vec4(center, 1.0);
        vec4 splat_cam = matrix_view * centerWorld;
        vec4 splat_proj = matrix_projection * splat_cam;

        // cull behind camera
        if (splat_proj.z < -splat_proj.w) {
            return false;
        }

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

        mat3 W = transpose(mat3(matrix_view) * mat3(matrix_model));

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

        // early out tiny splats
        // TODO: figure out length units and expose as uniform parameter
        // TODO: perhaps make this a shader compile-time option
        if (dot(v1, v1) < 4.0 && dot(v2, v2) < 4.0) {
            return false;
        }

        result = splat_proj + vec4((vertex_position.x * v1 + vertex_position.y * v2) / viewport * splat_proj.w, 0, 0);

        return true;
    }
`;

const splatCoreFS = /* glsl */ `
    varying vec2 texCoord;
    varying vec4 color;

    #ifndef DITHER_NONE
        varying float id;
    #endif

    #ifdef PICK_PASS
        uniform vec4 uColor;
    #endif

    vec4 evalSplat() {
        float A = -dot(texCoord, texCoord);
        if (A < -4.0) discard;
        float B = exp(A) * color.a;

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
            shaderPassDefines +
            `#define DITHER_${options.dither.toUpperCase()}\n` +
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
