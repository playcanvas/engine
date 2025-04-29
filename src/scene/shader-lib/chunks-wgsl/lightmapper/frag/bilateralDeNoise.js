export default /* wgsl */`
// bilateral filter, based on https://www.shadertoy.com/view/4dfGDH# and
// http://people.csail.mit.edu/sparis/bf_course/course_notes.pdf

// A bilateral filter is a non-linear, edge-preserving, and noise-reducing smoothing filter for images.
// It replaces the intensity of each pixel with a weighted average of intensity values from nearby pixels.
// This weight can be based on a Gaussian distribution. Crucially, the weights depend not only on
// Euclidean distance of pixels, but also on the radiometric differences (e.g., range differences, such
// as color intensity, depth distance, etc.). This preserves sharp edges.

fn normpdf3(v: vec3f, sigma: f32) -> f32 {
    return 0.39894 * exp(-0.5 * dot(v, v) / (sigma * sigma)) / sigma;
}

fn decodeRGBM(rgbm: vec4f) -> vec3f {
    let color = (8.0 * rgbm.a) * rgbm.rgb;
    return color * color;
}

fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

fn encodeRGBM(color: vec3f) -> vec4f {
    var encoded: vec4f;
    let rgb_processed = pow(color.rgb, vec3f(0.5)) * (1.0 / 8.0);
    encoded = vec4f(rgb_processed, 0.0);

    let max_g_b = max( encoded.g, max( encoded.b, 1.0 / 255.0 ) );
    let max_rgb = max( encoded.r, max_g_b );
    encoded.a = clamp(max_rgb, 0.0, 1.0);
    encoded.a = ceil(encoded.a * 255.0) / 255.0;

    encoded = vec4f(encoded.rgb / encoded.a, encoded.a);
    return encoded;
}

fn decode(pixel: vec4f) -> vec3f {
    #if HDR
        return pixel.rgb;
    #else
        return decodeRGBM(pixel);
    #endif
}

fn isUsed(pixel: vec4f) -> bool {
    #if HDR
        return any(pixel.rgb > vec3f(0.0));
    #else
        return pixel.a > 0.0;
    #endif
}

varying vUv0: vec2f;
var source: texture_2d<f32>;
var sourceSampler: sampler;
uniform kernel: array<f32, {MSIZE}>;
uniform pixelOffset: vec2f;
uniform sigmas: vec2f;
uniform bZnorm: f32;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let pixel = textureSampleLevel(source, sourceSampler, input.vUv0, 0.0);

    // lightmap specific optimization - skip pixels that were not baked
    // this also allows dilate filter that work on the output of this to work correctly, as it depends on .a being zero
    // to dilate, which the following blur filter would otherwise modify
    if (!isUsed(pixel)) {
        output.color = pixel;
        return output;
    }

    // range sigma - controls blurriness based on a pixel distance
    let sigma = uniform.sigmas.x;

    // domain sigma - controls blurriness based on a pixel similarity (to preserve edges)
    let bSigma = uniform.sigmas.y;

    let pixelHdr = decode(pixel);
    var accumulatedHdr = vec3f(0.0);
    var accumulatedFactor = 0.000001;  // avoid division by zero

    // read out the texels
    const kSize = ({MSIZE} - 1) / 2;
    for (var i: i32 = -kSize; i <= kSize; i = i + 1) {
        for (var j: i32 = -kSize; j <= kSize; j = j + 1) {

            // sample the pixel with offset
            let coord = input.vUv0 + vec2f(f32(i), f32(j)) * uniform.pixelOffset;
            let pix = textureSampleLevel(source, sourceSampler, coord, 0.0);

            // lightmap - only use baked pixels
            if (isUsed(pix)) {
                let hdr = decode(pix);

                // bilateral factors
                var factor = uniform.kernel[u32(kSize + j)].element * uniform.kernel[u32(kSize + i)].element;
                factor = factor * normpdf3(hdr - pixelHdr, bSigma) * uniform.bZnorm;

                // accumulate
                accumulatedHdr = accumulatedHdr + factor * hdr;
                accumulatedFactor = accumulatedFactor + factor;
            }
        }
    }

    let finalHDR = accumulatedHdr / accumulatedFactor;

    #if HDR
        output.color = vec4f(finalHDR, 1.0);
    #else
        output.color = encodeRGBM(finalHDR);
    #endif

    return output;
}
`;
