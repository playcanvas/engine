export default /* wgsl */`
uniform material_heightMapFactor: f32;

fn getParallax() {
    var parallaxScale = uniform.material_heightMapFactor;

    var height: f32 = textureSampleBias({STD_HEIGHT_TEXTURE_NAME}, {STD_HEIGHT_TEXTURE_NAME}Sampler, {STD_HEIGHT_TEXTURE_UV}, uniform.textureBias).{STD_HEIGHT_TEXTURE_CHANNEL};
    height = height * parallaxScale - parallaxScale * 0.5;
    var viewDirT: vec3f = dViewDirW * dTBN;

    viewDirT.z = viewDirT.z + 0.42;
    dUvOffset = height * (viewDirT.xy / viewDirT.z);
}
`;
