export default /* glsl */`
#ifdef STD_IRIDESCENCE_CONSTANT
uniform float material_iridescence;
#endif

void getIridescence() {
    float iridescence = 1.0;

    #ifdef STD_IRIDESCENCE_CONSTANT
    iridescence *= material_iridescence;
    #endif

    #ifdef STD_IRIDESCENCE_TEXTURE
    iridescence *= texture2DBias({STD_IRIDESCENCE_TEXTURE_NAME}, {STD_IRIDESCENCE_TEXTURE_UV}, textureBias).{STD_IRIDESCENCE_TEXTURE_CHANNEL};
    #endif

    dIridescence = iridescence; 
}
`;
