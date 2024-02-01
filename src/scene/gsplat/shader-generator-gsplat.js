import { hashCode } from "../../core/hash.js";
import { SEMANTIC_ATTR13, SEMANTIC_POSITION } from "../../platform/graphics/constants.js";
import { ShaderUtils } from "../../platform/graphics/shader-utils.js";
import { DITHER_NONE } from "../constants.js";
import { shaderChunks } from "../shader-lib/chunks/chunks.js";
import { ShaderGenerator } from "../shader-lib/programs/shader-generator.js";
import { ShaderPass } from "../shader-pass.js";

const splatCoreVS = `
    attribute vec3 vertex_position;

    uniform mat4 matrix_model;
    uniform mat4 matrix_view;
    uniform mat4 matrix_projection;
    uniform mat4 matrix_viewProjection;

    uniform vec2 viewport;

    varying vec2 texCoord;
    varying vec4 color;
    varying float id;

    mat3 quatToMat3(vec3 R)
    {
        float x = R.x;
        float y = R.y;
        float z = R.z;
        float w = sqrt(1.0 - dot(R, R));

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

    uniform vec4 tex_params;
    uniform sampler2D splatColor;
    uniform highp sampler2D splatScale;
    uniform highp sampler2D splatRotation;
    uniform highp sampler2D splatCenter;

    #ifdef INT_INDICES

        attribute uint vertex_id;
        ivec2 dataUV;
        void evalDataUV() {

            // turn vertex_id into int grid coordinates
            ivec2 textureSize = ivec2(tex_params.xy);
            vec2 invTextureSize = tex_params.zw;

            int gridV = int(float(vertex_id) * invTextureSize.x);
            int gridU = int(vertex_id) - gridV * textureSize.x;
            dataUV = ivec2(gridU, gridV);
        }

        vec4 getColor() {
            return texelFetch(splatColor, dataUV, 0);
        }

        vec3 getScale() {
            return texelFetch(splatScale, dataUV, 0).xyz;
        }

        vec3 getRotation() {
            return texelFetch(splatRotation, dataUV, 0).xyz;
        }

        vec3 getCenter() {
            return texelFetch(splatCenter, dataUV, 0).xyz;
        }

    #else

        // TODO: use texture2DLodEXT on WebGL

        attribute float vertex_id;
        vec2 dataUV;
        void evalDataUV() {
            vec2 textureSize = tex_params.xy;
            vec2 invTextureSize = tex_params.zw;

            // turn vertex_id into int grid coordinates
            float gridV = floor(vertex_id * invTextureSize.x);
            float gridU = vertex_id - (gridV * textureSize.x);

            // convert grid coordinates to uv coordinates with half pixel offset
            dataUV = vec2(gridU, gridV) * invTextureSize + (0.5 * invTextureSize);
        }

        vec4 getColor() {
            return texture2D(splatColor, dataUV);
        }

        vec3 getScale() {
            return texture2D(splatScale, dataUV).xyz;
        }

        vec3 getRotation() {
            return texture2D(splatRotation, dataUV).xyz;
        }

        vec3 getCenter() {
            return texture2D(splatCenter, dataUV).xyz;
        }

    #endif

    void computeCov3d(in mat3 rot, in vec3 scale, out vec3 covA, out vec3 covB)
    {
        // M = S * R
        float M0 = scale.x * rot[0][0];
        float M1 = scale.x * rot[0][1];
        float M2 = scale.x * rot[0][2];
        float M3 = scale.y * rot[1][0];
        float M4 = scale.y * rot[1][1];
        float M5 = scale.y * rot[1][2];
        float M6 = scale.z * rot[2][0];
        float M7 = scale.z * rot[2][1];
        float M8 = scale.z * rot[2][2];

        covA = vec3(
            M0 * M0 + M3 * M3 + M6 * M6,
            M0 * M1 + M3 * M4 + M6 * M7,
            M0 * M2 + M3 * M5 + M6 * M8
        );

        covB = vec3(
            M1 * M1 + M4 * M4 + M7 * M7,
            M1 * M2 + M4 * M5 + M7 * M8,
            M2 * M2 + M5 * M5 + M8 * M8
        );
    }

    vec3 evalCenter() {
        evalDataUV();
        return getCenter();
    }

    #ifndef GL2
    #ifndef WEBGPU
    mat3 transpose(in mat3 m) {
        return mat3(
            m[0].x, m[1].x, m[2].x,
            m[0].y, m[1].y, m[2].y,
            m[0].z, m[1].z, m[2].z
        );
    }
    #endif
    #endif

    vec4 evalSplat(vec4 centerWorld)
    {
        vec4 splat_cam = matrix_view * centerWorld;
        vec4 splat_proj = matrix_projection * splat_cam;

        // cull behind camera
        if (splat_proj.z < -splat_proj.w) {
            return vec4(0.0, 0.0, 2.0, 1.0);
        }

        vec3 scale = getScale();
        vec3 rotation = getRotation();

        color = getColor();

        #ifdef DEBUG_RENDER
            vec3 local = quatToMat3(rotation) * (vertex_position * scale * 2.0) + center;
            return matrix_viewProjection * matrix_model * vec4(local, 1.0);
        #else
            vec3 splat_cova;
            vec3 splat_covb;
            computeCov3d(mat3(matrix_model) * quatToMat3(rotation), scale, splat_cova, splat_covb);

            mat3 Vrk = mat3(
                splat_cova.x, splat_cova.y, splat_cova.z, 
                splat_cova.y, splat_covb.x, splat_covb.y,
                splat_cova.z, splat_covb.y, splat_covb.z
            );

            float focal = viewport.x * matrix_projection[0][0];

            mat3 J = mat3(
                focal / splat_cam.z, 0., -(focal * splat_cam.x) / (splat_cam.z * splat_cam.z), 
                0., focal / splat_cam.z, -(focal * splat_cam.y) / (splat_cam.z * splat_cam.z), 
                0., 0., 0.
            );

            mat3 W = transpose(mat3(matrix_view));
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
                return vec4(0.0, 0.0, 2.0, 1.0);
            }

            texCoord = vertex_position.xy * 2.0;

            return splat_proj +
                vec4((vertex_position.x * v1 + vertex_position.y * v2) / viewport * 2.0,
                    0.0, 0.0) * splat_proj.w;
        #endif

        id = float(vertex_id);
    }
`;

