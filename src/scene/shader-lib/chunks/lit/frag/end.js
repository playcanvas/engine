export default /* glsl */`
    gl_FragColor.rgb = combineColor(litShaderArgs_albedo, litShaderArgs_sheen_specularity, litShaderArgs_clearcoat_specularity);

    gl_FragColor.rgb += litShaderArgs_emission;
    gl_FragColor.rgb = addFog(gl_FragColor.rgb);

    #ifndef HDR
    gl_FragColor.rgb = toneMap(gl_FragColor.rgb);
    gl_FragColor.rgb = gammaCorrectOutput(gl_FragColor.rgb);
    #endif
`;
