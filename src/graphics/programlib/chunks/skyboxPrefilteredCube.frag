varying vec3 vViewDir;
uniform samplerCube texture_cubeMap;

vec3 fixSeamsStretch(vec3 vec, float mipmapIndex, float cubemapSize) {
    float scale = 1.0 - exp2(mipmapIndex) / cubemapSize;
    float M = max(max(abs(vec.x), abs(vec.y)), abs(vec.z));
    if (abs(vec.x) != M) vec.x *= scale;
    if (abs(vec.y) != M) vec.y *= scale;
    if (abs(vec.z) != M) vec.z *= scale;
    return vec;
}

void main(void) {
    vec3 color = textureCubeRGBM(texture_cubeMap, fixSeamsStretch(vViewDir, 0.0, 128.0));
    color = toneMap(color);
    color = gammaCorrectOutput(color);
    gl_FragColor = vec4(color, 1.0);
}

