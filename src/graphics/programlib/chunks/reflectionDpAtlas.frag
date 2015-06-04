uniform sampler2D texture_sphereMap;
uniform float material_reflectionFactor;

vec2 getDpAtlasUv(vec2 uv, float mip) {

    /*// calculate size
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

    // account for borders
    float scaleFactor = 0.00390625; //0.0078125; //(256.0 + 2.0) / 256.0 - 1.0;
    float scaleAmount = ((2.0 + 2.0 * mipGreaterThan2) - invMipGreaterThan1) * scaleFactor;
    uv = uv * 2.0 - vec2(1.0);
    uv *= vec2(1.0) - vec2(scaleAmount, scaleAmount * 2.0);
    uv = uv * 0.5 + 0.5;

    // transform uv
    uv = uv * rect.zw + rect.xy;*/


    vec4 rect;
    float sx = saturate(mip - 2.0);
    rect.x = sx * 0.5;

    float t = mip - rect.x * 6.0;
    float i = 1.0 - rect.x;
    rect.y = min(t * 0.5, 0.75) * i + rect.x;

    float st = saturate(t);
    rect.z = (1.0 - st * 0.5) * i;
    rect.w = rect.z * 0.5;

    float rcRectZ = 1.0 / rect.z;
    //float rcRectZ = (st + 1.0) * (sx + 1.0);
    float scaleFactor = 0.00390625 * rcRectZ;
    vec2 scale = vec2(scaleFactor, scaleFactor * 2.0);
    uv = uv * (vec2(1.0) - scale) + scale * 0.5;

    uv = uv * rect.zw + rect.xy;

    return uv;
}

void addReflection(inout psInternalData data) {

    vec3 reflDir = normalize(data.reflDirW);

    // Convert vector to DP coords
    bool up = reflDir.y > 0.0;
    float scale = 0.90909090909090909090909090909091;//1.1;
    vec3 reflDirWarp = reflDir.xzx * vec3(-0.25, 0.5, 0.25);
    float reflDirVer = abs(reflDir.y) + 1.0;
    reflDirWarp /= reflDirVer;
    //reflDirWarp /= scale;
    reflDirWarp *= scale;
    reflDirWarp = vec3(0.75, 0.5, 0.25) - reflDirWarp;
    vec2 tc = up? reflDirWarp.xy : reflDirWarp.zy;

    float bias = saturate(1.0 - data.glossiness) * 5.0; // multiply by max mip level

    float mip = floor(bias);
    vec3 tex1 = $texture2DSAMPLE(texture_sphereMap, getDpAtlasUv(tc, mip));

    mip = min(mip + 1.0, 5.0);
    vec3 tex2 = $texture2DSAMPLE(texture_sphereMap, getDpAtlasUv(tc, mip));

    tex1 = mix(tex1, tex2, fract(bias));

    data.reflection += vec4(tex1, material_reflectionFactor);
}


