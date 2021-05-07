#ifdef CLEARCOAT
uniform float material_clearCoatReflectivity;

void addReflectionCC() {
    ccReflection += vec4(envBrdf(ccSpecularity, ccGlossiness, ccNormalW)*calcReflection(ccReflDirW, ccGlossiness), material_clearCoatReflectivity);
}
#endif
