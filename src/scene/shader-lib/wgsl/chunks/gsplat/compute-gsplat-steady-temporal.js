// SteadySplats Eq. 20 / Algorithm 3. Reject history by reducing its weight, not clipping RGB.
export default /* wgsl */`
uniform steadyValid: u32;
uniform steadyRetention: f32;
uniform steadyInverseProjection: mat4x4f;
uniform steadyInverseView: mat4x4f;
uniform steadyPreviousViewProjection: mat4x4f;
var steadySamples: texture_2d<u32>;
var steadyPrevious: texture_2d<f32>;

fn steadyYCoCg(c: vec3f) -> vec3f {
    return vec3f(dot(c, vec3f(0.25, 0.5, 0.25)), (c.r - c.b) * 0.5, dot(c, vec3f(-0.25, 0.5, -0.25)));
}

fn steadyCubic(t: f32) -> vec4f {
    let t2 = t * t;
    let t3 = t2 * t;
    return vec4f(-0.5 * t + t2 - 0.5 * t3, 1.0 - 2.5 * t2 + 1.5 * t3,
                 0.5 * t + 2.0 * t2 - 1.5 * t3, -0.5 * t2 + 0.5 * t3);
}

fn steadyHistoryAt(pixel: vec2f) -> vec4f {
    let base = vec2i(floor(pixel - 0.5));
    let fraction = fract(pixel - 0.5);
    let wx = steadyCubic(fraction.x);
    let wy = steadyCubic(fraction.y);
    var color = vec4f(0.0);
    for (var y = 0; y < 4; y++) {
        for (var x = 0; x < 4; x++) {
            let q = clamp(base + vec2i(x - 1, y - 1), vec2i(0), vec2i(uniform.steadySize) - 1);
            color += wx[x] * wy[y] * textureLoad(steadyPrevious, q, 0);
        }
    }
    return color;
}

fn steadyTemporalAt(p: vec2i, current: vec4f) -> vec4f {
    var color = current;
    if (uniform.steadyValid != 0u && uniform.steadyRetention > 0.0) {
        let pixel = vec2f(p) + 0.5;
        let sample = textureLoad(steadySamples, p, 0);
        let ndc = pixel / uniform.steadySize * vec2f(2.0, -2.0) + vec2f(-1.0, 1.0);
        let unprojected = uniform.steadyInverseProjection * vec4f(ndc, 1.0, 1.0);
        let ray = unprojected.xyz / -unprojected.z;
        let depth = bitcast<f32>(sample.z);
        let world = uniform.steadyInverseView * select(vec4f(ray, 0.0), vec4f(ray * depth, 1.0), sample.y != 0u);
        let previousClip = uniform.steadyPreviousViewProjection * world;
        let previousPixel = (previousClip.xy / max(previousClip.w, 1e-20) * vec2f(0.5, -0.5) + 0.5) * uniform.steadySize;
        if (previousClip.w > 0.0 && all(previousPixel >= vec2f(2.0)) && all(previousPixel < uniform.steadySize - 2.0)) {
            let historical = steadyHistoryAt(previousPixel);
            var mean = vec3f(0.0);
            var second = vec3f(0.0);
            var coverage = 0.0;
            for (var y = -1; y <= 1; y++) {
                for (var x = -1; x <= 1; x++) {
                    let q = clamp(p + vec2i(x, y), vec2i(0), vec2i(uniform.steadySize) - 1);
                    let raw = textureLoad(steadyRaw, q, 0);
                    let value = steadyYCoCg(raw.rgb);
                    mean += value;
                    second += value * value;
                    coverage += raw.a;
                }
            }
            mean /= 9.0;
            let sigma = sqrt(max(second / 9.0 - mean * mean, vec3f(0.0)));
            let gamma = mix(4.0, 1.0, min(length(pixel - previousPixel) / 4.0, 1.0));
            let extent = max(sigma * gamma, vec3f(0.01, 0.005, 0.005));
            let delta = abs(steadyYCoCg(historical.rgb) - mean) / extent;
            let rejection = max(max(delta.x, max(delta.y, delta.z)), abs(historical.a - coverage / 9.0) * 4.0);
            color = mix(current, historical, uniform.steadyRetention / max(1.0, rejection));
        }
    }
    return color;
}
`;
