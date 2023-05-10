export default /* glsl */`
#ifdef DEBUG_ALBEDO_PASS
gl_FragColor = vec4(gammaCorrectOutput(litShaderArgs.albedo), 1.0);
#endif

#ifdef DEBUG_UV0_PASS
gl_FragColor = vec4(litShaderArgs.albedo , 1.0);
#endif

#ifdef DEBUG_WORLD_NORMAL_PASS
gl_FragColor = vec4(litShaderArgs.worldNormal * 0.5 + 0.5, 1.0);
#endif

#ifdef DEBUG_OPACITY_PASS
gl_FragColor = vec4(vec3(litShaderArgs.opacity) , 1.0);
#endif

#ifdef DEBUG_SPECULARITY_PASS
gl_FragColor = vec4(litShaderArgs.specularity, 1.0);
#endif

#ifdef DEBUG_GLOSS_PASS
gl_FragColor = vec4(vec3(litShaderArgs.gloss) , 1.0);
#endif

#ifdef DEBUG_METALNESS_PASS
gl_FragColor = vec4(vec3(litShaderArgs.metalness) , 1.0);
#endif

#ifdef DEBUG_AO_PASS
gl_FragColor = vec4(vec3(litShaderArgs.ao) , 1.0);
#endif

#ifdef DEBUG_EMISSION_PASS
gl_FragColor = vec4(gammaCorrectOutput(litShaderArgs.emission), 1.0);
#endif
`;
