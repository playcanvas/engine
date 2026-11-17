struct ub_compute {
    time: f32,
    hue: f32
}

@group(0) @binding(0) var<uniform> ubCompute : ub_compute;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var outputTexture: texture_storage_2d<rgba8unorm, write>;

const TAU = 6.2831853;

// A palette of smoothly changing colors, made of a cosine wave for each channel
fn palette(t: f32) -> vec3f {
    return vec3f(0.55, 0.35, 0.6) + vec3f(0.45, 0.35, 0.4) * cos(TAU * (t + vec3f(0.0, 0.15, 0.3)));
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id : vec3u) {

    // a thread for each texel - skip the threads beyond the texture, as the dispatch is rounded up
    // to whole workgroups
    let size = textureDimensions(outputTexture);
    if (any(global_id.xy >= size)) {
        return;
    }

    // the position of the texel, as an angle from 0 to 2 PI in both directions
    let p = (vec2f(global_id.xy) + 0.5) / vec2f(size) * TAU;
    let t = ubCompute.time;

    // Bend the position with a few waves, so the pattern flows. The waves repeat a whole number of
    // times across the texture, so the texture tiles without seams.
    var q = p;
    q += 0.7 * vec2f(sin(2.0 * q.y + t), sin(3.0 * q.x - 0.7 * t));
    q += 0.5 * vec2f(sin(3.0 * q.y - 1.3 * t), sin(2.0 * q.x + 0.9 * t));
    let v = sin(2.0 * q.x + t) * sin(q.y - 0.5 * t);

    // the color flows through the palette, with thin bright lines where the pattern crosses even
    // steps, like the lines of a contour map
    var color = palette(0.5 * v + 0.1 * t + ubCompute.hue) * (0.65 + 0.35 * v);
    let line = abs(fract(v * 2.0) - 0.5);
    color += palette(0.5 * v + 0.1 * t + ubCompute.hue + 0.5) * (1.0 - smoothstep(0.0, 0.12, line));

    // Load the texel of the input texture, the white logo on gray, and lay the logo over the
    // pattern. Only the white of the logo is kept, the gray around it leaves the pattern as it is.
    let logo = textureLoad(inputTexture, vec2i(global_id.xy), 0).r;
    color = mix(color, vec3f(1.0), smoothstep(0.75, 0.95, logo) * 0.9);

    // write it to the output texture. The texture is not sRGB, as storage textures can't be, so the
    // material reads its colors as linear, and they are converted to linear here.
    textureStore(outputTexture, vec2i(global_id.xy), vec4f(pow(color, vec3f(2.2)), 1.0));
}
