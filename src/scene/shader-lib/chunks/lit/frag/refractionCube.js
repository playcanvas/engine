export default /* glsl */`
uniform float material_refractionIndex;

vec3 refract2(vec3 viewVec, vec3 Normal, float IOR) {
    float vn = dot(viewVec, Normal);
    float k = 1.0 - IOR * IOR * (1.0 - vn * vn);
    vec3 refrVec = IOR * viewVec - (IOR * vn + sqrt(k)) * Normal;
    return refrVec;
}

void addRefraction(vec3 worldNormal, float thickness, float gloss, vec3 specularity, vec3 albedo, float transmission, IridescenceArgs iridescence) {
    // use same reflection code with refraction vector
    vec3 tmpDir = dReflDirW;
    vec4 tmpRefl = dReflection;
    dReflDirW = refract2(-dViewDirW, worldNormal, material_refractionIndex);
    dReflection = vec4(0);
    addReflection(dReflDirW, gloss);
    dDiffuseLight = mix(dDiffuseLight, dReflection.rgb * albedo, transmission);
    dReflection = tmpRefl;
    dReflDirW = tmpDir;
}
`;
