import {
    SEMANTIC_ATTR8, SEMANTIC_ATTR11, SEMANTIC_ATTR12, SEMANTIC_ATTR14,
    SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL
} from 'playcanvas';

/**
 * @import { Material, ShaderMaterial, StandardMaterial, Texture } from 'playcanvas'
 * @import { VatData } from './vat-data.mjs'
 */

/**
 * The vertex attributes the three rows of the affine world transform of each instance are supplied
 * in. The fourth row of the transform is always (0, 0, 0, 1), so storing it would waste a quarter of
 * the per instance data - the shader appends it when it rebuilds the matrix.
 *
 * @type {string[]}
 */
export const VAT_TRANSFORM_SEMANTICS = [SEMANTIC_ATTR11, SEMANTIC_ATTR12, SEMANTIC_ATTR14];

/**
 * The vertex attribute the fractional frame index of each instance is supplied in.
 *
 * @type {string}
 */
export const VAT_FRAME_SEMANTIC = SEMANTIC_ATTR8;

/**
 * The engine version the chunk overrides below were written against.
 *
 * @type {string}
 */
const VAT_CHUNKS_VERSION = '2.22';

// Core of the VAT (Vertex Animation Texture) sampling, shared by all materials.
//
// A skinned animation is baked into an RGBA16U texture, one texel per vertex per sampled frame. A
// texel holds the whole vertex for that frame: the position quantized to 16 bits per axis over the
// bounds of the animation in xyz, and the normal octahedrally encoded as two bytes packed into w. A
// single fetch therefore supplies both, and the quantized form is both smaller and (over the upper
// body, where a half float runs out of mantissa) more accurate than storing raw floats.
//
// The texels are addressed by a flat index, `vertex * frameCount + frame`, which is wrapped into the
// texture using its power of two width. This decouples the vertex and frame counts from the texture
// dimensions - a character is limited by the number of texels a texture holds rather than by having
// to fit one vertex per row, which for a typical frame count is a difference of two orders of
// magnitude.
//
// The frame to display is supplied per instance as a fractional frame index, and the two
// neighbouring frames are linearly interpolated, which gives smooth playback even at a low sampling
// rate. Positions are interpolated in their quantized form and dequantized once, as the
// dequantization is affine; normals have to be decoded first, as the octahedral mapping is not.
//
// The row of the texture is the index of the vertex, which is read from the vertex index built-in
// instead of a vertex attribute, and so no additional per-vertex data is needed.
const vatCoreGLSL = /* glsl */ `

    uniform highp usampler2D vatMap;

    // dequantization range - the minimum corner of the bounds and (bounds size / 65535)
    uniform vec3 vatBoundsMin;
    uniform vec3 vatBoundsScale;

    // the number of frames stored per vertex, and log2 of the texture width
    uniform float vatFrameCount;
    uniform float vatTextureShift;

    #ifdef INSTANCING
        // per instance fractional frame index
        attribute float vatFrame;
        float vatFrameIndex() {
            return vatFrame;
        }
    #else
        // a single character rendered without instancing uses a uniform instead
        uniform float vatFrame;
        float vatFrameIndex() {
            return vatFrame;
        }
    #endif

    // the two frames straddling the playback position, fetched once by vatSample and shared by
    // vatPosition and vatNormal - matching how the engine shares dModelMatrix between the transform
    // and the normal chunk, the transform always runs first
    uvec4 vatTexelA;
    uvec4 vatTexelB;
    float vatBlend;

    // Wraps the flat index of a frame of this vertex into texture coordinates.
    ivec2 vatAddress(int frame) {
        int index = gl_VertexID * int(vatFrameCount) + frame;
        int shift = int(vatTextureShift);
        return ivec2(index & ((1 << shift) - 1), index >> shift);
    }

    void vatSample() {
        float frame = max(vatFrameIndex(), 0.0);
        float frameFloor = floor(frame);
        int frameA = int(frameFloor);
        vatTexelA = texelFetch(vatMap, vatAddress(frameA), 0);
        vatTexelB = texelFetch(vatMap, vatAddress(frameA + 1), 0);
        vatBlend = frame - frameFloor;
    }

    // Returns the local space position of the vertex for the currently played frame.
    vec3 vatPosition() {
        vatSample();
        vec3 quantized = mix(vec3(vatTexelA.xyz), vec3(vatTexelB.xyz), vatBlend);
        return vatBoundsMin + quantized * vatBoundsScale;
    }

    vec3 vatOctDecode(vec2 e) {
        vec3 n = vec3(e, 1.0 - abs(e.x) - abs(e.y));
        float t = max(-n.z, 0.0);
        n.xy += vec2(n.x >= 0.0 ? -t : t, n.y >= 0.0 ? -t : t);
        return normalize(n);
    }

    vec3 vatUnpackNormal(uint packed) {
        vec2 e = vec2(float(packed & 255u), float(packed >> 8u)) * (2.0 / 255.0) - 1.0;
        return vatOctDecode(e);
    }

    // Returns the local space normal of the vertex for the currently played frame.
    vec3 vatNormal() {
        vec3 a = vatUnpackNormal(vatTexelA.w);
        vec3 b = vatUnpackNormal(vatTexelB.w);
        return normalize(mix(a, b, vatBlend));
    }
`;

