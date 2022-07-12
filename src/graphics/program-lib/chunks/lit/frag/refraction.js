export default /* glsl */`
uniform float material_refraction;

vec3 refract2(vec3 viewVec, vec3 Normal, float IOR) {
    float vn = dot(viewVec, Normal);
    float k = 1.0 - IOR * IOR * (1.0 - vn * vn);
    vec3 refrVec = IOR * viewVec - (IOR * vn + sqrt(k)) * Normal;
    return refrVec;
}

void addRefraction(float ior) {
    // use same reflection code with refraction vector
    vec3 tmpDir = dReflDirW;
    vec4 tmpRefl = dReflection;
    dReflDirW = refract2(-dViewDirW, dNormalW, ior);

    dReflection = vec4(0, 0, 0, 0);
    addReflection();

    //dDiffuseLight = mix(dDiffuseLight, dReflection.rgb * dAlbedo, material_refraction);
    dReflection.rgb = dReflection.rgb * dAlbedo * material_refraction + tmpRefl.rgb;
    dReflection.a = dReflection.a + tmpRefl.a;
    dReflDirW = tmpDir;
}
`;
