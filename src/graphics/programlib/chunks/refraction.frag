uniform float material_refraction, material_refractionIndex;

vec3 refract2(vec3 viewVec, vec3 Normal, float IOR) {
    float vn = dot(viewVec, Normal);
    float k = 1.0 - IOR * IOR * (1.0 - vn * vn);
    vec3 refrVec = IOR * viewVec - (IOR * vn + sqrt(k)) * Normal;
    return refrVec;
}

void addRefraction(inout psInternalData data) {

    // use same reflection code with refraction vector
    vec3 tmp = data.reflDirW;
    vec4 tmp2 = data.reflection;
    data.reflection = vec4(0.0);
    data.reflDirW = refract2(-data.viewDirW, data.normalW, material_refractionIndex);

    addReflection(data);

    data.diffuseLight = mix(data.diffuseLight, data.reflection.rgb * data.albedo, material_refraction);
    data.reflDirW = tmp;
    data.reflection = tmp2;
}

