   gl_FragColor.rgb = combineColor();
   gl_FragColor.rgb += getEmission();
   gl_FragColor.rgb = addFog(gl_FragColor.rgb);
   #ifndef HDR
    gl_FragColor.rgb = toneMap(gl_FragColor.rgb);
    gl_FragColor.rgb = gammaCorrectOutput(gl_FragColor.rgb);
   #endif
