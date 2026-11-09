import { SEMANTIC_POSITION } from '../../platform/graphics/constants.js';

/**
 * @import { ShaderDesc } from '../../scene/materials/shader-material.js'
 */

const vertexGLSL = /* glsl */ `
    attribute vec2 vertex_position;
    uniform mat4 matrix_model;
    uniform float projectionFlipY;
    varying vec2 uv0;
    void main(void) {
        gl_Position = matrix_model * vec4(vertex_position, 0.0, 1.0);
        gl_Position.y *= projectionFlipY;
        uv0 = vertex_position + 0.5;
    }
`;

const vertexWGSL = /* wgsl */ `
    attribute vertex_position: vec2f;
    uniform matrix_model: mat4x4f;
    uniform projectionFlipY: f32;
    varying uv0: vec2f;
    @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = uniform.matrix_model * vec4f(input.vertex_position, 0.0, 1.0);
        output.position.y *= uniform.projectionFlipY;
        output.uv0 = input.vertex_position + vec2f(0.5);
        return output;
    }
`;

// Texture previews, configured by material defines:
// - CUBEMAP_SOURCE: the source is a cubemap, shown as a 4x3 horizontal cross. Each face is shown
//   as stored, with its first row at the top. The middle row holds -X, +Z, +X and -Z, with +Y
//   above and -Y below +Z, so neighboring faces share their edges. The face-local mapping matches
//   getDirectionCubemap in reproject.js. Empty cells are transparent.
// - UNFILTERABLE_SOURCE / DEPTH_SOURCE: unfilterable float or raw depth sources, read without
//   filtering. Otherwise the source is sampled with its own sampler.
// - RAW_CHANNELS: show the stored channels selected by textureChannels, without decoding.
//   RAW_SRGB undoes the hardware sRGB decode first.
// - {DECODE_FUNC}: otherwise, the function decoding the source to linear color.
const textureGLSL = /* glsl */ `
    #include "gammaPS"
    varying vec2 uv0;

    #ifdef CUBEMAP_SOURCE
        uniform highp samplerCube colorMap;
    #else
        uniform highp sampler2D colorMap;
    #endif

    #ifdef RAW_CHANNELS
        uniform ivec3 textureChannels;
    #endif

    #ifdef CUBEMAP_SOURCE
        vec3 crossDirection(vec2 cell, vec2 st) {
            if (cell.y == 0.0) return vec3(st.x, 1.0, st.y);
            if (cell.y == 2.0) return vec3(st.x, -1.0, -st.y);
            if (cell.x == 0.0) return vec3(-1.0, -st.y, st.x);
            if (cell.x == 1.0) return vec3(st.x, -st.y, 1.0);
            if (cell.x == 2.0) return vec3(1.0, -st.y, -st.x);
            return vec3(-st.x, -st.y, -1.0);
        }
    #endif

    void main(void) {
        #ifdef CUBEMAP_SOURCE
            vec2 crossUv = uv0 * vec2(4.0, 3.0);
            vec2 cell = min(floor(crossUv), vec2(3.0, 2.0));
            vec3 dir = crossDirection(cell, (crossUv - cell) * 2.0 - 1.0);
            #if defined(UNFILTERABLE_SOURCE) || defined(DEPTH_SOURCE)
                float lod = 0.0;
            #else
                // The direction jumps between cells, so implicit derivatives would select the
                // smallest mip along cell edges. Use the continuous preview UVs instead.
                vec2 texels = vec2(textureSize(colorMap, 0)) * vec2(4.0, 3.0);
                vec2 dx = dFdx(uv0) * texels;
                vec2 dy = dFdy(uv0) * texels;
                float lod = 0.5 * log2(max(max(dot(dx, dx), dot(dy, dy)), 1e-12));
            #endif
            vec4 sampleColor = textureCubeLod(colorMap, dir, lod);
            float alpha = cell.y == 1.0 || cell.x == 1.0 ? 1.0 : 0.0;
        #else
            #if defined(UNFILTERABLE_SOURCE) || defined(DEPTH_SOURCE)
                ivec2 size = textureSize(colorMap, 0);
                ivec2 uv = clamp(ivec2(uv0 * vec2(size)), ivec2(0), size - 1);
                vec4 sampleColor = texelFetch(colorMap, uv, 0);
            #else
                vec4 sampleColor = texture2D(colorMap, uv0);
            #endif
            float alpha = 1.0;
        #endif

        #if defined(DEPTH_SOURCE)
            gl_FragColor = vec4(vec3(sampleColor.r), alpha);
        #elif defined(RAW_CHANNELS)
            #ifdef RAW_SRGB
                // HDR encodings are deliberately not decoded, and alpha is unaffected
                sampleColor.rgb = mix(1.055 * pow(sampleColor.rgb, vec3(1.0 / 2.4)) - 0.055,
                    sampleColor.rgb * 12.92, lessThanEqual(sampleColor.rgb, vec3(0.0031308)));
            #endif
            gl_FragColor = vec4(sampleColor[textureChannels.x], sampleColor[textureChannels.y], sampleColor[textureChannels.z], alpha);
        #else
            gl_FragColor = vec4(gammaCorrectOutput({DECODE_FUNC}(sampleColor)), alpha);
        #endif
    }
`;

