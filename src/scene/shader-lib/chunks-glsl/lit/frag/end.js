export default /* glsl */`
    gl_FragColor.rgb = combineColor(litArgs_albedo, litArgs_sheen_specularity, litArgs_clearcoat_specularity);

    gl_FragColor.rgb += litArgs_emission;
    gl_FragColor.rgb = addFog(gl_FragColor.rgb);
    gl_FragColor.rgb = toneMap(gl_FragColor.rgb);
    gl_FragColor.rgb = gammaCorrectOutput(gl_FragColor.rgb);
`;
