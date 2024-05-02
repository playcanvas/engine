import { hashCode } from "../../core/hash.js";
import { ShaderUtils } from "../../platform/graphics/shader-utils.js";
import { DITHER_NONE } from "../constants.js";
import { shaderChunks } from "../shader-lib/chunks/chunks.js";
import { ShaderGenerator } from "../shader-lib/programs/shader-generator.js";
import { ShaderPass } from "../shader-pass.js";
import { SEMANTIC_ATTR13, SEMANTIC_COLOR, SEMANTIC_POSITION } from "../../platform/graphics/constants.js";

// vertex shader
const splatCoreVS = /* glsl */ `

uniform mat4 matrix_model;
uniform mat4 matrix_view;
uniform mat4 matrix_projection;

uniform vec2 viewport;

attribute vec3 vertex_position;
// attribute uvec4 vertex_id_attrib;
attribute uint vertex_id_attrib;

varying vec2 texCoord;
varying vec4 color;
varying float id;

uniform vec4 tex_params;
uniform highp sampler2D v1v2Texture;
uniform highp sampler2D transformA;
uniform sampler2D splatColor;

void getSplatUV(out uint splatId, out ivec2 splatUV) {

    // turn vertex_id into int grid coordinates
    ivec2 textureSize = ivec2(tex_params.xy);
    vec2 invTextureSize = tex_params.zw;

    // splatId = vertex_id_attrib[int(vertex_position.z)];
    splatId = vertex_id_attrib;

    int gridV = int(float(splatId) * invTextureSize.x);
    int gridU = int(splatId) - gridV * textureSize.x;
    splatUV = ivec2(gridU, gridV);
}

void splatMain() {
    uint splatId;
    ivec2 splatUV;
    getSplatUV(splatId, splatUV);

    vec3 center = texelFetch(transformA, splatUV, 0).xyz;
    vec4 centerProj = matrix_projection * matrix_view * matrix_model * vec4(center, 1.0);

    // cull splat behind camera
    // if (centerProj.z < -centerProj.w) {
    //     gl_Position = vec4(0.0);
    //     return;
    // }

    vec4 v1v2 = texelFetch(v1v2Texture, splatUV, 0);
    // vec4 v1v2 = vec4(32.0, 0.0, 0.0, 32.0);

    // early out tiny splats
    // TODO: figure out length units and expose as uniform parameter
    // TODO: perhaps make this a shader compile-time option
    if (dot(v1v2.xy, v1v2.xy) < 16.0 && dot(v1v2.zw, v1v2.zw) < 16.0) {
        gl_Position = vec4(0.0);
        return;
    }

    texCoord = vertex_position.xy;
    centerProj.xy += (texCoord.x * v1v2.xy + texCoord.y * v1v2.zw) / viewport * centerProj.w;
    gl_Position = centerProj;
    color = texelFetch(splatColor, splatUV, 0);
    id = float(splatId);
}
`;

// fragment shader
const splatCoreFS = /* glsl */ `

varying vec2 texCoord;
varying vec4 color;
varying float id;

#ifdef PICK_PASS
    uniform vec4 uColor;
#endif

vec4 evalSplat() {

    // discard;

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
}
`;

class GShaderGeneratorSplat {
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
                vertex_id_attrib: SEMANTIC_ATTR13
            },
            vertexCode: vs,
            fragmentCode: fs
        });
    }
}

const gsplat = new GShaderGeneratorSplat();

export { gsplat };
