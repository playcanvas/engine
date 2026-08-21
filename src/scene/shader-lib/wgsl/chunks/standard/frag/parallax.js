export default /* wgsl */`
uniform material_heightMapFactor: f32;

fn getParallax() {
    var parallaxScale = uniform.material_heightMapFactor;

    var height: f32 = textureSampleBias({STD_HEIGHT_TEXTURE_NAME}, {STD_HEIGHT_TEXTURE_NAME}Sampler, {STD_HEIGHT_TEXTURE_UV}, uniform.textureBias).{STD_HEIGHT_TEXTURE_CHANNEL};

    // remap the height to be relative to the mid-level of the height map, so the surface pivots
    // around the original geometry instead of floating in front of it
    height = height * parallaxScale - parallaxScale * 0.5;

    // view direction in tangent space, pointing from the surface towards the camera
    var viewDirT: vec3f = normalize(dViewDirW * dTBN);

    // Parallax mapping with offset limiting (Welsh 2004). The geometrically correct offset is
    // height * viewDirT.xy / viewDirT.z, but the 1/z term explodes at grazing angles and smears
    // the texture. Dropping it limits the offset to the height itself, which is stable at all
    // viewing angles at the cost of understating the parallax when looking along the surface.
    // The y axis of the tangent frame points along decreasing v, which is the tangent space
    // convention normal maps are authored in, so the v component of the offset is negated to
    // shift the uv in the direction the surface is actually viewed from.
    dUvOffset = height * vec2f(viewDirT.x, -viewDirT.y);
}
`;