const textureWGSL = /* wgsl */ `
    #include "gammaPS"
    varying uv0: vec2f;

    #if defined(CUBEMAP_SOURCE)
        // WGSL cannot load texels from a cube view, so unfilterable cubes, including depth, are
        // bound as unfilterable float with a non-filtering sampler. A depth binding would require
        // a comparison sampler.
        #if defined(UNFILTERABLE_SOURCE) || defined(DEPTH_SOURCE)
            var colorMap: texture_cube<uff>;
        #else
            var colorMap: texture_cube<f32>;
        #endif
        var colorMapSampler: sampler;
    #elif defined(DEPTH_SOURCE)
        var colorMap: texture_depth_2d;
    #elif defined(UNFILTERABLE_SOURCE)
        var colorMap: texture_2d<uff>;
    #else
        var colorMap: texture_2d<f32>;
        var colorMapSampler: sampler;
    #endif

    #ifdef RAW_CHANNELS
        uniform textureChannels: vec3i;
    #endif

    #ifdef CUBEMAP_SOURCE
        fn crossDirection(cell: vec2f, st: vec2f) -> vec3f {
            if (cell.y == 0.0) { return vec3f(st.x, 1.0, st.y); }
            if (cell.y == 2.0) { return vec3f(st.x, -1.0, -st.y); }
            if (cell.x == 0.0) { return vec3f(-1.0, -st.y, st.x); }
            if (cell.x == 1.0) { return vec3f(st.x, -st.y, 1.0); }
            if (cell.x == 2.0) { return vec3f(1.0, -st.y, -st.x); }
            return vec3f(-st.x, -st.y, -1.0);
        }
    #endif

    @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        #ifdef CUBEMAP_SOURCE
            let crossUv = input.uv0 * vec2f(4.0, 3.0);
            let cell = min(floor(crossUv), vec2f(3.0, 2.0));
            let dir = crossDirection(cell, (crossUv - cell) * 2.0 - 1.0);
            #if defined(UNFILTERABLE_SOURCE) || defined(DEPTH_SOURCE)
                let lod = 0.0;
            #else
                // The direction jumps between cells, so implicit derivatives would select the
                // smallest mip along cell edges. Use the continuous preview UVs instead.
                let texels = vec2f(textureDimensions(colorMap, 0)) * vec2f(4.0, 3.0);
                let dx = dpdx(input.uv0) * texels;
                let dy = dpdy(input.uv0) * texels;
                let lod = 0.5 * log2(max(max(dot(dx, dx), dot(dy, dy)), 1e-12));
            #endif
            let sampleColor = textureSampleLevel(colorMap, colorMapSampler, dir, lod);
            let alpha = select(0.0, 1.0, cell.y == 1.0 || cell.x == 1.0);
        #else
            #if defined(UNFILTERABLE_SOURCE) || defined(DEPTH_SOURCE)
                let size = vec2i(textureDimensions(colorMap, 0));
                let uv = clamp(vec2i(input.uv0 * vec2f(size)), vec2i(0), size - vec2i(1));
                // depth loads return a scalar, splat it to match color loads
                let sampleColor = vec4f(textureLoad(colorMap, uv, 0));
            #else
                let sampleColor = textureSample(colorMap, colorMapSampler, input.uv0);
            #endif
            let alpha = 1.0;
        #endif

        #if defined(DEPTH_SOURCE)
            output.color = vec4f(vec3f(sampleColor.r), alpha);
        #elif defined(RAW_CHANNELS)
            #ifdef RAW_SRGB
                // HDR encodings are deliberately not decoded, and alpha is unaffected
                let storedRgb = select(1.055 * pow(sampleColor.rgb, vec3f(1.0 / 2.4)) - vec3f(0.055),
                    sampleColor.rgb * 12.92, sampleColor.rgb <= vec3f(0.0031308));
                let storedColor = vec4f(storedRgb, sampleColor.a);
            #else
                let storedColor = sampleColor;
            #endif
            output.color = vec4f(storedColor[uniform.textureChannels.x], storedColor[uniform.textureChannels.y], storedColor[uniform.textureChannels.z], alpha);
        #else
            output.color = vec4f(gammaCorrectOutput({DECODE_FUNC}(sampleColor)), alpha);
        #endif
        return output;
    }
`;

