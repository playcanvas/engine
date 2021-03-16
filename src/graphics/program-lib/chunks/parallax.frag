uniform sampler2D texture_heightMap;
uniform MEDP float material_heightMapFactor;

void getParallax() {
    MEDP float parallaxScale = material_heightMapFactor;

    MEDP float height = texture2D(texture_heightMap, $UV).$CH;
    height = height * parallaxScale - parallaxScale*0.5;
    MEDP vec3 viewDirT = dViewDirW * dTBN;

    viewDirT.z += 0.42;
    dUvOffset = height * (viewDirT.xy / viewDirT.z);
}
