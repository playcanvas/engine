export default /* wgsl */`

#ifndef _DETAILMODES_INCLUDED_
#define _DETAILMODES_INCLUDED_

fn detailMode_mul(c1: vec3f, c2: vec3f) -> vec3f {
    return c1 * c2;
}

fn detailMode_add(c1: vec3f, c2: vec3f) -> vec3f {
    return c1 + c2;
}

// https://en.wikipedia.org/wiki/Blend_modes#Screen
fn detailMode_screen(c1: vec3f, c2: vec3f) -> vec3f {
    return 1.0 - (1.0 - c1)*(1.0 - c2);
}

// https://en.wikipedia.org/wiki/Blend_modes#Overlay
fn detailMode_overlay(c1: vec3f, c2: vec3f) -> vec3f {
    return mix(1.0 - 2.0 * (1.0 - c1)*(1.0 - c2), 2.0 * c1 * c2, step(c1, vec3f(0.5)));
}

fn detailMode_min(c1: vec3f, c2: vec3f) -> vec3f {
    return min(c1, c2);
}

fn detailMode_max(c1: vec3f, c2: vec3f) -> vec3f {
    return max(c1, c2);
}

#endif
`;
