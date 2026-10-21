// Alpha must agree between visibility sampling and the proposal-density ratios. Use the
// engine's normalized, truncated Gaussian profile and the same packed projection cache.
export default /* wgsl */`
uniform steadySize: vec2f;
uniform steadyCacheStride: u32;
uniform alphaClipForward: f32;
var<storage, read> projCache: array<u32>;

const STEADY_NEIGHBORS = array<vec2i, 4>(vec2i(1, 0), vec2i(-1, 0), vec2i(0, 1), vec2i(0, -1));

fn steadyInside(p: vec2i) -> bool {
    return all(p >= vec2i(0)) && all(p < vec2i(uniform.steadySize));
}

fn steadyClip(index: u32) -> vec4f {
    let base = index * uniform.steadyCacheStride;
    return bitcast<vec4f>(vec4u(projCache[base], projCache[base + 1u], projCache[base + 2u], projCache[base + 3u]));
}

fn steadyAlpha(index: u32, pixel: vec2f) -> f32 {
    let base = index * uniform.steadyCacheStride;
    let clip = steadyClip(index);
    let center = (clip.xy / clip.w * vec2f(0.5, -0.5) + 0.5) * uniform.steadySize;
    let delta = (pixel - center) * vec2f(1.0, -1.0);
    let a = unpack2x16float(projCache[base + 4u]) * 0.5;
    let b = unpack2x16float(projCache[base + 5u]) * 0.5;
    let uv = vec2f(dot(delta, a) / max(dot(a, a), 1e-20), dot(delta, b) / max(dot(b, b), 1e-20));
    let radius = dot(uv, uv);
    let opacity = unpack2x16float(projCache[base + 7u]).y;
    let tail = exp(-4.0);
    let alpha = clamp(opacity * (exp(-4.0 * radius) - tail) / (1.0 - tail), 0.0, 0.999);
    return select(0.0, alpha, radius <= 1.0 && alpha >= uniform.alphaClipForward);
}
`;
