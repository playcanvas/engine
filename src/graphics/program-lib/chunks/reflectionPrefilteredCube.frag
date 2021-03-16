uniform samplerCube texture_prefilteredCubeMap128;
uniform samplerCube texture_prefilteredCubeMap64;
uniform samplerCube texture_prefilteredCubeMap32;
uniform samplerCube texture_prefilteredCubeMap16;
uniform samplerCube texture_prefilteredCubeMap8;
#ifndef PMREM4
#define PMREM4
uniform samplerCube texture_prefilteredCubeMap4;
#endif
uniform MEDP float material_reflectivity;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    // Unfortunately, WebGL doesn't allow us using textureCubeLod. Therefore bunch of nasty workarounds is required.
    // We fix mip0 to 128x128, so code is rather static.
    // Mips smaller than 4x4 aren't great even for diffuse. Don't forget that we don't have bilinear filtering between different faces.

    MEDP vec3 refl = cubeMapProject(tReflDirW);
#ifndef RIGHT_HANDED_CUBEMAP
    refl.x *= -1.0;
#endif    
    MEDP vec3 seam = calcSeam(refl);
    MEDP vec4 c0 = textureCube(texture_prefilteredCubeMap128, applySeam(refl, seam, 1.0 / 128.0));
    MEDP vec4 c1 = textureCube(texture_prefilteredCubeMap64, applySeam(refl, seam, 2.0 / 128.0));
    MEDP vec4 c2 = textureCube(texture_prefilteredCubeMap32, applySeam(refl, seam, 4.0 / 128.0));
    MEDP vec4 c3 = textureCube(texture_prefilteredCubeMap16, applySeam(refl, seam, 8.0 / 128.0));
    MEDP vec4 c4 = textureCube(texture_prefilteredCubeMap8, applySeam(refl, seam, 16.0 / 128.0));
    MEDP vec4 c5 = textureCube(texture_prefilteredCubeMap4, applySeam(refl, seam, 32.0 / 128.0));

    MEDP float bias = saturate(1.0 - tGlossiness) * 5.0; // multiply by max mip level
    MEDP vec4 cubes0;
    MEDP vec4 cubes1;
    if (bias < 1.0) {
        cubes0 = c0;
        cubes1 = c1;
    } else if (bias < 2.0) {
        cubes0 = c1;
        cubes1 = c2;
    } else if (bias < 3.0) {
        cubes0 = c2;
        cubes1 = c3;
    } else if (bias < 4.0) {
        cubes0 = c3;
        cubes1 = c4;
    } else {
        cubes0 = c4;
        cubes1 = c5;
    }

    MEDP vec4 cubeFinal = mix(cubes0, cubes1, fract(bias));
    return processEnvironment($DECODE(cubeFinal).rgb);
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
