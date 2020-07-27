void main(void) {
    dDiffuseLight = vec3(0);
    dSpecularLight = vec3(0);
    dReflection = vec4(0);
    dSpecularity = vec3(0);

    #ifdef CLEARCOAT
    ccSpecularLight = vec3(0);
    ccReflection = vec4(0);
    ccSpecularity = vec3(0);
    #endif
