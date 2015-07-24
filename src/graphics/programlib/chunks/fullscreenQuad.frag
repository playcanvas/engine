varying vec2 vUv0;
uniform sampler2D source;

void main(void) {
    gl_FragColor = texture2D(source, vUv0);
}
