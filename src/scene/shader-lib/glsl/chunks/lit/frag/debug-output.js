export default /* glsl */`
#ifdef DEBUG_ALBEDO_PASS
gl_FragColor = vec4(gammaCorrectOutput(dAlbedo), 1.0);
#endif

// magnopus patched
#ifdef LOD_PASS
if (lod_level == 0) {
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
} else if (lod_level == 1) {
  gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0);
} else if (lod_level == 2) {
  gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);
} else if (lod_level == 3) {
  gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);
}
#endif

#ifdef DEBUG_UV0_PASS
gl_FragColor = vec4(litArgs_albedo , 1.0);
#endif

#ifdef DEBUG_WORLD_NORMAL_PASS
gl_FragColor = vec4(litArgs_worldNormal * 0.5 + 0.5, 1.0);
#endif

#ifdef DEBUG_OPACITY_PASS
gl_FragColor = vec4(vec3(litArgs_opacity) , 1.0);
#endif

#ifdef DEBUG_SPECULARITY_PASS
gl_FragColor = vec4(litArgs_specularity, 1.0);
#endif

#ifdef DEBUG_GLOSS_PASS
gl_FragColor = vec4(vec3(litArgs_gloss) , 1.0);
#endif

#ifdef DEBUG_METALNESS_PASS
gl_FragColor = vec4(vec3(litArgs_metalness) , 1.0);
#endif

#ifdef DEBUG_AO_PASS
gl_FragColor = vec4(vec3(litArgs_ao) , 1.0);
#endif

#ifdef DEBUG_EMISSION_PASS
gl_FragColor = vec4(gammaCorrectOutput(litArgs_emission), 1.0);
#endif
`;
