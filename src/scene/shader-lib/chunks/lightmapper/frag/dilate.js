export default /* glsl */`

varying vec2 vUv0;

uniform sampler2D source;
uniform vec2 pixelOffset;

void main(void) {
    vec4 c = texture2DLodEXT(source, vUv0, 0.0);
    c = c.a>0.0? c : texture2DLodEXT(source, vUv0 - pixelOffset, 0.0);
    c = c.a>0.0? c : texture2DLodEXT(source, vUv0 + vec2(0, -pixelOffset.y), 0.0);
    c = c.a>0.0? c : texture2DLodEXT(source, vUv0 + vec2(pixelOffset.x, -pixelOffset.y), 0.0);
    c = c.a>0.0? c : texture2DLodEXT(source, vUv0 + vec2(-pixelOffset.x, 0), 0.0);
    c = c.a>0.0? c : texture2DLodEXT(source, vUv0 + vec2(pixelOffset.x, 0), 0.0);
    c = c.a>0.0? c : texture2DLodEXT(source, vUv0 + vec2(-pixelOffset.x, pixelOffset.y), 0.0);
    c = c.a>0.0? c : texture2DLodEXT(source, vUv0 + vec2(0, pixelOffset.y), 0.0);
    c = c.a>0.0? c : texture2DLodEXT(source, vUv0 + pixelOffset, 0.0);
    gl_FragColor = c;
}
`;
