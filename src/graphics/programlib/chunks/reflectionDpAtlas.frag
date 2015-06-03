uniform sampler2D texture_sphereMap;
uniform float material_reflectionFactor;

vec2 getDpAtlasUv(vec2 uv, float mip) {
    // calculate size
    float mipGreaterThan1 = min(mip, 1.0);
    float mipGreaterThan2 = saturate(mip - 2.0);
    float invMipGreaterThan1 = 1.0 - mipGreaterThan1;
    vec4 rect;
    rect.z = (0.5 - 0.25 * mipGreaterThan2) + invMipGreaterThan1 * 0.5;
    rect.w = rect.z * 0.5;

    // calculate offset
    rect.x = mipGreaterThan2 * 0.5;

    float offsetY0 = (mip + 1.0) * 0.25 * mipGreaterThan1;
    float offsetY1 = (mip - 3.0) * 0.125 + 0.5;
    rect.y = mix(offsetY0, offsetY1, mipGreaterThan2);

    // transform uv
    uv = uv * rect.zw + rect.xy;

    // account for borders
    float scaleFactor = 1.015625;
    float scaleAmount = ((2.0 + 2.0 * mipGreaterThan2) - invMipGreaterThan1) * scaleFactor;
    uv = uv * 2.0 - vec2(1.0);
    uv *= vec2(scaleAmount, scaleAmount * 2.0) + vec2(1.0);
    uv = uv * 0.5 + 0.5;

    return uv;
}

void addReflection(inout psInternalData data) {

    vec3 reflDir = normalize(data.reflDirW);

    // Convert vector to DP coords
    bool up = reflDir.y > 0.0;
    float scale = 1.1;
    vec3 reflDirWarp = reflDir.xzx * vec3(-0.25, 0.5, 0.25);
    float reflDirVer = abs(reflDir.y) + 1.0;
    reflDirWarp /= reflDirVer;
    reflDirWarp /= scale;
    reflDirWarp = vec3(0.75, 0.5, 0.25) - reflDirWarp;
    vec2 tc = up? reflDirWarp.xy : reflDirWarp.zy;

    tc = getDpAtlasUv(tc, 0.0);

    vec3 tex = $texture2DSAMPLE(texture_sphereMap, tc);

    data.reflection += vec4(tex, material_reflectionFactor);
}


