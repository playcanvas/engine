// Shades a lens flare element with its shape, read from the layer of the shape texture array the
// element uses, tinted by the colour its vertex shader resolved. The result is added to the flare
// texture.
export default /* glsl */`
    uniform sampler2DArray lensFlareShapes;

    varying vec2 vUv0;
    varying vec3 vColor;
    varying float vLayer;

    void main(void) {
        vec4 shape = texture(lensFlareShapes, vec3(getImageEffectUV(vUv0), vLayer));

        // undo the square root encoding of the baked shape
        vec3 value = shape.rgb * shape.rgb * shape.a;
        gl_FragColor = vec4(value * vColor, 1.0);
    }
`;