// Preview UVs start at the top. Scene depth follows the camera target's orientation, including
// its projection flip and the graphics backend's native texture origin.
const sceneDepthGLSL = /* glsl */ `
    #include "screenDepthPS"
    #include "gammaPS"
    varying vec2 uv0;
    uniform float projectionFlipY;
    void main(void) {
        vec2 uv = vec2(uv0.x, 0.5 - (uv0.y - 0.5) * projectionFlipY);
        float depth = getLinearScreenDepth(getImageEffectUV(uv)) * camera_params.x;
        gl_FragColor = vec4(gammaCorrectOutput(vec3(depth)), 1.0);
    }
`;

const sceneDepthWGSL = /* wgsl */ `
    #include "screenDepthPS"
    #include "gammaPS"
    varying uv0: vec2f;
    uniform projectionFlipY: f32;
    @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let uv = vec2f(input.uv0.x, 0.5 - (input.uv0.y - 0.5) * uniform.projectionFlipY);
        let depth = getLinearScreenDepth(getImageEffectUV(uv)) * uniform.camera_params.x;
        output.color = vec4f(gammaCorrectOutput(vec3f(depth)), 1.0);
        return output;
    }
`;

const attributes = { vertex_position: SEMANTIC_POSITION };

/**
 * Shader for texture previews. Variants are selected by material defines.
 *
 * @type {ShaderDesc}
 * @ignore
 */
const textureShaderDesc = {
    uniqueName: 'TextureRenderer',
    attributes,
    vertexGLSL,
    vertexWGSL,
    fragmentGLSL: textureGLSL,
    fragmentWGSL: textureWGSL
};

/**
 * Shader for the scene depth preview.
 *
 * @type {ShaderDesc}
 * @ignore
 */
const sceneDepthShaderDesc = {
    uniqueName: 'TextureRenderer-SceneDepth',
    attributes,
    vertexGLSL,
    vertexWGSL,
    fragmentGLSL: sceneDepthGLSL,
    fragmentWGSL: sceneDepthWGSL
};

export { textureShaderDesc, sceneDepthShaderDesc };
