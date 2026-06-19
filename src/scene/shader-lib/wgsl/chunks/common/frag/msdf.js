export default /* wgsl */`
var texture_msdfMap: texture_2d<f32>;
var texture_msdfMapSampler: sampler;

fn median(r: f32, g: f32, b: f32) -> f32 {
    return max(min(r, g), min(max(r, g), b));
}

uniform font_sdfIntensity: f32; // intensity is used to boost the value read from the SDF, 0 is no boost, 1.0 is max boost

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

    // sample the field
    let tsample: vec3f = textureSample(texture_msdfMap, texture_msdfMapSampler, vUv0).rgb;
    let uvShdw: vec2f = vUv0 - shadow_offsetValue;
    let ssample: vec3f = textureSample(texture_msdfMap, texture_msdfMapSampler, uvShdw).rgb;

    // get the signed distance value
    let sigDist: f32 = median(tsample.r, tsample.g, tsample.b);
    let sigDistShdw: f32 = median(ssample.r, ssample.g, ssample.b);

    // Coverage threshold. font_sdfIntensity fattens the glyph; 0 renders at the true glyph
    // edge (median == 0.5). A previous fixed 0.05 erosion biased this to ~0.525, which carved
    // holes and notches at thin junctions (e.g. the 'f' crossbar and the 'x' crossing).
    let edge: f32 = 0.5 - 0.5 * uniform.font_sdfIntensity;

    // Anti-alias from the gradient of the distance field itself, giving a ~1 pixel coverage
    // ramp that is correct for edges of any orientation. The previous smoothing was derived
    // from the horizontal uv derivative only, under-anti-aliasing diagonal and horizontal edges.
    let aa: f32 = max(abs(dpdx(sigDist)) + abs(dpdy(sigDist)), 1e-4);

    let inside: f32 = clamp((sigDist - edge) / aa + 0.5, 0.0, 1.0);
    let outline: f32 = clamp((sigDist + outline_thicknessValue - edge) / aa + 0.5, 0.0, 1.0);
    let shadow: f32 = clamp((sigDistShdw + outline_thicknessValue - edge) / aa + 0.5, 0.0, 1.0);

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
