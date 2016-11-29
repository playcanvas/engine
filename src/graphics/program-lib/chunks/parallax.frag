uniform sampler2D texture_heightMap;
uniform float material_heightMapFactor;
void getParallax() {
    float parallaxScale = material_heightMapFactor;

    float height = texture2D(texture_heightMap, $UV).$CH;
    height = height * parallaxScale - parallaxScale*0.5;
    vec3 viewDirT = dViewDirW * dTBN;

    viewDirT.z += 0.42;
    dUvOffset = height * (viewDirT.xy / viewDirT.z);
}

