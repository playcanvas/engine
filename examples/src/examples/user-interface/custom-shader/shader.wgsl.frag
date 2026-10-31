
// A radial cooldown: a circle the size of the element, whose shaded part shrinks clockwise from
// twelve o'clock as the cooldown runs out.

#include "gammaPS"

varying vUv0: vec2f;

// the fraction of the cooldown that is left, from 1 down to 0
uniform uProgress: f32;

// the color and opacity of the shading, in linear space
uniform uColor: vec4f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    // the position from the center, with y up: v runs down the element
    let p = vec2f(input.vUv0.x - 0.5, 0.5 - input.vUv0.y);
    let r = length(p);

    // the circle, with an edge a pixel wide
    let inside = 1.0 - smoothstep(0.5 - fwidth(r), 0.5, r);

    // the angle clockwise from twelve o'clock, from 0 to 1, and whether it is still shaded
    let angle = fract(atan2(p.x, p.y) / 6.28318530718 + 1.0);
    let shaded = step(1.0 - uniform.uProgress, angle);

    output.color = vec4f(gammaCorrectOutput(uniform.uColor.rgb), uniform.uColor.a * inside * shaded);
    return output;
}
