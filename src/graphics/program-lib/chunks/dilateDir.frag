varying vec2 vUv0;
uniform sampler2D source;
uniform vec2 pixelOffset;
void main(void) {
    vec4 c = texture2D(source, vUv0);
    /*c = (c.r+c.g+c.b)>0.0? c : texture2D(source, vUv0 - pixelOffset);
    c = (c.r+c.g+c.b)>0.0? c : texture2D(source, vUv0 + vec2(0, -pixelOffset.y));
    c = (c.r+c.g+c.b)>0.0? c : texture2D(source, vUv0 + vec2(pixelOffset.x, -pixelOffset.y));
    c = (c.r+c.g+c.b)>0.0? c : texture2D(source, vUv0 + vec2(-pixelOffset.x, 0));
    c = (c.r+c.g+c.b)>0.0? c : texture2D(source, vUv0 + vec2(pixelOffset.x, 0));
    c = (c.r+c.g+c.b)>0.0? c : texture2D(source, vUv0 + vec2(-pixelOffset.x, pixelOffset.y));
    c = (c.r+c.g+c.b)>0.0? c : texture2D(source, vUv0 + vec2(0, pixelOffset.y));
    c = (c.r+c.g+c.b)>0.0? c : texture2D(source, vUv0 + pixelOffset);*/
    gl_FragColor = c;
}

