export default /* wgsl */`
// the chunk can be included more than once - by several effects of one composition
#ifndef _REVERSIBLETONEMAP_INCLUDED_
#define _REVERSIBLETONEMAP_INCLUDED_

// A reversible tone mapping (Karis), compressing an HDR color into the 0 - 1 range by its largest
// component. Filtering or blending HDR colors compressed by it keeps a bright sample from dominating
// the result, as it would in linear HDR, where the tone mapping then displays the average of a
// bright and a dark sample nearly as bright as the bright one. Expanding the result restores the HDR
// range. Apply it to the exposed color, the one the tone mapping is applied to.
fn reversibleTonemap(color: vec3f) -> vec3f {
    return color / (1.0 + max(color.r, max(color.g, color.b)));
}

fn reversibleTonemapInverse(color: vec3f) -> vec3f {
    return color / max(1.0 - max(color.r, max(color.g, color.b)), 1e-4);
}

#endif
`;
