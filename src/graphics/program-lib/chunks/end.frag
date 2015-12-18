   gl_FragColor.rgb = combineColor(data);
   gl_FragColor.rgb += getEmission(data);
   gl_FragColor.rgb = addFog(data, gl_FragColor.rgb);
   gl_FragColor.rgb = toneMap(gl_FragColor.rgb);
   gl_FragColor.rgb = gammaCorrectOutput(gl_FragColor.rgb);
