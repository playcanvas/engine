export default /* glsl */`

varying vec2 vUv0;

uniform sampler2D source;
uniform vec2 pixelOffset;

bool isUsed(vec4 pixel) {
    #if HDR
        return any(greaterThan(pixel.rgb, vec3(0.0)));
    #else
        return pixel.a > 0.0;
    #endif
}

void main(void) {
    vec4 c = texture2DLod(source, vUv0, 0.0);
    c = isUsed(c) ? c : texture2DLod(source, vUv0 - pixelOffset, 0.0);
    c = isUsed(c) ? c : texture2DLod(source, vUv0 + vec2(0, -pixelOffset.y), 0.0);
    c = isUsed(c) ? c : texture2DLod(source, vUv0 + vec2(pixelOffset.x, -pixelOffset.y), 0.0);
    c = isUsed(c) ? c : texture2DLod(source, vUv0 + vec2(-pixelOffset.x, 0), 0.0);
    c = isUsed(c) ? c : texture2DLod(source, vUv0 + vec2(pixelOffset.x, 0), 0.0);
    c = isUsed(c) ? c : texture2DLod(source, vUv0 + vec2(-pixelOffset.x, pixelOffset.y), 0.0);
    c = isUsed(c) ? c : texture2DLod(source, vUv0 + vec2(0, pixelOffset.y), 0.0);
    c = isUsed(c) ? c : texture2DLod(source, vUv0 + pixelOffset, 0.0);
    gl_FragColor = c;
}
`;
