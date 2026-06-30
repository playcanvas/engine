export default /* glsl */`
uniform sampler2D texture_msdfMap;

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

uniform float font_sdfIntensity; // intensity is used to boost the value read from the SDF, 0 is no boost, 1.0 is max boost
uniform float font_pxrange;      // number of texels of SDF spread (inside <-> outside) in the atlas

#ifndef LIT_MSDF_TEXT_ATTRIBUTE
    uniform vec4 outline_color;
    uniform float outline_thickness;
    uniform vec4 shadow_color;
    uniform vec2 shadow_offset;
#else
    varying vec4 outline_color;
    varying float outline_thickness;
    varying vec4 shadow_color;
    varying vec2 shadow_offset;
#endif

vec4 applyMsdf(vec4 color) {

    // Convert to linear space before processing
    // TODO: ideally this would receive the color in linear space, but that would require larger changes
    // on the engine side, with the way premultiplied alpha is handled as well.
    color.rgb = gammaCorrectInput(color.rgb);

    // sample the field
    vec3 tsample = texture2D(texture_msdfMap, vUv0).rgb;
    vec2 uvShdw = vUv0 - shadow_offset;
    vec3 ssample = texture2D(texture_msdfMap, uvShdw).rgb;

    // get the signed distance value
    float sigDist = median(tsample.r, tsample.g, tsample.b);
    float sigDistShdw = median(ssample.r, ssample.g, ssample.b);

    // coverage threshold (0.5 = glyph edge); font_sdfIntensity fattens the glyph
    float edge = 0.5 - 0.5 * font_sdfIntensity;

    // Width of the distance-field transition in screen pixels, from the uv magnification (both
    // axes) and the atlas spread. Stable under motion and minification, unlike fwidth(sigDist)
    // whose noise on undersampled glyphs makes small text shimmer. Floored at 1px so minified
    // text keeps a soft ~1px edge rather than a razor one.
    vec2 unitRange = vec2(font_pxrange) / vec2(textureSize(texture_msdfMap, 0));
    float screenPxRange = max(0.5 * dot(unitRange, 1.0 / max(fwidth(vUv0), vec2(1e-6))), 1.0);

    float inside = clamp(screenPxRange * (sigDist - edge) + 0.5, 0.0, 1.0);
    float outline = clamp(screenPxRange * (sigDist + outline_thickness - edge) + 0.5, 0.0, 1.0);
    float shadow = clamp(screenPxRange * (sigDistShdw + outline_thickness - edge) + 0.5, 0.0, 1.0);

    vec4 tcolor = (outline > inside) ? outline * vec4(outline_color.a * outline_color.rgb, outline_color.a) : vec4(0.0);
    tcolor = mix(tcolor, color, inside);

    vec4 scolor = (shadow > outline) ? shadow * vec4(shadow_color.a * shadow_color.rgb, shadow_color.a) : tcolor;
    tcolor = mix(scolor, tcolor, outline);

    // Convert back to gamma space before returning
    tcolor.rgb = gammaCorrectOutput(tcolor.rgb);
    
    return tcolor;
}
`;
