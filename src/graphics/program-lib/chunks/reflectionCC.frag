#ifdef CLEARCOAT
uniform MEDP float material_clearCoatReflectivity;

void addReflectionCC() {
    ccReflection += vec4(calcReflection(ccReflDirW, ccGlossiness), material_clearCoatReflectivity);
}
#endif
