/**
 * GLSL shader chunks for the cloud shadows example.
 * These chunks override StandardMaterial to add scrolling cloud shadow modulation.
 */

export const litUserDeclarationPS = /* glsl */ `
    uniform sampler2D cloudShadowTexture;
    uniform vec2 cloudShadowOffset;
    uniform float cloudShadowScale;
    uniform float cloudShadowIntensity;
`;

// Override endPS to apply cloud shadow after combineColor but before emission/fog/tonemap/gamma
export const endPS = /* glsl */ `
    gl_FragColor.rgb = combineColor(litArgs_albedo, litArgs_sheen_specularity, litArgs_clearcoat_specularity);

    vec2 cloudUV = vPositionW.xz * cloudShadowScale + cloudShadowOffset;
    float cloud = texture2D(cloudShadowTexture, cloudUV).r;
    gl_FragColor.rgb *= mix(1.0, cloud, cloudShadowIntensity);

    gl_FragColor.rgb += litArgs_emission;
    gl_FragColor.rgb = addFog(gl_FragColor.rgb);
    gl_FragColor.rgb = toneMap(gl_FragColor.rgb);
    gl_FragColor.rgb = gammaCorrectOutput(gl_FragColor.rgb);
`;
