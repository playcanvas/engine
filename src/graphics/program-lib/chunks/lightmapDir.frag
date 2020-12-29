uniform sampler2D texture_lightMap;
uniform sampler2D texture_dirLightMap;

void addLightMap() {
    vec3 color = $texture2DSAMPLE(texture_lightMap, $UV).$CH;
    vec3 dir = texture2D(texture_dirLightMap, $UV).xyz;
    if (dot(dir, vec3(1.0)) < 0.00001) {
        dDiffuseLight += color;
    } else {
        dLightDirNormW = normalize(dir * 2.0 - vec3(1.0));

        float vlight = saturate(dot(dLightDirNormW, -dVertexNormalW));
        float flight = saturate(dot(dLightDirNormW, -dNormalW));
        float nlight = (flight / max(vlight, 0.01)) * 0.5;

        dDiffuseLight += color * nlight * 2.0;
    }

    dSpecularLight += color * getLightSpecular();
}
