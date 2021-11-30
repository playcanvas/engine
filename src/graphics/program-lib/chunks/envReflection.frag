uniform samplerCube texture_envReflection;
uniform float material_reflectivity;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    vec3 dir = cubeMapProject(tReflDirW);
#ifndef RIGHT_HANDED_CUBEMAP
    dir.x *= -1.0;
#endif
    float level = saturate(1.0 - tGlossiness) * 5.0; // multiply by max mip level

#if SUPPORTS_TEXLOD == 1
    // fix seams
    dir = fixSeams(dir, level);

    vec4 raw = textureCubeLodEXT(texture_envReflection, dir, level);
#else
    vec4 raw = textureCube(texture_envReflection, dir);
#endif

    vec3 linear = $DECODE(raw);
    return processEnvironment(linear);
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
