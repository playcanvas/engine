uniform MEDP float material_refraction, material_refractionIndex;

vec3 refract2(vec3 viewVec, vec3 Normal, float IOR) {
    MEDP float vn = dot(viewVec, Normal);
    MEDP float k = 1.0 - IOR * IOR * (1.0 - vn * vn);
    MEDP vec3 refrVec = IOR * viewVec - (IOR * vn + sqrt(k)) * Normal;
    return refrVec;
}

void addRefraction() {
    // use same reflection code with refraction vector
    MEDP vec3 tmp = dReflDirW;
    MEDP vec4 tmp2 = dReflection;
    dReflection = vec4(0.0);
    dReflDirW = refract2(-dViewDirW, dNormalW, material_refractionIndex);

    addReflection();

    dDiffuseLight = mix(dDiffuseLight, dReflection.rgb * dAlbedo, material_refraction);
    dReflDirW = tmp;
    dReflection = tmp2;
}
