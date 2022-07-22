export default /* glsl */`
uniform float material_refractionIndex;
uniform float material_attenuationDistance;
uniform vec3 material_attenuation;

vec3 refract2(vec3 viewVec, vec3 Normal, float IOR) {
    float vn = dot(viewVec, Normal);
    float k = 1.0 - IOR * IOR * (1.0 - vn * vn);
    vec3 refrVec = IOR * viewVec - (IOR * vn + sqrt(k)) * Normal;
    return refrVec;
}

void addRefraction() {
    // use same reflection code with refraction vector
    vec3 tmpDir = dReflDirW;
    vec4 tmpRefl = dReflection;
    dReflDirW = refract2(-dViewDirW, dNormalW, material_refractionIndex);

    dReflection = vec4(0);

    addReflection();

    dDiffuseLight = mix(dDiffuseLight, dReflection.rgb * dAlbedo, dTransmission);
    dReflection = tmpRefl;
    dReflDirW = tmpDir;
}
`;