const splatCoreFS = /* glsl_ */ `
    varying vec2 texCoord;
    varying vec4 color;
    varying float id;

    #ifdef PICK_PASS
        uniform vec4 uColor;
    #endif

    vec4 evalSplat() {

        #ifdef DEBUG_RENDER

            if (color.a < 0.2) discard;
            return color;

        #else

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

            // the color here is in gamma space, so bring it to linear
            vec3 diffuse = decodeGamma(color.rgb);

            // apply tone-mapping and gamma correction as needed
            diffuse = toneMap(diffuse);
            diffuse = gammaCorrectOutput(diffuse);

            return vec4(diffuse, B);

        #endif
    }
`;

class GShaderGeneratorSplat {
    generateKey(options) {
        const vsHash = hashCode(options.vertex);
        const fsHash = hashCode(options.fragment);
        return `splat-${options.pass}-${options.gamma}-${options.toneMapping}-${vsHash}-${fsHash}-${options.debugRender}-${options.dither}}`;
    }

    createShaderDefinition(device, options) {

        const shaderPassInfo = ShaderPass.get(device).getByIndex(options.pass);
        const shaderPassDefines = shaderPassInfo.shaderDefines;

        const defines =
            shaderPassDefines +
            (options.debugRender ? '#define DEBUG_RENDER\n' : '') +
            (device.isWebGL1 ? '' : '#define INT_INDICES\n') +
            `#define DITHER_${options.dither.toUpperCase()}\n`;

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
                vertex_id: SEMANTIC_ATTR13
            },
            vertexCode: vs,
            fragmentCode: fs
        });
    }
}

const gsplat = new GShaderGeneratorSplat();

export { gsplat };
