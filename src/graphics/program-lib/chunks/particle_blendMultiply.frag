
    gl_FragColor.rgb = mix(vec3(1.0), gl_FragColor.rgb, vec3(a));
    if (gl_FragColor.r + gl_FragColor.g + gl_FragColor.b > 2.99) discard;

