uniform sampler2D texture_lightMap;
uniform sampler2D texture_dirLightMap;

vec3 decodeDirLmNormal(vec2 enc) {
    vec2 fenc = enc*4.0 - 2.0;
    float f = dot(fenc,fenc);
    float g = sqrt(1.0 - f*0.25);
    vec3 n;
    n.xy = fenc*g;
    n.z = 1.0 - f*0.5;
    return n;
}

void addLightMap() {
    //dDiffuseLight += $texture2DSAMPLE(texture_lightMap, $UV).$CH;

    vec4 dir = texture2D(texture_dirLightMap, $UV);

    dLightDirNormW = normalize(decodeDirLmNormal(dir.xy)) * vec3(1,1,-1);

    vec3 normal3 = normalize(vNormalW);
    vec3 tangent3 = normalize(cross(normal3, normal3.y>0.5? vec3(1,0,0) : vec3(0,1,0)));
    vec3 binormal3 = normalize(cross(normal3, tangent3));
    tangent3 = normalize(cross(normal3, binormal3));

    mat3 tbn = mat3(tangent3, binormal3, normal3);
    dLightDirNormW = tbn * dLightDirNormW; // tangent to world

    dDiffuseLight = vec3(1.0) * mix( saturate(dot(dLightDirNormW, -dNormalW)), 1.0, saturate(dir.w*8.0) ) * $texture2DSAMPLE(texture_lightMap, $UV).$CH;
}

void addDirLightMap() {
    vec4 dir = texture2D(texture_dirLightMap, $UV);
    //if (dir.w==0.0) return;
    vec3 color = $texture2DSAMPLE(texture_lightMap, $UV).$CH;

    dLightDirNormW = normalize(dir.xyz * 2.0 - vec3(1.0));
    dSpecularLight = vec3(getLightSpecular()) * color * (1.0-min(dir.w*2.0,1.0));
    //if (dir.w < 0.001) dSpecularLight = vec3(0.0);

    dLightDirNormW = normalize(decodeDirLmNormal(dir.xy)) * vec3(1,1,-1);

    vec3 normal3 = normalize(vNormalW);
    vec3 tangent3 = normalize(cross(normal3, normal3.y>0.5? vec3(1,0,0) : vec3(0,1,0)));
    vec3 binormal3 = normalize(cross(normal3, tangent3));
    tangent3 = normalize(cross(normal3, binormal3));

    mat3 tbn = mat3(tangent3, binormal3, normal3);
    dLightDirNormW = tbn * dLightDirNormW; // tangent to world
    //dLightDirNormW = dLightDirNormW * dTBN; // tangent to world

    //dir.w = pow(dir.w, 0.45);
    //dir.w *= 8.0;
    //dSpecularLight = dir.www;//xwy;

    //dSpecularLight = dLightDirNormW * 0.5 + vec3(0.5);

    dir.w = saturate(dir.w * 8.0);
    dSpecularLight = vec3(getLightSpecular()) * color * (1.0 - dir.w);
    //dSpecularLight = dir.www;//xwy;
}