const vatCoreWGSL = /* wgsl */ `

    var vatMap: texture_2d<u32>;

    // dequantization range - the minimum corner of the bounds and (bounds size / 65535)
    uniform vatBoundsMin: vec3f;
    uniform vatBoundsScale: vec3f;

    // the number of frames stored per vertex, and log2 of the texture width
    uniform vatFrameCount: f32;
    uniform vatTextureShift: f32;

    #ifdef INSTANCING
        // per instance fractional frame index
        attribute vatFrame: f32;
        fn vatFrameIndex() -> f32 {
            return vatFrame;
        }
    #else
        // a single character rendered without instancing uses a uniform instead
        uniform vatFrame: f32;
        fn vatFrameIndex() -> f32 {
            return uniform.vatFrame;
        }
    #endif

    // the two frames straddling the playback position, fetched once by vatSample and shared by
    // vatPosition and vatNormal - matching how the engine shares dModelMatrix between the transform
    // and the normal chunk, the transform always runs first
    var<private> vatTexelA: vec4u;
    var<private> vatTexelB: vec4u;
    var<private> vatBlend: f32;

    // Wraps the flat index of a frame of this vertex into texture coordinates.
    fn vatAddress(frame: u32) -> vec2i {
        let index: u32 = pcVertexIndex * u32(uniform.vatFrameCount) + frame;
        let shift: u32 = u32(uniform.vatTextureShift);
        return vec2i(i32(index & ((1u << shift) - 1u)), i32(index >> shift));
    }

    fn vatSample() {
        let frame: f32 = max(vatFrameIndex(), 0.0);
        let frameFloor: f32 = floor(frame);
        let frameA: u32 = u32(frameFloor);
        vatTexelA = textureLoad(vatMap, vatAddress(frameA), 0);
        vatTexelB = textureLoad(vatMap, vatAddress(frameA + 1u), 0);
        vatBlend = frame - frameFloor;
    }

    // Returns the local space position of the vertex for the currently played frame.
    fn vatPosition() -> vec3f {
        vatSample();
        let quantized: vec3f = mix(vec3f(vatTexelA.xyz), vec3f(vatTexelB.xyz), vec3f(vatBlend));
        return uniform.vatBoundsMin + quantized * uniform.vatBoundsScale;
    }

    fn vatOctDecode(e: vec2f) -> vec3f {
        var n: vec3f = vec3f(e, 1.0 - abs(e.x) - abs(e.y));
        let t: f32 = max(-n.z, 0.0);
        n.x = n.x + select(t, -t, n.x >= 0.0);
        n.y = n.y + select(t, -t, n.y >= 0.0);
        return normalize(n);
    }

    fn vatUnpackNormal(packed: u32) -> vec3f {
        let e: vec2f = vec2f(f32(packed & 255u), f32(packed >> 8u)) * (2.0 / 255.0) - 1.0;
        return vatOctDecode(e);
    }

    // Returns the local space normal of the vertex for the currently played frame.
    fn vatNormal() -> vec3f {
        let a: vec3f = vatUnpackNormal(vatTexelA.w);
        let b: vec3f = vatUnpackNormal(vatTexelB.w);
        return normalize(mix(a, b, vec3f(vatBlend)));
    }
`;

// Replacement for the engine 'transformCoreVS' chunk. It sources the vertex position from the VAT
// texture instead of the vertex buffer, and supplies the instanced model matrix. Note that skinning
// and morphing are intentionally not handled, as the VAT replaces them.
const vatTransformCoreGLSL = /* glsl */ `

    attribute vec4 vertex_position;

    uniform mat4 matrix_viewProjection;
    uniform mat4 matrix_model;

    #include "vatCoreVS"

    #ifdef INSTANCING

        // the three rows of the affine world transform of this instance - the fourth is implicitly
        // (0, 0, 0, 1), so it is not stored
        attribute vec4 vatRow0;
        attribute vec4 vatRow1;
        attribute vec4 vatRow2;

        mat4 getModelMatrix() {
            return matrix_model * mat4(
                vec4(vatRow0.x, vatRow1.x, vatRow2.x, 0.0),
                vec4(vatRow0.y, vatRow1.y, vatRow2.y, 0.0),
                vec4(vatRow0.z, vatRow1.z, vatRow2.z, 0.0),
                vec4(vatRow0.w, vatRow1.w, vatRow2.w, 1.0)
            );
        }

    #else

        mat4 getModelMatrix() {
            return matrix_model;
        }

    #endif

    vec3 getLocalPosition(vec3 vertexPosition) {
        return vatPosition();
    }
`;

