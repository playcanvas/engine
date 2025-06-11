export default /* glsl */`
uniform float material_iridescenceThicknessMax;

#ifdef STD_IRIDESCENCETHICKNESS_TEXTURE
uniform float material_iridescenceThicknessMin;
#endif

void getIridescenceThickness() {

    #ifdef STD_IRIDESCENCETHICKNESS_TEXTURE
        float blend = texture2DBias({STD_IRIDESCENCETHICKNESS_TEXTURE_NAME}, {STD_IRIDESCENCETHICKNESS_TEXTURE_UV}, textureBias).{STD_IRIDESCENCETHICKNESS_TEXTURE_CHANNEL};
        float iridescenceThickness = mix(material_iridescenceThicknessMin, material_iridescenceThicknessMax, blend);
    #else
        float iridescenceThickness = material_iridescenceThicknessMax;
    #endif

    dIridescenceThickness = iridescenceThickness; 
}
`;
