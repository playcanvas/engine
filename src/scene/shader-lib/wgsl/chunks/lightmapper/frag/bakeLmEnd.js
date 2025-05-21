export default /* wgsl */`

#ifdef LIT_LIGHTMAP_BAKING_ADD_AMBIENT
    // diffuse light stores accumulated AO, apply contrast and brightness to it
    // and multiply ambient light color by the AO
    dDiffuseLight = ((dDiffuseLight - 0.5) * max(uniform.ambientBakeOcclusionContrast + 1.0, 0.0)) + 0.5;
    dDiffuseLight = dDiffuseLight + vec3f(uniform.ambientBakeOcclusionBrightness);
    dDiffuseLight = saturate3(dDiffuseLight);
    dDiffuseLight = dDiffuseLight * dAmbientLight;
#endif

#ifdef LIGHTMAP_RGBM
    // encode to RGBM
    var temp_color_rgbm = vec4f(dDiffuseLight, 1.0);
    temp_color_rgbm = vec4f(pow(temp_color_rgbm.rgb, vec3f(0.5)), temp_color_rgbm.a);
    temp_color_rgbm = vec4f(temp_color_rgbm.rgb / 8.0, temp_color_rgbm.a);
    let max_g_b = max(temp_color_rgbm.g, max(temp_color_rgbm.b, 1.0 / 255.0));
    let max_rgb = max(temp_color_rgbm.r, max_g_b);
    temp_color_rgbm.a = clamp(max_rgb, 0.0, 1.0);
    temp_color_rgbm.a = ceil(temp_color_rgbm.a * 255.0) / 255.0;
    temp_color_rgbm = vec4f(temp_color_rgbm.rgb / temp_color_rgbm.a, temp_color_rgbm.a);
    output.color = temp_color_rgbm;
#else
    output.color = vec4f(dDiffuseLight, 1.0);
#endif
`;
