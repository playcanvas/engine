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

uniform UMEDP float font_sdfIntensity; // intensity is used to boost the value read from the SDF, 0 is no boost, 1.0 is max boost
uniform UMEDP float font_pxrange;      // the number of pixels between inside and outside the font in SDF
uniform UMEDP float font_textureWidth; // the width of the texture atlas

uniform UMEDP vec4 outline_color;
uniform UMEDP float outline_thickness;
uniform UMEDP vec4 shadow_color;
uniform UMEDP vec2 shadow_offset;

vec4 applyMsdf(vec4 color) {
    // sample the field
    UMEDP vec3 tsample = texture2D(texture_msdfMap, vUv0).rgb;
    UMEDP vec2 uvShdw = vUv0 - shadow_offset;
    UMEDP vec3 ssample = texture2D(texture_msdfMap, uvShdw).rgb;
    // get the signed distance value
    UMEDP float sigDist = median(tsample.r, tsample.g, tsample.b);
    UMEDP float sigDistShdw = median(ssample.r, ssample.g, ssample.b);

    #ifdef USE_FWIDTH
    // smoothing depends on size of texture on screen
    UMEDP vec2 w = fwidth(vUv0);
    UMEDP float smoothing = clamp(w.x * font_textureWidth / font_pxrange, 0.0, 0.5);
    #else
    UMEDP float font_size = 16.0; // TODO fix this
    // smoothing gets smaller as the font size gets bigger
    // don't have fwidth we can approximate from font size, this doesn't account for scaling
    // so a big font scaled down will be wrong...
    UMEDP float smoothing = clamp(font_pxrange / font_size, 0.0, 0.5);
    #endif

    UMEDP float mapMin = 0.05;
    UMEDP float mapMax = clamp(1.0 - font_sdfIntensity, mapMin, 1.0);

    // remap to a smaller range (used on smaller font sizes)
    UMEDP float sigDistInner = map(mapMin, mapMax, sigDist);
    UMEDP float sigDistOutline = map(mapMin, mapMax, sigDist + outline_thickness);
    sigDistShdw = map(mapMin, mapMax, sigDistShdw + outline_thickness);

    UMEDP float center = 0.5;
    // calculate smoothing and use to generate opacity
    UMEDP float inside = smoothstep(center-smoothing, center+smoothing, sigDistInner);
    UMEDP float outline = smoothstep(center-smoothing, center+smoothing, sigDistOutline);
    UMEDP float shadow = smoothstep(center-smoothing, center+smoothing, sigDistShdw);

    UMEDP vec4 tcolor = (outline > inside) ? outline * vec4(outline_color.a * outline_color.rgb, outline_color.a) : vec4(0.0);
    tcolor = mix(tcolor, color, inside);

    UMEDP vec4 scolor = (shadow > outline) ? shadow * vec4(shadow_color.a * shadow_color.rgb, shadow_color.a) : tcolor;
    tcolor = mix(scolor, tcolor, outline);
    
    return tcolor;
}