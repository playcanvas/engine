// Copies one lens flare shape texture into a layer of the shape texture array, at the resolution
// of the array. The shape is stored with a square root encoding, which keeps precision in its dark
// tail and which the sprite shader squares back.
export default /* glsl */`
    uniform sampler2D lensFlareShapeImage;

    varying vec2 uv0;

    void main(void) {
        vec4 image = texture2D(lensFlareShapeImage, uv0);
        gl_FragColor = vec4(sqrt(clamp(image.rgb, 0.0, 1.0)), image.a);
    }
`;
