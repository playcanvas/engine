uniform sampler2D texture_lightMap;
uniform sampler2D texture_dirLightMap;

void addLightMap() {
    vec4 dir = texture2D(texture_dirLightMap, $UV);
    dLightDirNormW = normalize(dir.xyz * 2.0 - vec3(1.0));

    float vlight = saturate(dot(dLightDirNormW, -vNormalW));
    float flight = saturate(dot(dLightDirNormW, -dNormalW));
    float nlight = (flight - vlight) * 0.5 + 0.5;

    dDiffuseLight += $texture2DSAMPLE(texture_lightMap, $UV).$CH * nlight * 2.0;
}

void addDirLightMap() {
    vec4 dir = texture2D(texture_dirLightMap, $UV);
    vec3 color = $texture2DSAMPLE(texture_lightMap, $UV).$CH;

    dLightDirNormW = normalize(dir.xyz * 2.0 - vec3(1.0));
    dSpecularLight += vec3(getLightSpecular()) * color;
}

