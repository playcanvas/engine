uniform sampler2D texture_msdfMap;

#ifdef GL_OES_standard_derivatives
#define USE_FWIDTH
#endif

#ifdef GL2
#define USE_FWIDTH
#endif

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

float map (float min, float max, float v) {
    return (v - min) / (max - min);
}

// msdf way
// vec4 applyMsdf(vec4 color) {
//     vec3 tsample = texture(texture_msdfMap, vUv0).rgb;
   
//     // separate
//     vec2 msdfUnit = 4.0 / vec2(512.0, 256.0);
//     float sigDist = median(tsample.r, tsample.g, tsample.b) - 0.5;
//     sigDist *= dot(msdfUnit, 0.5/fwidth(vUv0));
//     float distance = clamp(sigDist + 0.5, 0.0, 1.0);
//     return mix(vec4(0.0), color, distance);
// }


uniform float font_sdfIntensity; // intensity is used to boost the value read from the SDF, 0 is no boost, 1.0 is max boost
uniform float font_pxrange;      // the number of pixels between inside and outside the font in SDF
uniform float font_textureWidth; // the width of the texture atlas

vec4 applyMsdf(vec4 color) {
    float font_size = 16.0; // TODO fix this

    // sample the field
    vec3 tsample = texture2D(texture_msdfMap, vUv0).rgb;
    // get the signed distance value
    float sigDist = median(tsample.r, tsample.g, tsample.b);

    #ifdef USE_FWIDTH
        // smoothing depends on size of texture on screen
        vec2 w = fwidth(vUv0);
        float smoothing = clamp(map(0.0, 2.0 * font_pxrange / font_textureWidth, w.x), 0.0, 0.5);
    #else
        // smoothing gets smaller as the font size gets bigger
        // don't have fwidth we can approximate from font size, this doesn't account for scaling
        // so a big font scaled down will be wrong...

        float smoothing = clamp(2.0 * font_pxrange / font_size, 0.0, 0.5);
        // for small fonts we remap the distance field to intensify it
        // float mapMin = 0.05;
        // float mapMax = clamp(((font_size * 0.4 / 40.0) + 0.52), mapMin, 1.0);
    #endif
    float mapMin = 0.05;
    float mapMax = clamp(1.0 - font_sdfIntensity, mapMin, 1.0);

    
    // remap to a smaller range (used on smaller font sizes)
    sigDist = map(mapMin, mapMax, sigDist);

    float center = 0.5;

    // calculate smoothing and use to generate opacity
    // float smoothing = clamp(font_smoothing * (1.0-roy), 0.0, center);
    float opacity = smoothstep(center-smoothing, center+smoothing, sigDist);

    // return final color
    return mix(vec4(0.0), color, opacity);
}