export default /* glsl */`
uniform float material_refractionIndex;
uniform float material_invAttenuationDistance;
uniform vec3 material_attenuation;
uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;
uniform sampler2D uSceneColorMap;
uniform vec4 uScreenSize;

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

    vec3 modelScale;
    modelScale.x = length(vec3(matrix_model[0].xyz));
    modelScale.y = length(vec3(matrix_model[1].xyz));
    modelScale.z = length(vec3(matrix_model[2].xyz));

    vec3 refractionVector = normalize(refract(-dViewDirW, dNormalW, 1.0 / material_refractionIndex)) * dThickness * modelScale;

    vec4 pointOfRefraction = vec4(vPositionW + refractionVector, 1.0);
    vec4 projectionPoint = matrix_viewProjection * pointOfRefraction;
    vec2 uv = projectionPoint.xy / projectionPoint.ww;
    uv += vec2(1.0);
    uv *= vec2(0.5);

    float iorToRoughness = (1.0 - dGlossiness) * clamp(material_refractionIndex * 2.0 - 2.0, 0.0, 1.0);
    float refractionLod = log2(uScreenSize.x) * iorToRoughness;
    vec3 refraction = textureLod(uSceneColorMap, uv, refractionLod).rgb;
    //dReflection = vec4(0);

    //addReflection();

    vec3 transmittance;
    if (material_invAttenuationDistance != 0.0)
    {
        vec3 attenuation = -log(material_attenuation) * material_invAttenuationDistance;
        transmittance = exp(-attenuation * length(refractionVector));
    }
    else
    {
        transmittance = refraction;
    }

    vec3 fresnel = vec3(1.0) - getFresnel(dot(dViewDirW, dNormalW), dSpecularity);
    dDiffuseLight = mix(dDiffuseLight, refraction * dAlbedo * transmittance * fresnel, dTransmission);
    dReflection = tmpRefl;
    dReflDirW = tmpDir;
}
`;
