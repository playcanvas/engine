// Schlick's approximation

vec3 calcFresnel(float cosTheta, vec3 F0)
{
    return F0 + (1.0 - F0) * pow(max(1.0 - cosTheta, 0.0), 5.0);
}

vec3 calcFresnel(float cosTheta, vec3 F0, float glossiness)
{
    float fresnel = 1.0 - cosTheta;
    float fresnel2 = fresnel * fresnel;
    fresnel *= fresnel2 * fresnel2;
    fresnel *= glossiness * glossiness;
    return F0 + (1.0 - F0) * fresnel;
}
