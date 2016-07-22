
vec4 dirLm = texture2D(texture_dirLightMap, vUv1);

//gl_FragColor.rgb = mix(dLightDirNormW*saturate(dAtten*100000000.0) * 0.5 + vec3(0.5), dirLm.xyz, saturate(dirLm.w*1000000.0));

/*float outMask = distance(light0_position, vPositionW) - light0_radius;
const float featherDist = 0.5;
outMask = 1.0 - saturate(outMask / featherDist);

float base = saturate(dAtten*100000000.0 + outMask);
float blend = dirLm.w;
gl_FragColor.a = abs(base - blend);

base = gl_FragColor.a * base * (1.0-blend);

//gl_FragColor.rgb = dLightDirNormW * saturate(dAtten*100000000.0) * (1.0 - dirLm.w) * 0.5 + vec3(0.5) + dirLm.xyz;
gl_FragColor.rgb = mix(dirLm.xyz, dLightDirNormW*saturate(dAtten*100000000.0) * 0.5 + vec3(0.5), base);*/

//gl_FragColor.a = saturate(saturate(dAtten*100000000.0 + outMask) * (1.0-dirLm.w) + dirLm.w);


dTBN = mat3(normalize(vTangentW), normalize(vBinormalW), normalize(vNormalW));
dLightDirNormW = dLightDirNormW * dTBN; // world to tangent


dAtten = saturate(dAtten);
float mask = saturate(dAtten*100000000.0);

gl_FragColor.rgb = dAtten > dirLm.w? (dLightDirNormW * mask * 0.5 + vec3(0.5)) : dirLm.xyz;
gl_FragColor.a = dAtten > dirLm.w? dAtten : dirLm.w;
if (mask > 0.00001) gl_FragColor.a = max(gl_FragColor.a, 1.0 / 255.0);

