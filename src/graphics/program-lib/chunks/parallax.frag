uniform sampler2D texture_heightMap;
uniform MMEDP float material_heightMapFactor;

void getParallax() {
    MMEDP float parallaxScale = material_heightMapFactor;

    MMEDP float height = texture2D(texture_heightMap, $UV).$CH;
    height = height * parallaxScale - parallaxScale*0.5;
    MMEDP vec3 viewDirT = dViewDirW * dTBN;

    viewDirT.z += 0.42;
    dUvOffset = height * (viewDirT.xy / viewDirT.z);
}
