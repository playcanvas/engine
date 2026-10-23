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

struct SteadyGaussian {
    center: vec2f,
    inverseX: vec2f,
    inverseY: vec2f,
    opacity: f32
}

fn steadyGaussian(index: u32) -> SteadyGaussian {
    let base = index * uniform.steadyCacheStride;
    let clip = steadyClip(index);
    let center = (clip.xy / clip.w * vec2f(0.5, -0.5) + 0.5) * uniform.steadySize;
    let a = unpack2x16float(projCache[base + 4u]) * 0.5;
    let b = unpack2x16float(projCache[base + 5u]) * 0.5;
    // Invert the packed axes, whose half-float rounding need not preserve orthogonality.
    let determinant = a.x * b.y - a.y * b.x;
    let inverse = select(0.0, 1.0 / determinant, abs(determinant) > 1e-20);
    return SteadyGaussian(center, vec2f(b.y, -b.x) * inverse,
        vec2f(-a.y, a.x) * inverse, unpack2x16float(projCache[base + 7u]).y);
}

fn steadyAlphaFromUV(opacity: f32, uv: vec2f) -> f32 {
    let radius = dot(uv, uv);
    let tail = exp(-4.0);
    let alpha = clamp(opacity * (exp(-4.0 * radius) - tail) / (1.0 - tail), 0.0, 0.999);
    return select(0.0, alpha, radius <= 1.0 && alpha >= uniform.alphaClipForward);
}

fn steadyAlpha(gaussian: SteadyGaussian, pixel: vec2f) -> f32 {
    let delta = (pixel - gaussian.center) * vec2f(1.0, -1.0);
    let uv = vec2f(dot(delta, gaussian.inverseX), dot(delta, gaussian.inverseY));
    return steadyAlphaFromUV(gaussian.opacity, uv);
}

`;
