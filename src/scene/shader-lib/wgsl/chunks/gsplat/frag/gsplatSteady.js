export default /* wgsl */`
varying @interpolate(flat, either) steadyIndex: u32;
varying @interpolate(flat, either) steadyDepth: f32;
varying @interpolate(flat, either) steadyColor: vec3f;
varying @interpolate(flat, either) steadyNoiseOffset: vec2u;
varying @interpolate(flat, either) steadyNoisePhase: u32;
varying @interpolate(flat, either) steadyOpacity: f32;
varying steadyUV: vec2f;
uniform steadyFrame: u32;
uniform steadyNoiseShift: u32;
var steadyNoise: texture_3d<f32>;

fn steadyThreshold(pixel: vec2u) -> f32 {
    let coord = vec3i(vec2i((pixel + steadyNoiseOffset) & vec2u(31u)), i32(uniform.steadyFrame & 63u));
    // Rotate in fixed point before converting to float, avoiding R8 threshold quantization.
    let rank = u32(textureLoad(steadyNoise, coord, 0).r * 255.0 + 0.5);
    return steadyNoiseThreshold(rank, steadyNoisePhase, uniform.steadyNoiseShift);
}

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    if (dot(steadyUV, steadyUV) > 1.0) {
        discard;
        return output;
    }
    let alpha = steadyAlphaFromUV(steadyOpacity, steadyUV);
    if (alpha <= 0.0) {
        discard;
        return output;
    }
    let p = vec2u(input.position.xy);
    let threshold = steadyThreshold(p);
    if (alpha <= threshold) {
        discard;
    }
    output.color = vec4f(steadyColor, 1.0);
    // RG32U stores only a frame-local cache index and full-precision linear depth. The history
    // pass looks up the stable ID; the composite derives device depth from the projection.
    output.color1 = vec4u(steadyIndex + 1u, bitcast<u32>(steadyDepth), 0u, 0u);
    return output;
}
`;
