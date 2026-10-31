// fragment shader used to render point sprite particles
varying vec4 outColor;

void main(void)
{
    // color supplied by vertex shader
    gl_FragColor = outColor;
}