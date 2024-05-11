
precision lowp float;
varying vec4 outColor;

void main(void)
{
    // just output color supplied by vertex shader
    gl_FragColor = outColor;
}