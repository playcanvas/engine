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

// smoothstep
uniform float font_size;

vec4 applyMsdf(vec4 color) {
    float pxRange = 4.0; // pxrange used for font
    float txSizeX = 512.0; // size of texture atlas

    #ifdef USE_FWIDTH
        // smoothing depends on size of texture on screen
        vec2 w = fwidth(vUv0);
        float smoothing = clamp(map(0.0, 2.0 * pxRange / txSizeX, w.x), 0.0, 0.5);
    #else
        // smoothing gets smaller as the font size gets bigger
        // don't have fwidth we can approximate from font size, this doesn't account for scaling
        // so a big font scaled down will be wrong...
        float smoothing = clamp(2.0 * pxRange / font_size, 0.0, 0.5);
    #endif
    
    // for small fonts we remap the distance field to intensify it
    float mapMin = 0.05;
    float mapMax = clamp(((font_size * 0.4 / 40.0) + 0.52), mapMin, 1.0);

    // sample the field
    vec3 tsample = texture(texture_msdfMap, vUv0).rgb;
    // get the signed distance value
    float sigDist = median(tsample.r, tsample.g, tsample.b);
    // remap to a smaller range (used on smaller font sizes)
    sigDist = map(mapMin, mapMax, sigDist);

    float center = 0.5;

    // calculate smoothing and use to generate opacity
    // float smoothing = clamp(font_smoothing * (1.0-roy), 0.0, center);
    float opacity = smoothstep(center-smoothing, center+smoothing, sigDist);

    // return final color
    return mix(vec4(0.0), color, opacity);
}