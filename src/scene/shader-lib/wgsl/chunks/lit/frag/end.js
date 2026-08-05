export default /* wgsl */`
    var finalRgb: vec3f = combineColor(litArgs_albedo, litArgs_sheen_specularity, litArgs_clearcoat_specularity);

    finalRgb = finalRgb + litArgs_emission;
    finalRgb = addFog(finalRgb);
    finalRgb = toneMap(finalRgb);
    finalRgb = gammaCorrectOutput(finalRgb);
    output.color = vec4f(finalRgb, output.color.a);
`;
