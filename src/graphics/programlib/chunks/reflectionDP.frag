#extension GL_EXT_shader_texture_lod : enable

uniform sampler2D texture_sphereMap;
uniform float material_reflectionFactor;
void addReflection(inout psInternalData data) {

    vec3 reflDir = normalize(data.reflDirW);

    vec3 reflDirWarp = reflDir.xzx * vec3(-0.25, 0.5, 0.25);
    float reflDirVer = abs(reflDir.y) + 1.0;
    reflDirWarp /= reflDirVer;
    reflDirWarp = vec3(0.75, 0.5, 0.25) - reflDirWarp;
    vec2 tc = reflDir.y > 0.0? reflDirWarp.xy : reflDirWarp.zy;

    vec4 tex = texture2DLodEXT(texture_sphereMap, tc, 4.0);
    tex.rgb = tex.rgb * tex.a * 8.0;
    data.reflection += vec4(tex.rgb * tex.rgb, material_reflectionFactor);

    //data.reflection += vec4($texture2DSAMPLE(texture_sphereMap, tc).rgb, material_reflectionFactor);
}


