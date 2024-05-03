
precision mediump float;

uniform sampler2D uDiffuseMap;

varying vec2 vUv0;

void main(void)
{
    gl_FragColor = texture2D(uDiffuseMap, vUv0);
}