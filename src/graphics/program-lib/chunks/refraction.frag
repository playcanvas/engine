uniform float material_refraction, material_refractionIndex;

vec3 refract2(vec3 viewVec, vec3 Normal, float IOR) {
    float vn = dot(viewVec, Normal);
    float k = 1.0 - IOR * IOR * (1.0 - vn * vn);
    vec3 refrVec = IOR * viewVec - (IOR * vn + sqrt(k)) * Normal;
    return refrVec;
}

void addRefraction() {

    // use same reflection code with refraction vector
    vec3 tmp = dReflDirW;
    vec4 tmp2 = dReflection;
    dReflection = vec4(0.0);
    dReflDirW = refract2(-dViewDirW, dNormalW, material_refractionIndex);

    addReflection();

    dDiffuseLight = mix(dDiffuseLight, dReflection.rgb * dAlbedo, material_refraction);
    dReflDirW = tmp;
    dReflection = tmp2;
}

