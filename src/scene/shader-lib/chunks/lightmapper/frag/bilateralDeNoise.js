export default /* glsl */`
// bilateral filter, based on https://www.shadertoy.com/view/4dfGDH# and
// http://people.csail.mit.edu/sparis/bf_course/course_notes.pdf

// A bilateral filter is a non-linear, edge-preserving, and noise-reducing smoothing filter for images.
// It replaces the intensity of each pixel with a weighted average of intensity values from nearby pixels.
// This weight can be based on a Gaussian distribution. Crucially, the weights depend not only on
// Euclidean distance of pixels, but also on the radiometric differences (e.g., range differences, such
// as color intensity, depth distance, etc.). This preserves sharp edges.

float normpdf3(in vec3 v, in float sigma) {
    return 0.39894 * exp(-0.5 * dot(v, v) / (sigma * sigma)) / sigma;
}

vec3 decodeRGBM(vec4 rgbm) {
    vec3 color = (8.0 * rgbm.a) * rgbm.rgb;
    return color * color;
}

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec4 encodeRGBM(vec3 color) { // modified RGBM
    vec4 encoded;
    encoded.rgb = pow(color.rgb, vec3(0.5));
    encoded.rgb *= 1.0 / 8.0;

    encoded.a = saturate( max( max( encoded.r, encoded.g ), max( encoded.b, 1.0 / 255.0 ) ) );
    encoded.a = ceil(encoded.a * 255.0) / 255.0;

    encoded.rgb /= encoded.a;
    return encoded;
}

vec3 decode(vec4 pixel) {
    #if HDR
        return pixel.rgb;
    #else
        return decodeRGBM(pixel);
    #endif
}

bool isUsed(vec4 pixel) {
    #if HDR
        return any(greaterThan(pixel.rgb, vec3(0.0)));
    #else
        return pixel.a > 0.0;
    #endif
}

varying vec2 vUv0;
uniform sampler2D source;
uniform vec2 pixelOffset;
uniform vec2 sigmas;
uniform float bZnorm;
uniform float kernel[{MSIZE}];

void main(void) {
    
    vec4 pixel = texture2DLod(source, vUv0, 0.0);

    // lightmap specific optimization - skip pixels that were not baked
    // this also allows dilate filter that work on the output of this to work correctly, as it depends on .a being zero
    // to dilate, which the following blur filter would otherwise modify
    if (!isUsed(pixel)) {
        gl_FragColor = pixel;
        return ;
    }

    // range sigma - controls blurriness based on a pixel distance
    float sigma = sigmas.x;

    // domain sigma - controls blurriness based on a pixel similarity (to preserve edges)
    float bSigma = sigmas.y;

    vec3 pixelHdr = decode(pixel);
    vec3 accumulatedHdr = vec3(0.0);
    float accumulatedFactor = 0.000001;  // avoid division by zero

    // read out the texels
    const int kSize = ({MSIZE} - 1) / 2;
    for (int i = -kSize; i <= kSize; ++i) {
        for (int j = -kSize; j <= kSize; ++j) {
            
            // sample the pixel with offset
            vec2 coord = vUv0 + vec2(float(i), float(j)) * pixelOffset;
            vec4 pix = texture2DLod(source, coord, 0.0);

            // lightmap - only use baked pixels
            if (isUsed(pix)) {
                vec3 hdr = decode(pix);

                // bilateral factors
                float factor = kernel[kSize + j] * kernel[kSize + i];
                factor *= normpdf3(hdr - pixelHdr, bSigma) * bZnorm;

                // accumulate
                accumulatedHdr += factor * hdr;
                accumulatedFactor += factor;
            }
        }
    }

    vec3 finalHDR = accumulatedHdr / accumulatedFactor;

    #if HDR
        gl_FragColor = vec4(finalHDR, 1.0);
    #else
        gl_FragColor = encodeRGBM(finalHDR);
    #endif
}
`;
