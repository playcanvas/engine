export default /* wgsl */`
var texture_msdfMap: texture_2d<f32>;
var texture_msdfMapSampler: sampler;

fn median(r: f32, g: f32, b: f32) -> f32 {
    return max(min(r, g), min(max(r, g), b));
}

fn map(min: f32, max: f32, v: f32) -> f32 {
    return (v - min) / (max - min);
}

uniform font_sdfIntensity: f32; // intensity is used to boost the value read from the SDF, 0 is no boost, 1.0 is max boost
uniform font_pxrange: f32;      // the number of pixels between inside and outside the font in SDF
uniform font_textureWidth: f32; // the width of the texture atlas

#ifndef LIT_MSDF_TEXT_ATTRIBUTE
    uniform outline_color: vec4f;
    uniform outline_thickness: f32;
    uniform shadow_color: vec4f;
    uniform shadow_offset: vec2f;
#else
    varying outline_color: vec4f;
    varying outline_thickness: f32;
    varying shadow_color: vec4f;
    varying shadow_offset: vec2f;
#endif

fn applyMsdf(color_in: vec4f) -> vec4f {

    #ifndef LIT_MSDF_TEXT_ATTRIBUTE
        var outline_colorValue = uniform.outline_color;
        var outline_thicknessValue = uniform.outline_thickness;
        var shadow_colorValue = uniform.shadow_color;
        var shadow_offsetValue = uniform.shadow_offset;
    #else
        var outline_colorValue = outline_color;
        var outline_thicknessValue = outline_thickness;
        var shadow_colorValue = shadow_color;
        var shadow_offsetValue = shadow_offset;
    #endif

    // Convert to linear space before processing
    // TODO: ideally this would receive the color in linear space, but that would require larger changes
    // on the engine side, with the way premultiplied alpha is handled as well.
    var color = vec4f(gammaCorrectInputVec3(color_in.rgb), color_in.a);

#if GAMMA == NONE
    // uniform color is linear, but with gamma 1.0, we want sRGB pass-through, so convert back to sRGB
    color = vec4f(pow(color.rgb + 0.0000001, vec3f(1.0 / 2.2)), color.a);
#endif

    // sample the field
    let tsample: vec3f = textureSample(texture_msdfMap, texture_msdfMapSampler, vUv0).rgb;
    let uvShdw: vec2f = vUv0 - shadow_offsetValue;
    let ssample: vec3f = textureSample(texture_msdfMap, texture_msdfMapSampler, uvShdw).rgb;

    // get the signed distance value
    let sigDist: f32 = median(tsample.r, tsample.g, tsample.b);
    var sigDistShdw: f32 = median(ssample.r, ssample.g, ssample.b);

    // smoothing limit - smaller value makes for sharper but more aliased text, especially on angles
    // too large value (0.5) creates a dark glow around the letters
    let smoothingMax: f32 = 0.2;

    // smoothing depends on size of texture on screen
    let w: vec2f = abs(dpdx(vUv0)) + abs(dpdy(vUv0));
    let smoothing: f32 = clamp(w.x * uniform.font_textureWidth / uniform.font_pxrange, 0.0, smoothingMax);

    let mapMin: f32 = 0.05;
    let mapMax: f32 = clamp(1.0 - uniform.font_sdfIntensity, mapMin, 1.0);

    // remap to a smaller range (used on smaller font sizes)
    let sigDistInner: f32 = map(mapMin, mapMax, sigDist);
    let sigDistOutline: f32 = map(mapMin, mapMax, sigDist + outline_thicknessValue);
    sigDistShdw = map(mapMin, mapMax, sigDistShdw + outline_thicknessValue);

    let center: f32 = 0.5;
    // calculate smoothing and use to generate opacity
    let inside: f32 = smoothstep(center - smoothing, center + smoothing, sigDistInner);
    let outline: f32 = smoothstep(center - smoothing, center + smoothing, sigDistOutline);
    let shadow: f32 = smoothstep(center - smoothing, center + smoothing, sigDistShdw);

    let tcolor_outline: vec4f = outline * vec4f(outline_colorValue.a * outline_colorValue.rgb, outline_colorValue.a);
    var tcolor: vec4f = select(vec4f(0.0), tcolor_outline, outline > inside);
    tcolor = mix(tcolor, color, inside);

    let scolor_shadow: vec4f = shadow * vec4f(shadow_colorValue.a * shadow_colorValue.rgb, shadow_colorValue.a);
    let scolor: vec4f = select(tcolor, scolor_shadow, shadow > outline);
    tcolor = mix(scolor, tcolor, outline);

    // Convert back to gamma space before returning
    tcolor = vec4f(gammaCorrectOutput(tcolor.rgb), tcolor.a);

    return tcolor;
}
`;
