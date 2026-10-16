// the animation time, and the number of noise cells across the texture
uniform float uTime;
uniform float uScale;

// the colors the pattern is shaded with, in linear space
uniform vec3 uColorBase;
uniform vec3 uColorMid;
uniform vec3 uColorHigh;
uniform vec3 uColorVein;

varying vec2 uv0;

// a pseudo-random unit vector for a cell of the noise lattice. The cell is wrapped by the period,
// which makes the noise tile, so that the texture repeats seamlessly over the objects
vec2 gradient(vec2 cell, float period) {
    cell = mod(cell, period);
    float angle = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453) * 6.2831853;
    return vec2(cos(angle), sin(angle));
}

// gradient noise in the -0.7 .. 0.7 range, tiling with the period
float noise(vec2 p, float period) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

    float a = dot(gradient(i, period), f);
    float b = dot(gradient(i + vec2(1.0, 0.0), period), f - vec2(1.0, 0.0));
    float c = dot(gradient(i + vec2(0.0, 1.0), period), f - vec2(0.0, 1.0));
    float d = dot(gradient(i + vec2(1.0, 1.0), period), f - vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// fractal noise, summing octaves of the noise with doubling frequency, all tiling with the texture
float fbm(vec2 p, float period) {
    float sum = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
        sum += amplitude * noise(p, period);
        p *= 2.0;
        period *= 2.0;
        amplitude *= 0.5;
    }
    return sum;
}

void main(void)
{
    vec2 p = uv0 * uScale;
    float t = uTime;

    // warp the domain of the noise by the noise itself, twice, which creates the flowing pattern.
    // The offsets keep the noise tiling, as the noise repeats for any offset
    vec2 q = vec2(fbm(p, uScale), fbm(p + vec2(5.2, 1.3), uScale));
    vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + 0.15 * t, uScale),
                  fbm(p + 4.0 * q + vec2(8.3, 2.8) + 0.126 * t, uScale));
    float h = fbm(p + 4.0 * r, uScale);

    // shade the pattern by the warped noise
    float vein = smoothstep(0.35, 0.6, abs(r.x));
    vec3 color = mix(uColorBase, uColorMid, clamp(h * h * 6.0, 0.0, 1.0));
    color = mix(color, uColorHigh, clamp(length(q) * 1.5, 0.0, 1.0));
    color = mix(color, uColorVein, vein);

    // the height of the surface, which the normal map is generated from, is stored in the alpha.
    // The veins are carved into the surface
    float height = clamp(0.6 + 0.3 * h - 0.25 * vein, 0.0, 1.0);
    gl_FragColor = vec4(color, height);
}
