export default /* glsl */`
#ifdef PCOUTLINE_PASS
gl_FragColor.rgb = gammaCorrectOutput(pcOutlineColor);
#endif
`;
