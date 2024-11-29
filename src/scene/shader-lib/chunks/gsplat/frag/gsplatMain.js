export default /* glsl */`
#include "gsplatEvalPS"

varying mediump vec2 texCoord;
varying mediump vec4 color;

void main(void)
{
    gl_FragColor = evalSplat(texCoord, color);
}
`;
