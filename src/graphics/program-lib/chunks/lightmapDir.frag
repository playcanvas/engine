uniform sampler2D texture_lightMap;
uniform sampler2D texture_dirLightMap;
void addLightMap() {
    //dDiffuseLight += $texture2DSAMPLE(texture_lightMap, $UV).$CH;

    vec4 dir = texture2D(texture_dirLightMap, $UV);
    dLightDirNormW = normalize(dir.xyz * 2.0 - vec3(1.0));
    dDiffuseLight += $texture2DSAMPLE(texture_lightMap, $UV).$CH;// * saturate(dot(dLightDirNormW, -dNormalW));
}

void addDirLightMap() {
    vec4 dir = texture2D(texture_dirLightMap, $UV);
    //if (dir.w==0.0) return;
    vec3 color = $texture2DSAMPLE(texture_lightMap, $UV).$CH;

    dLightDirNormW = normalize(dir.xyz * 2.0 - vec3(1.0));
    dSpecularLight = vec3(getLightSpecular()) * color;// * (1.0-min(dir.w*3.0,1.0));
    //if (dir.w < 0.001) dSpecularLight = vec3(0.0);

    //dir.w *= 3.0;
    dSpecularLight = dir.xyz;
}

