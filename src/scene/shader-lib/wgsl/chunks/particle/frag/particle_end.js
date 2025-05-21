export default /* wgsl */`
    rgb = addFog(rgb);
    rgb = toneMap(rgb);
    rgb = gammaCorrectOutput(rgb);
    output.color = vec4f(rgb, a);
    return output;
}
`;
