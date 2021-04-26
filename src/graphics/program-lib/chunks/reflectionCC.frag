#ifdef CLEARCOAT
uniform float material_clearCoatReflectivity;

void addReflectionCC() {
    ccReflection += vec4(envBrdf(calcReflection(ccReflDirW, ccGlossiness), ccGlossiness, ccNormalW), material_clearCoatReflectivity);
}
#endif
