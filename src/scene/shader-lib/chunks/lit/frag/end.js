export default /* glsl */`
    gl_FragColor.rgb = combineColor(frontend);

    gl_FragColor.rgb += frontend.emission;
    gl_FragColor.rgb = addFog(gl_FragColor.rgb);

    #ifndef HDR
    gl_FragColor.rgb = toneMap(gl_FragColor.rgb);
    gl_FragColor.rgb = gammaCorrectOutput(gl_FragColor.rgb);
    #endif
`;
