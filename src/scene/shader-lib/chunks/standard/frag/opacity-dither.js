export default /* glsl */`
void opacityDither(float alpha) {
    if (alpha <= bayer8(floor(mod(gl_FragCoord.xy, 8.0))) / 64.0)
        discard;
}
`;
