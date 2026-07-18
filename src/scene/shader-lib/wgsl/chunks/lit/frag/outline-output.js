export default /* wgsl */`
#ifdef PCOUTLINE_PASS
output.color = vec4f(gammaCorrectOutput(uniform.pcOutlineColor), output.color.a);
#endif
`;
