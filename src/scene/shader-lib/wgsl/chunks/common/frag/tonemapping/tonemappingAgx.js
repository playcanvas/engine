// AgX, following Filament's implementation, which uses the matrices of Blender's AgX:
// https://github.com/google/filament/blob/0880ea059b9f62f135bd5f5446c9b514326c435d/filament/src/ToneMapper.cpp#L691-L787
// Filament converts linear sRGB to Rec.2020 before its tone mapper and back after it. Here the first
// conversion is folded into the inset matrix. The sigmoid uses the 6th order polynomial fit from
// https://iolite-engine.com/blog_posts/minimal_agx_implementation, which reaches white at the top of
// the curve, where the 7th order fit used by Filament stops at 0.98. TONEMAP_AGX_PUNCHY adds Filament's
// Punchy look, with the luminance for the saturation taken after the power, as corrected in iolite's post.
export default /* wgsl */`

// linear sRGB to Rec.2020, followed by the AgX inset matrix
const agxInsetMatrix: mat3x3f = mat3x3f(
    vec3f(0.5449046634, 0.1404396285, 0.0888268956),
    vec3f(0.3737799450, 0.7541105648, 0.1788773492),
    vec3f(0.0813857278, 0.1054334821, 0.7322502399)
);

const agxOutsetMatrix: mat3x3f = mat3x3f(
    vec3f(1.1271005818, -0.1413297635, -0.1413297635),
    vec3f(-0.1106066431, 1.1578237022, -0.1106066431),
    vec3f(-0.0164939387, -0.0164939387, 1.2519364066)
);

const agxRec2020ToSrgb: mat3x3f = mat3x3f(
    vec3f(1.6602133532, -0.1245520386, -0.0181550265),
    vec3f(-0.5875643107, 1.1329461928, -0.1006047909),
    vec3f(-0.0728275822, -0.0083483300, 1.1188316722)
);

// the log2 range of the AgX curve: middle gray (0.18) from 10 stops below to 6.5 stops above
const agxMinEv: f32 = -12.47393;
const agxMaxEv: f32 = 4.026069;

fn agxContrastApprox(x: vec3f) -> vec3f {
    let x2 = x * x;
    let x4 = x2 * x2;
    return 15.5 * x4 * x2
           - 40.14 * x4 * x
           + 31.96 * x4
           - 6.868 * x2 * x
           + 0.4298 * x2
           + 0.1191 * x
           - vec3f(0.00232);
}

fn toneMap(col: vec3f) -> vec3f {
    var color = agxInsetMatrix * max(col * getExposure(), vec3f(0.0));

    // log2 encoding
    color = clamp((log2(max(color, vec3f(1e-10))) - vec3f(agxMinEv)) / (agxMaxEv - agxMinEv), vec3f(0.0), vec3f(1.0));

    color = agxContrastApprox(color);

    #if TONEMAP == AGX_PUNCHY
        // the Punchy look: an ASC CDL power, then saturation around the luminance
        color = pow(max(color, vec3f(0.0)), vec3f(1.35));
        let luma = dot(color, vec3f(0.2126, 0.7152, 0.0722));
        color = vec3f(luma) + 1.4 * (color - vec3f(luma));
    #endif

    color = agxOutsetMatrix * color;

    // linearize, then back to linear sRGB, clamping the colors outside of its gamut
    color = pow(max(color, vec3f(0.0)), vec3f(2.2));
    return clamp(agxRec2020ToSrgb * color, vec3f(0.0), vec3f(1.0));
}
`;
