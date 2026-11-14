#include "gammaPS"

uniform sampler2D uDiffuseMap;

varying vec2 vUv0;

void main(void)
{
    vec4 linearColor = texture2D(uDiffuseMap, vUv0);
    gl_FragColor.rgb = gammaCorrectOutput(linearColor.rgb);
    gl_FragColor.a = 1.0;
}