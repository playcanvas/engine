export default /* wgsl */`
#ifdef DEBUG_ALBEDO_PASS
output.color = vec4(gammaCorrectOutput(dAlbedo), 1.0);
#endif

// magnopus patched - start
#ifdef LOD_PASS
if (uniform.lod_level == 0) {
  output.color = vec4f(1.0, 0.0, 0.0, 1.0);
} else if (uniform.lod_level == 1) {
  output.color = vec4f(1.0, 1.0, 0.0, 1.0);
} else if (uniform.lod_level == 2) {
  output.color = vec4f(0.0, 1.0, 1.0, 1.0);
} else if (uniform.lod_level == 3) {
  output.color = vec4f(0.0, 0.0, 1.0, 1.0);
}
#endif
// magnopus patched - end

#ifdef DEBUG_UV0_PASS
output.color = vec4f(litArgs_albedo , 1.0);
#endif

#ifdef DEBUG_WORLD_NORMAL_PASS
output.color = vec4f(litArgs_worldNormal * 0.5 + 0.5, 1.0);
#endif

#ifdef DEBUG_OPACITY_PASS
output.color = vec4f(vec3f(litArgs_opacity) , 1.0);
#endif

#ifdef DEBUG_SPECULARITY_PASS
output.color = vec4f(litArgs_specularity, 1.0);
#endif

#ifdef DEBUG_GLOSS_PASS
output.color = vec4f(vec3f(litArgs_gloss) , 1.0);
#endif

// magnopus patched - start
#ifdef DEBUG_ROUGHNESS_PASS
output.color = vec4f(1.0 - vec3f(litArgs_gloss) , 1.0);
#endif
// magnopus patched - end

#ifdef DEBUG_METALNESS_PASS
output.color = vec4f(vec3f(litArgs_metalness) , 1.0);
#endif

#ifdef DEBUG_AO_PASS
output.color = vec4f(vec3f(litArgs_ao) , 1.0);
#endif

#ifdef DEBUG_EMISSION_PASS
output.color = vec4f(gammaCorrectOutput(litArgs_emission), 1.0);
#endif
`;
