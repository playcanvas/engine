#include "gammaPS"

varying float vertOutTexCoord;
varying vec2 texCoord;
void main(void)
{
    float v = vertOutTexCoord;
    v = float(int(v * 6.0)) / 6.0;
    vec3 linearColor = vec3(0.218, 0.190, 0.156) * v;
    gl_FragColor.rgb = gammaCorrectOutput(linearColor.rgb);
    gl_FragColor.a = 1.0;
}
