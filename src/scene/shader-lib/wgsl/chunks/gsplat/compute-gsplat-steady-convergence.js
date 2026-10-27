// A separate full-precision average starts only after the view stops, excluding motion history.
// Initial spatial estimates settle quickly; later raw samples remove their residual spatial bias.
export default /* wgsl */`
uniform steadyRowStart: u32;
uniform steadyRowCount: u32;
uniform steadyRestFrames: u32;
var<storage, read_write> steadyRest: array<vec4f>;

fn steadyConvergenceAt(p: vec2i, temporal: vec4f, spatial: vec4f) -> vec4f {
    let frames = uniform.steadyRestFrames;
    if (frames == 0u) {
        return temporal;
    }
    let index = u32(p.x) + (u32(p.y) - uniform.steadyRowStart) * u32(uniform.steadySize.x);
    let sample = select(steadyRawAt(p), spatial, frames <= 8u);
    var average = sample;
    if (frames > 1u) {
        average = steadyRest[index];
        average += (sample - average) / f32(frames);
    }
    steadyRest[index] = average;
    return mix(temporal, average, f32(frames) / (f32(frames) + 8.0));
}
`;
