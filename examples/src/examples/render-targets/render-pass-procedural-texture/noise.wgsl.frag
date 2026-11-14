// the animation time, and the number of noise cells across the texture
uniform uTime: f32;
uniform uScale: f32;

// the colors the pattern is shaded with, in linear space
uniform uColorBase: vec3f;
uniform uColorMid: vec3f;
uniform uColorHigh: vec3f;
uniform uColorVein: vec3f;

varying uv0: vec2f;

// a pseudo-random unit vector for a cell of the noise lattice. The cell is wrapped by the period,
// which makes the noise tile, so that the texture repeats seamlessly over the objects
fn gradient(cell: vec2f, period: f32) -> vec2f {
    let wrapped = cell - period * floor(cell / period);
    let angle = fract(sin(dot(wrapped, vec2f(127.1, 311.7))) * 43758.5453) * 6.2831853;
    return vec2f(cos(angle), sin(angle));
}

// gradient noise in the -0.7 .. 0.7 range, tiling with the period
fn noise(p: vec2f, period: f32) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

    let a = dot(gradient(i, period), f);
    let b = dot(gradient(i + vec2f(1.0, 0.0), period), f - vec2f(1.0, 0.0));
    let c = dot(gradient(i + vec2f(0.0, 1.0), period), f - vec2f(0.0, 1.0));
    let d = dot(gradient(i + vec2f(1.0, 1.0), period), f - vec2f(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// fractal noise, summing octaves of the noise with doubling frequency, all tiling with the texture
fn fbm(position: vec2f, startPeriod: f32) -> f32 {
    var p = position;
    var period = startPeriod;
    var sum = 0.0;
    var amplitude = 0.5;
    for (var i = 0; i < 5; i++) {
        sum += amplitude * noise(p, period);
        p *= 2.0;
        period *= 2.0;
        amplitude *= 0.5;
    }
    return sum;
}

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let scale = uniform.uScale;
    let p = input.uv0 * scale;
    let t = uniform.uTime;

    // warp the domain of the noise by the noise itself, twice, which creates the flowing pattern.
    // The offsets keep the noise tiling, as the noise repeats for any offset
    let q = vec2f(fbm(p, scale), fbm(p + vec2f(5.2, 1.3), scale));
    let r = vec2f(fbm(p + 4.0 * q + vec2f(1.7, 9.2) + 0.15 * t, scale),
                  fbm(p + 4.0 * q + vec2f(8.3, 2.8) + 0.126 * t, scale));
    let h = fbm(p + 4.0 * r, scale);

    // shade the pattern by the warped noise
    let vein = smoothstep(0.35, 0.6, abs(r.x));
    var color = mix(uniform.uColorBase, uniform.uColorMid, clamp(h * h * 6.0, 0.0, 1.0));
    color = mix(color, uniform.uColorHigh, clamp(length(q) * 1.5, 0.0, 1.0));
    color = mix(color, uniform.uColorVein, vein);

    // the height of the surface, which the normal map is generated from, is stored in the alpha.
    // The veins are carved into the surface
    let height = clamp(0.6 + 0.3 * h - 0.25 * vein, 0.0, 1.0);
    output.color = vec4f(color, height);
    return output;
}
