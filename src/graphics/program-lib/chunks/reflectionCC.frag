#ifdef CLEARCOAT
uniform float material_clearCoatReflectivity;
void addReflectionCC() {    
    ccReflection += calcReflection(ccReflDirW, ccGlossiness, material_clearCoatReflectivity); 
}
#endif
