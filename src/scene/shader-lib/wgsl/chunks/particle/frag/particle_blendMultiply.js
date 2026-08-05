export default /* wgsl */`
    rgb = mix(vec3f(1.0), rgb, a);
    if ((rgb.r + rgb.g + rgb.b) > 2.99) {
        discard;
    }
`;
