#extension GL_EXT_shader_texture_lod : enable

uniform sampler2D texture_sphereMap;
uniform float material_reflectionFactor;

vec2 dpRemap(vec2 sampleCoords, bool up) {
    bool right = up;

    // Move from quad [0, 1] to [-1, 1] inside each half
    sampleCoords.y = sampleCoords.y * 2.0 - 1.0;
    sampleCoords.x = (sampleCoords.x - (right? 0.75 : 0.25)) * 4.0;

    float sqLength = dot(sampleCoords, sampleCoords);
    if (sqLength >= 1.0) {
        // If outside of this half, move from [1, 2] to quadratic [1, 0.5] (paraboloid edge-to-center distortion is quadratic)
        // also flip x, because it differs on each half
        sampleCoords = (sampleCoords / sqLength) * vec2(-1, 1);
    }

    // Move back to [0, 1]
    // If outside of this half, use other half
    sampleCoords.y = sampleCoords.y * 0.5 + 0.5;
    sampleCoords.x = sampleCoords.x * 0.25
    + (right?
        (sqLength>=1.0? 0.25 : 0.75) :
        (sqLength>=1.0? 0.75 : 0.25));

    return sampleCoords;
}

void addReflection(inout psInternalData data) {

    vec3 reflDir = normalize(data.reflDirW);

    bool up = reflDir.y > 0.0;

    /*float ext = 1.0 / 16.0;
    float fullLength = 1.0 + ext;
    float segmentStart = ext / fullLength;
    float usablePart = 1.0 - segmentStart;
    //reflDir.y = reflDir.y * usablePart + segmentStart;
    //reflDir.y = (reflDir.y + ext) / (ext + 1.0);
    //reflDir.y = abs(reflDir.y) * (1.0 /  (1.0 + ext)) + (ext / (1.0 + ext));*/

    float scale = 1.1;

    vec3 reflDirWarp = reflDir.xzx * vec3(-0.25, 0.5, 0.25);
    float reflDirVer = abs(reflDir.y) + 1.0;
    reflDirWarp /= reflDirVer;
    reflDirWarp /= scale;
    reflDirWarp = vec3(0.75, 0.5, 0.25) - reflDirWarp;
    vec2 tc = up? reflDirWarp.xy : reflDirWarp.zy;

    vec4 tex = texture2D(texture_sphereMap, tc);


    /*vec4 texel = vec4(1.0/32.0, 1.0/16.0, 32.0, 16.0);

    vec3 reflDirC = reflDir;
    reflDirC.y = 0.0;
    reflDirC = normalize(reflDirC);
    vec3 reflDirWarpC = reflDirC.xzx * vec3(-0.25, 0.5, 0.25);
    reflDirWarpC = vec3(0.75, 0.5, 0.25) - reflDirWarpC;

    vec2 coordsT = up? reflDirWarp.xy : reflDirWarpC.xy;
    vec2 coordsB = up? reflDirWarpC.zy : reflDirWarp.zy;
    vec4 texT = texture2D(texture_sphereMap, coordsT);
    vec4 texB = texture2D(texture_sphereMap, coordsB);
    texel.w = 8.0;
    vec4 tex = mix(texB, texT, saturate(reflDir.y * texel.w * 0.5 + 0.5 + 0.5));*/


    /*vec4 texT = texture2D(texture_sphereMap, reflDirWarp.xy);
    vec4 texB = texture2D(texture_sphereMap, reflDirWarp.zy);
    vec4 tex = texT;//mix(texB, texT, saturate(reflDir.y * texel.w * 0.25 + 0.5));*/

    /*up = tc.x >= 0.5;
    tc -= texel.xy * 0.5;
    vec2 tlerp = fract(tc * texel.zw);

    vec2 sampleCoords;
    sampleCoords = dpRemap(tc, up);
    vec4 tex = texture2D(texture_sphereMap, sampleCoords);

    sampleCoords = dpRemap(tc + vec2(texel.x, 0.0), up);
    vec4 texR = texture2D(texture_sphereMap, sampleCoords);

    sampleCoords = dpRemap(tc + vec2(0.0, texel.y), up);
    vec4 texB = texture2D(texture_sphereMap, sampleCoords);

    sampleCoords = dpRemap(tc + texel.xy, up);
    vec4 texRB = texture2D(texture_sphereMap, sampleCoords);

    tex = mix(tex, texR, tlerp.x);
    texB = mix(texB, texRB, tlerp.x);
    tex = mix(tex, texB, tlerp.y);*/

    //vec4 tex = texture2DLodEXT(texture_sphereMap, tc, 1.0);
    tex.rgb = tex.rgb * tex.a * 8.0;
    data.reflection += vec4(tex.rgb * tex.rgb, material_reflectionFactor);

    //data.reflection += vec4($texture2DSAMPLE(texture_sphereMap, tc).rgb, material_reflectionFactor);
}


