export default /* glsl */`
#ifdef DEBUG_LIGHTING_PASS
litArgs_albedo = vec3(0.5);
#ifdef LIT_DIFFUSE_TRANSMISSION
litArgs_diffuseTransmission_color = vec3(0.5);
#endif
#endif

#ifdef DEBUG_UV0_PASS
#ifdef VARYING_VUV0
litArgs_albedo = vec3(vUv0, 0);
#else
litArgs_albedo = vec3(0);
#endif
#endif
`;
