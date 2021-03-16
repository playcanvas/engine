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

uniform MEDP float font_sdfIntensity; // intensity is used to boost the value read from the SDF, 0 is no boost, 1.0 is max boost
uniform MEDP float font_pxrange;      // the number of pixels between inside and outside the font in SDF
uniform MEDP float font_textureWidth; // the width of the texture atlas

uniform MEDP vec4 outline_color;
uniform MEDP float outline_thickness;
uniform MEDP vec4 shadow_color;
uniform MEDP vec2 shadow_offset;

vec4 applyMsdf(vec4 color) {
    // sample the field
    MEDP vec3 tsample = texture2D(texture_msdfMap, vUv0).rgb;
    MEDP vec2 uvShdw = vUv0 - shadow_offset;
    MEDP vec3 ssample = texture2D(texture_msdfMap, uvShdw).rgb;
    // get the signed distance value
    MEDP float sigDist = median(tsample.r, tsample.g, tsample.b);
    MEDP float sigDistShdw = median(ssample.r, ssample.g, ssample.b);

    #ifdef USE_FWIDTH
    // smoothing depends on size of texture on screen
    MEDP vec2 w = fwidth(vUv0);
    MEDP float smoothing = clamp(w.x * font_textureWidth / font_pxrange, 0.0, 0.5);
    #else
    MEDP float font_size = 16.0; // TODO fix this
    // smoothing gets smaller as the font size gets bigger
    // don't have fwidth we can approximate from font size, this doesn't account for scaling
    // so a big font scaled down will be wrong...
    MEDP float smoothing = clamp(font_pxrange / font_size, 0.0, 0.5);
    #endif

    MEDP float mapMin = 0.05;
    MEDP float mapMax = clamp(1.0 - font_sdfIntensity, mapMin, 1.0);

    // remap to a smaller range (used on smaller font sizes)
    MEDP float sigDistInner = map(mapMin, mapMax, sigDist);
    MEDP float sigDistOutline = map(mapMin, mapMax, sigDist + outline_thickness);
    sigDistShdw = map(mapMin, mapMax, sigDistShdw + outline_thickness);

    MEDP float center = 0.5;
    // calculate smoothing and use to generate opacity
    MEDP float inside = smoothstep(center-smoothing, center+smoothing, sigDistInner);
    MEDP float outline = smoothstep(center-smoothing, center+smoothing, sigDistOutline);
    MEDP float shadow = smoothstep(center-smoothing, center+smoothing, sigDistShdw);

    MEDP vec4 tcolor = (outline > inside) ? outline * vec4(outline_color.a * outline_color.rgb, outline_color.a) : vec4(0.0);
    tcolor = mix(tcolor, color, inside);

    MEDP vec4 scolor = (shadow > outline) ? shadow * vec4(shadow_color.a * shadow_color.rgb, shadow_color.a) : tcolor;
    tcolor = mix(scolor, tcolor, outline);
    
    return tcolor;
}