export default /* wgsl */`
uniform steadyFrame: u32;
varying @interpolate(flat, either) steadyIndex: u32;
varying @interpolate(flat, either) steadyId: u32;
varying @interpolate(flat, either) steadyDepth: f32;
varying @interpolate(flat, either) steadyColor: vec3f;

fn steadyHash(value: u32) -> u32 {
    var h = value;
    h = (h ^ (h >> 16u)) * 0x7feb352du;
    h = (h ^ (h >> 15u)) * 0x846ca68bu;
    return h ^ (h >> 16u);
}

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    let p = vec2u(input.position.xy);
    let pixel = p.x + p.y * u32(uniform.steadySize.x);
    let key = steadyHash(steadyId) ^ steadyHash(pixel) ^ steadyHash(uniform.steadyFrame + 1u);
    let threshold = f32(steadyHash(key) >> 8u) * (1.0 / 16777216.0);
    if (steadyAlpha(steadyIndex, input.position.xy) <= threshold) {
        discard;
    }
    output.color = vec4f(steadyColor, 1.0);
    // Cache indices are frame-local; FIFO identity is the stable work-buffer ID.
    output.color1 = vec4u(steadyIndex + 1u, steadyId, bitcast<u32>(steadyDepth), bitcast<u32>(input.position.z));
    return output;
}
`;
