uniform sampler2D texture_sphereMap;
uniform float material_reflectivity;

vec2 getDpAtlasUv(vec2 uv, float mip) {

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
    float scaleFactor = 0.00390625 * rcRectZ; // 0.0078125 = (256 + 2) / 256 - 1, 0.00390625 same for 512
    vec2 scale = vec2(scaleFactor, scaleFactor * 2.0);
    uv = uv * (vec2(1.0) - scale) + scale * 0.5;

    uv = uv * rect.zw + rect.xy;

    return uv;
}

void addReflection() {

    vec3 reflDir = normalize(cubeMapProject(dReflDirW));

    // Convert vector to DP coords
    bool up = reflDir.y > 0.0;
    float scale = 0.90909090909090909090909090909091;// 1.0 / 1.1;
    vec3 reflDirWarp = reflDir.xzx * vec3(-0.25, 0.5, 0.25);
    float reflDirVer = abs(reflDir.y) + 1.0;
    reflDirWarp /= reflDirVer;
    reflDirWarp *= scale;
    reflDirWarp = vec3(0.75, 0.5, 0.25) - reflDirWarp;
    vec2 tc = up? reflDirWarp.xy : reflDirWarp.zy;

    float bias = saturate(1.0 - dGlossiness) * 5.0; // multiply by max mip level

    float mip = floor(bias);
    vec3 tex1 = $texture2DSAMPLE(texture_sphereMap, getDpAtlasUv(tc, mip)).rgb;

    mip = min(mip + 1.0, 5.0);
    vec3 tex2 = $texture2DSAMPLE(texture_sphereMap, getDpAtlasUv(tc, mip)).rgb;

    tex1 = mix(tex1, tex2, fract(bias));
    tex1 = processEnvironment(tex1);

    dReflection += vec4(tex1, material_reflectivity);
}


