#ifdef CLEARCOAT
uniform float material_clearCoatReflectivity;

void addReflectionCC() {
    ccReflection += vec4(envBrdf(vec3(ccSpecularity), ccGlossiness, ccNormalW) * calcReflection(ccReflDirW, ccGlossiness), material_clearCoatReflectivity);
}
#endif
