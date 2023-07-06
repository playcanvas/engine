export default /* glsl */`
#ifdef DEBUG_ALBEDO_PASS
gl_FragColor = vec4(gammaCorrectOutput(litShaderArgs_albedo), 1.0);
#endif

#ifdef DEBUG_UV0_PASS
gl_FragColor = vec4(litShaderArgs_albedo , 1.0);
#endif

#ifdef DEBUG_WORLD_NORMAL_PASS
gl_FragColor = vec4(litShaderArgs_worldNormal * 0.5 + 0.5, 1.0);
#endif

#ifdef DEBUG_OPACITY_PASS
gl_FragColor = vec4(vec3(litShaderArgs_opacity) , 1.0);
#endif

#ifdef DEBUG_SPECULARITY_PASS
gl_FragColor = vec4(litShaderArgs_specularity, 1.0);
#endif

#ifdef DEBUG_GLOSS_PASS
gl_FragColor = vec4(vec3(litShaderArgs_gloss) , 1.0);
#endif

#ifdef DEBUG_METALNESS_PASS
gl_FragColor = vec4(vec3(litShaderArgs_metalness) , 1.0);
#endif

#ifdef DEBUG_AO_PASS
gl_FragColor = vec4(vec3(litShaderArgs_ao) , 1.0);
#endif

#ifdef DEBUG_EMISSION_PASS
gl_FragColor = vec4(gammaCorrectOutput(litShaderArgs_emission), 1.0);
#endif
`;
