
// A radial cooldown: a circle the size of the element, whose shaded part shrinks clockwise from
// twelve o'clock as the cooldown runs out.

#include "gammaPS"

varying vec2 vUv0;

// the fraction of the cooldown that is left, from 1 down to 0
uniform float uProgress;

// the color and opacity of the shading, in linear space
uniform vec4 uColor;

void main(void) {
    // the position from the center, with y up: v runs down the element
    vec2 p = vec2(vUv0.x - 0.5, 0.5 - vUv0.y);
    float r = length(p);

    // the circle, with an edge a pixel wide
    float inside = 1.0 - smoothstep(0.5 - fwidth(r), 0.5, r);

    // the angle clockwise from twelve o'clock, from 0 to 1, and whether it is still shaded
    float angle = fract(atan(p.x, p.y) / 6.28318530718 + 1.0);
    float shaded = step(1.0 - uProgress, angle);

    gl_FragColor = vec4(gammaCorrectOutput(uColor.rgb), uColor.a * inside * shaded);
}
