export default /* wgsl */`
varying @interpolate(flat, either) steadyIndex: u32;
varying @interpolate(flat, either) steadyId: u32;
varying @interpolate(flat, either) steadyDepth: f32;
varying @interpolate(flat, either) steadyColor: vec3f;
varying @interpolate(flat, either) steadySeed: u32;
varying @interpolate(flat, either) steadyOpacity: f32;
varying steadyUV: vec2f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    let p = vec2u(input.position.xy);
    let pixel = p.x + p.y * u32(uniform.steadySize.x);
    let key = steadySeed ^ steadyHash(pixel);
    let threshold = f32(steadyHash(key) >> 8u) * (1.0 / 16777216.0);
    if (steadyAlphaFromUV(steadyOpacity, steadyUV) <= threshold) {
        discard;
    }
    output.color = vec4f(steadyColor, 1.0);
    // Cache indices are frame-local; FIFO identity is the stable work-buffer ID.
    output.color1 = vec4u(steadyIndex + 1u, steadyId, bitcast<u32>(steadyDepth), bitcast<u32>(input.position.z));
    return output;
}
`;
