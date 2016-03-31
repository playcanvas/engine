uniform sampler2D texture_heightMap;
uniform float material_heightMapFactor;
void getParallax() {
    float parallaxScale = material_heightMapFactor;
    const float parallaxBias = 0.01;

    float height = texture2D(texture_heightMap, $UV).$CH * parallaxScale - parallaxBias;
    vec3 viewDirT = dViewDirW * dTBN;

    dUvOffset = min(height * viewDirT.xy, vec2(parallaxBias));
}

