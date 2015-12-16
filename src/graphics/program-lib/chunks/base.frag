
uniform vec3 view_position;

uniform vec3 light_globalAmbient;

struct psInternalData {
    vec3 albedo;
    vec3 specularity;
    float glossiness;
    vec3 emission;
    vec3 normalW;
    mat3 TBN;
    vec3 viewDirW;
    vec3 reflDirW;
    vec3 diffuseLight;
    vec3 specularLight;
    vec4 reflection;
    float alpha;
    vec3 lightDirNormW;
    vec3 lightDirW;
    vec3 lightPosW;
    float atten;
    vec3 shadowCoord;
    vec2 uvOffset;
    vec3 normalMap;
    float ao;
};

void getViewDir(inout psInternalData data) {
    data.viewDirW = normalize(view_position - vPositionW);
}

void getReflDir(inout psInternalData data) {
    data.reflDirW = normalize(-reflect(data.viewDirW, data.normalW));
}

void getLightDirPoint(inout psInternalData data, vec3 lightPosW) {
    data.lightDirW = vPositionW - lightPosW;
    data.lightDirNormW = normalize(data.lightDirW);
    data.lightPosW = lightPosW;
}

float getFalloffLinear(inout psInternalData data, float lightRadius) {
    float d = length(data.lightDirW);
    return max(((lightRadius - d) / lightRadius), 0.0);
}

float square(float x) {
    return x*x;
}

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec3 saturate(vec3 x) {
    return clamp(x, vec3(0.0), vec3(1.0));
}

float getFalloffInvSquared(inout psInternalData data, float lightRadius) {
    float sqrDist = dot(data.lightDirW, data.lightDirW);
    float falloff = 1.0 / (sqrDist + 1.0);
    float invRadius = 1.0 / lightRadius;

    falloff *= 16.0;
    falloff *= square( saturate( 1.0 - square( sqrDist * square(invRadius) ) ) );

    return falloff;
}

float getSpotEffect(inout psInternalData data, vec3 lightSpotDirW, float lightInnerConeAngle, float lightOuterConeAngle) {
    float cosAngle = dot(data.lightDirNormW, lightSpotDirW);
    return smoothstep(lightOuterConeAngle, lightInnerConeAngle, cosAngle);
}

void processMetalness(inout psInternalData data, float metalness) {
    const float dielectricF0 = 0.04;
    data.specularity = mix(vec3(dielectricF0), data.albedo, metalness);
    data.albedo *= 1.0 - metalness;
}

