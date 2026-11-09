#include "gammaPS"

varying vec2 vUv0;
varying float vLayer;

uniform mediump sampler2DArray uImpostorMap;

void main(void)
{
    vec4 color = texture(uImpostorMap, vec3(vUv0, floor(vLayer + 0.5)));
    if (color.a < 0.5) {
        discard;
    }

    // the mip levels blend the statue with the transparent black background, un-premultiply the
    // color to avoid dark edges in the distance
    gl_FragColor = vec4(gammaCorrectOutput(color.rgb / color.a), 1.0);
}
