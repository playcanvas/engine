export default /* wgsl */`
#include "gsplatOutputVS"
attribute vertex_position: vec3f;
uniform steadyFrame: u32;
uniform viewport_size: vec4f;
uniform clipToViewZ: vec4f;
var<storage, read> sortedIndices: array<u32>;
var<storage, read> numSplatsStorage: array<u32>;

varying @interpolate(flat, either) steadyIndex: u32;
varying @interpolate(flat, either) steadyId: u32;
varying @interpolate(flat, either) steadyDepth: f32;
varying @interpolate(flat, either) steadyColor: vec3f;
varying @interpolate(flat, either) steadySeed: u32;
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
    let offset = vertex_position.x * a + vertex_position.y * b;
    output.position = clip + vec4f(offset * clip.w * uniform.viewport_size.zw, 0.0, 0.0);
    output.steadyIndex = index;
    output.steadyId = sortedIndices[index] + 1u;
    output.steadyDepth = dot(uniform.clipToViewZ, clip);
    let rg = unpack2x16float(projCache[base + 6u]);
    let ba = unpack2x16float(projCache[base + 7u]);
    // Match the native renderer's color domain before spatial or temporal averaging.
    output.steadyColor = prepareOutputFromGamma(max(vec3f(rg, ba.x), vec3f(0.0)), output.steadyDepth);
    output.steadyOpacity = ba.y;
    output.steadyUV = vertex_position.xy;
    output.steadySeed = steadyHash(output.steadyId) ^ steadyHash(uniform.steadyFrame + 1u);
    return output;
}
`;
