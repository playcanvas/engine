
vec4 dirLm = texture2D(texture_dirLightMap, vUv1);

//gl_FragColor.rgb = mix(dLightDirNormW*saturate(dAtten*100000000.0) * 0.5 + vec3(0.5), dirLm.xyz, saturate(dirLm.w*1000000.0));

float outMask = distance(light0_position, vPositionW) - light0_radius;
const float featherDist = 0.5;
outMask = 1.0 - saturate(outMask / featherDist);

//gl_FragColor.rgb = dLightDirNormW * saturate(dAtten*100000000.0) * (1.0 - dirLm.w) * 0.5 + vec3(0.5) + dirLm.xyz;
gl_FragColor.rgb = mix(dLightDirNormW*saturate(dAtten*100000000.0) * 0.5 + vec3(0.5), dirLm.xyz, dirLm.w);

gl_FragColor.a = saturate(dAtten*100000000.0 * (1.0-dirLm.w) + dirLm.w + outMask);


