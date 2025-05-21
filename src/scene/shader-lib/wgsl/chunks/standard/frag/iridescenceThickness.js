export default /* wgsl */`
uniform material_iridescenceThicknessMax: f32;

#ifdef STD_IRIDESCENCETHICKNESS_TEXTURE
    uniform material_iridescenceThicknessMin: f32;
#endif

fn getIridescenceThickness() {

    #ifdef STD_IRIDESCENCETHICKNESS_TEXTURE
        var blend: f32 = textureSampleBias({STD_IRIDESCENCETHICKNESS_TEXTURE_NAME}, {STD_IRIDESCENCETHICKNESS_TEXTURE_NAME}Sampler, {STD_IRIDESCENCETHICKNESS_TEXTURE_UV}, uniform.textureBias).{STD_IRIDESCENCETHICKNESS_TEXTURE_CHANNEL};
        var iridescenceThickness: f32 = mix(uniform.material_iridescenceThicknessMin, uniform.material_iridescenceThicknessMax, blend);
    #else
        var iridescenceThickness: f32 = uniform.material_iridescenceThicknessMax;
    #endif

    dIridescenceThickness = iridescenceThickness; 
}
`;
