export default /* wgsl */`
#include "gsplatOutputVS"
attribute vertex_position: vec3f;
uniform viewport_size: vec4f;
uniform clipToViewZ: vec4f;
var<storage, read> sortedIndices: array<u32>;
var<storage, read> numSplatsStorage: array<u32>;

varying @interpolate(flat, either) steadyIndex: u32;
varying @interpolate(flat, either) steadyDepth: f32;
varying @interpolate(flat, either) steadyColor: vec3f;
varying @interpolate(flat, either) steadyNoiseOffset: vec2u;
varying @interpolate(flat, either) steadyNoisePhase: u32;
varying @interpolate(flat, either) steadyOpacity: f32;
varying steadyUV: vec2f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4f(0.0, 0.0, 2.0, 1.0);
    let index = pcInstanceIndex * {GSPLAT_INSTANCE_SIZE}u + u32(vertex_position.z);
    if (index >= numSplatsStorage[0]) {
        return output;
    }
    let base = index * uniform.steadyCacheStride;
    let clip = steadyClip(index);
    let a = unpack2x16float(projCache[base + 4u]);
    let b = unpack2x16float(projCache[base + 5u]);
    let rg = unpack2x16float(projCache[base + 6u]);
    let ba = unpack2x16float(projCache[base + 7u]);
    // The unnormalized Gaussian bounds the truncated profile from above. Keep a small
    // margin so a sample exactly on the alpha cutoff remains inside the rasterized quad.
    let cutoff = max(uniform.alphaClipForward, 1e-20);
    let extent = min(1.0, 0.5 * sqrt(max(0.0, log(max(ba.y / cutoff, 1.0)))) + 1e-3);
    let corner = vertex_position.xy * extent;
    let offset = corner.x * a + corner.y * b;
    output.position = clip + vec4f(offset * clip.w * uniform.viewport_size.zw, 0.0, 0.0);
    output.steadyIndex = index;
    let id = sortedIndices[index] + 1u;
    output.steadyDepth = dot(uniform.clipToViewZ, clip);
    // Match the native renderer's color domain before spatial or temporal averaging.
    output.steadyColor = prepareOutputFromGamma(max(vec3f(rg, ba.x), vec3f(0.0)), output.steadyDepth);
    output.steadyOpacity = ba.y;
    output.steadyUV = corner;
    // Per-primitive R2 offsets decorrelate overlapping splats within the 32x32 STBN slices.
    output.steadyNoiseOffset = vec2u(id * 3242174889u, id * 2447445415u) >> vec2u(27u);
    output.steadyNoisePhase = steadyPrimitivePhase(id);
    return output;
}
`;
