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

uniform vec4 outline_color;
uniform float outline_distance;
uniform vec4 shadow_color;
uniform vec2 shadow_offset;
//vec2 shadowVector = vec2(0.0062, -0.0046);

vec4 applyMsdf(vec4 color) {
    // sample the field
    vec3 tsample = texture2D(texture_msdfMap, vUv0).rgb;
    vec2 uvShdw = vUv0 - shadow_offset;
    vec3 ssample = texture2D(texture_msdfMap, uvShdw).rgb;
    // get the signed distance value
    float sigDist = median(tsample.r, tsample.g, tsample.b);
    float sigDistShdw = median(ssample.r, ssample.g, ssample.b);

    #ifdef USE_FWIDTH
        // smoothing depends on size of texture on screen
        vec2 w = fwidth(vUv0);
        float smoothing = clamp(w.x * font_textureWidth / font_pxrange, 0.0, 0.5);
    #else
        float font_size = 16.0; // TODO fix this
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
    float sigDistInner = map(mapMin, mapMax, sigDist - outline_distance);
    float sigDistOutline = map(mapMin, mapMax, sigDist + outline_distance);
    sigDistShdw = map(mapMin, mapMax, sigDistShdw + outline_distance);

    float center = 0.5;
    // calculate smoothing and use to generate opacity
    float inside = smoothstep(center-smoothing, center+smoothing, sigDistInner);
    float outline = smoothstep(center-smoothing, center+smoothing, sigDistOutline);
    float shadow = smoothstep(center-smoothing, center+smoothing, sigDistShdw);

    vec4 tcolor = (outline > inside) ? outline * vec4(outline_color.a * outline_color.rgb, outline_color.a) : vec4(0.0);
    tcolor = mix(tcolor, color, inside);

    vec4 scolor = (shadow > outline) ? shadow * vec4(shadow_color.a * shadow_color.rgb, shadow_color.a) : tcolor;
    tcolor = mix(scolor, tcolor, outline);
    
    return tcolor;
}