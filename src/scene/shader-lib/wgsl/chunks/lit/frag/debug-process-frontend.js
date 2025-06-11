export default /* wgsl */`
#ifdef DEBUG_LIGHTING_PASS
    litArgs_albedo = vec3f(0.5);
#endif

#ifdef DEBUG_UV0_PASS
#ifdef VARYING_VUV0
    litArgs_albedo = vec3f(vUv0, 0.0);
#else
    litArgs_albedo = vec3f(0.0);
#endif
#endif
`;
