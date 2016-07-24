uniform sampler2D texture_lightMap;
uniform sampler2D texture_dirLightMap;

void addLightMap() {
    dDiffuseLight += $texture2DSAMPLE(texture_lightMap, $UV).$CH;
}

void addDirLightMap() {
    vec4 dir = texture2D(texture_dirLightMap, $UV);
    if (dir.w==0.0) return;
    vec3 color = $texture2DSAMPLE(texture_lightMap, $UV).$CH;

    dLightDirNormW = normalize(dir.xyz * 2.0 - vec3(1.0));
    dSpecularLight += vec3(getLightSpecular()) * color;
}

