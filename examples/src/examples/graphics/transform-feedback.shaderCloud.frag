
// fragment shader used to render point sprite particles
precision mediump float;
varying vec4 outColor;

void main(void)
{
    // color supplied by vertex shader
    gl_FragColor = outColor;
}