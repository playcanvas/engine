export default /* glsl */`
uniform float material_iridescenceThicknessMax;

#ifdef MAPTEXTURE
uniform float material_iridescenceThicknessMin;
#endif

void getIridescenceThickness() {

    #ifdef MAPTEXTURE
    float blend = texture2DBias($SAMPLER, $UV, textureBias).$CH;
    float iridescenceThickness = mix(material_iridescenceThicknessMin, material_iridescenceThicknessMax, blend);
    #else
    float iridescenceThickness = material_iridescenceThicknessMax;
    #endif

    dIridescenceThickness = iridescenceThickness; 
}
`;
