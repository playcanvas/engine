export default /* glsl */`
#ifdef DEBUG_LIGHTING_PASS
litShaderArgs_albedo = vec3(0.5);
#endif

#ifdef DEBUG_UV0_PASS
#ifdef VARYING_VUV0
litShaderArgs_albedo = vec3(vUv0, 0);
#else
litShaderArgs_albedo = vec3(0);
#endif
#endif
`;
