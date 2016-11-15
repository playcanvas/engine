
    gl_FragColor.rgb *= saturate(gammaCorrectInput(a));
    if ((gl_FragColor.r + gl_FragColor.g + gl_FragColor.b) < 0.000001) discard;

