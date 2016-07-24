
    vec4 dirLm = texture2D(texture_dirLightMap, vUv1);
    dirLm.xyz = dirLm.xyz * 2.0 - vec3(1.0);

    dAtten = saturate(dAtten);

    gl_FragColor.rgb = normalize(dLightDirNormW.xyz*dAtten + dirLm.xyz*dirLm.w) * 0.5 + vec3(0.5);
    gl_FragColor.a = dirLm.w + dAtten;
    if (gl_FragColor.a > 0.000001) gl_FragColor.a = max(gl_FragColor.a, 1.0 / 255.0);