const vatTransformCoreWGSL = /* wgsl */ `

    attribute vertex_position: vec4f;

    uniform matrix_viewProjection: mat4x4f;
    uniform matrix_model: mat4x4f;

    #include "vatCoreVS"

    #ifdef INSTANCING

        // the three rows of the affine world transform of this instance - the fourth is implicitly
        // (0, 0, 0, 1), so it is not stored
        attribute vatRow0: vec4f;
        attribute vatRow1: vec4f;
        attribute vatRow2: vec4f;

        fn getModelMatrix() -> mat4x4f {
            return uniform.matrix_model * mat4x4f(
                vec4f(vatRow0.x, vatRow1.x, vatRow2.x, 0.0),
                vec4f(vatRow0.y, vatRow1.y, vatRow2.y, 0.0),
                vec4f(vatRow0.z, vatRow1.z, vatRow2.z, 0.0),
                vec4f(vatRow0.w, vatRow1.w, vatRow2.w, 1.0)
            );
        }

    #else

        fn getModelMatrix() -> mat4x4f {
            return uniform.matrix_model;
        }

    #endif

    fn getLocalPosition(vertexPosition: vec3f) -> vec3f {
        return vatPosition();
    }
`;

// Replacement for the engine 'normalCoreVS' chunk, sourcing the vertex normal from the VAT texture.
// This is included after 'transformCoreVS' and so relies on the functions it declares.
const vatNormalCoreGLSL = /* glsl */ `

    attribute vec3 vertex_normal;

    uniform mat3 matrix_normal;

    vec3 getLocalNormal(vec3 vertexNormal) {
        return vatNormal();
    }

    #ifdef INSTANCING
        mat3 getNormalMatrix(mat4 modelMatrix) {
            return mat3(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz);
        }
    #else
        mat3 getNormalMatrix(mat4 modelMatrix) {
            return matrix_normal;
        }
    #endif
`;

const vatNormalCoreWGSL = /* wgsl */ `

    attribute vertex_normal: vec3f;

    uniform matrix_normal: mat3x3f;

    fn getLocalNormal(vertexNormal: vec3f) -> vec3f {
        return vatNormal();
    }

    #ifdef INSTANCING
        fn getNormalMatrix(modelMatrix: mat4x4f) -> mat3x3f {
            return mat3x3f(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz);
        }
    #else
        fn getNormalMatrix(modelMatrix: mat4x4f) -> mat3x3f {
            return uniform.matrix_normal;
        }
    #endif
`;

/**
 * The VAT shader chunks, which can be assigned to any material to make it render a VAT animated
 * character. See {@link setupVatMaterial}, which does this for you.
 *
 * @type {{ glsl: Object<string, string>, wgsl: Object<string, string> }}
 */
export const vatChunks = {
    glsl: {
        vatCoreVS: vatCoreGLSL,
        transformCoreVS: vatTransformCoreGLSL,
        normalCoreVS: vatNormalCoreGLSL
    },
    wgsl: {
        vatCoreVS: vatCoreWGSL,
        transformCoreVS: vatTransformCoreWGSL,
        normalCoreVS: vatNormalCoreWGSL
    }
};

/**
 * Prepares a material to render a VAT animated character. This works for a {@link StandardMaterial}
 * as well as a {@link ShaderMaterial} which includes the `transformCoreVS` and `normalCoreVS`
 * chunks, for example the material created by `createVatShaderMaterial`.
 *
 * @param {Material} material - The material to set up.
 * @param {Texture} vatMap - The VAT texture, see `createVatTexture`.
 * @param {VatData} data - The VAT data the texture was created from.
 */
export function setupVatMaterial(material, vatMap, data) {

    material.shaderChunksVersion = VAT_CHUNKS_VERSION;

    const glsl = material.getShaderChunks(SHADERLANGUAGE_GLSL);
    const wgsl = material.getShaderChunks(SHADERLANGUAGE_WGSL);
    for (const name in vatChunks.glsl) {
        glsl.set(name, vatChunks.glsl[name]);
        wgsl.set(name, vatChunks.wgsl[name]);
    }

    // The per instance attributes. A ShaderMaterial ignores these, declaring its attributes as part
    // of its shader description instead. Overriding 'transformInstancingVS' with nothing stops the
    // engine from also binding its own instance_line1..4 attributes, which this layout replaces - the
    // chunk itself is never included, as the transformCoreVS override above supersedes it.
    glsl.set('transformInstancingVS', '');
    wgsl.set('transformInstancingVS', '');
    material.setAttribute?.('vatRow0', VAT_TRANSFORM_SEMANTICS[0]);
    material.setAttribute?.('vatRow1', VAT_TRANSFORM_SEMANTICS[1]);
    material.setAttribute?.('vatRow2', VAT_TRANSFORM_SEMANTICS[2]);
    material.setAttribute?.('vatFrame', VAT_FRAME_SEMANTIC);

    material.setParameter('vatMap', vatMap);

    // the range the 16bit position channels are dequantized over
    const min = data.bounds.getMin();
    const size = data.bounds.halfExtents;
    material.setParameter('vatBoundsMin', [min.x, min.y, min.z]);
    material.setParameter('vatBoundsScale', [
        (size.x * 2) / 65535,
        (size.y * 2) / 65535,
        (size.z * 2) / 65535
    ]);

    // the layout of the texture, used to wrap the flat texel index into coordinates
    material.setParameter('vatFrameCount', data.frameCount);
    material.setParameter('vatTextureShift', Math.log2(data.width));

    material.update();
}
