uniform samplerCube texture_prefilteredCubeMap128;
uniform samplerCube texture_prefilteredCubeMap64;
uniform samplerCube texture_prefilteredCubeMap32;
uniform samplerCube texture_prefilteredCubeMap16;
uniform samplerCube texture_prefilteredCubeMap8;
#ifndef PMREM4
#define PMREM4
uniform samplerCube texture_prefilteredCubeMap4;
#endif
uniform float material_reflectivity;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    // Unfortunately, WebGL doesn't allow us using textureCubeLod. Therefore bunch of nasty workarounds is required.
    // We fix mip0 to 128x128, so code is rather static.
    // Mips smaller than 4x4 aren't great even for diffuse. Don't forget that we don't have bilinear filtering between different faces.

    float bias = saturate(1.0 - tGlossiness) * 5.0; // multiply by max mip level
    vec3 refl = cubeMapProject(tReflDirW);
    vec4 cubes0;
    vec4 cubes1;
    if (bias < 1.0)
    {
        cubes0 = textureCube(texture_prefilteredCubeMap128, fixSeams(refl, 0.0));
        cubes1 = textureCube(texture_prefilteredCubeMap64, fixSeams(refl, 1.0));
    }
    else if (bias < 2.0)
    {
        cubes0 = textureCube(texture_prefilteredCubeMap64, fixSeams(refl, 1.0));
        cubes1 = textureCube(texture_prefilteredCubeMap32, fixSeams(refl, 2.0));
    }
    else if (bias < 3.0)
    {
        cubes0 = textureCube(texture_prefilteredCubeMap32, fixSeams(refl, 2.0));
        cubes1 = textureCube(texture_prefilteredCubeMap16, fixSeams(refl, 3.0));
    }
    else if (bias < 4.0)
    {
        cubes0 = textureCube(texture_prefilteredCubeMap16, fixSeams(refl, 3.0));
        cubes1 = textureCube(texture_prefilteredCubeMap8, fixSeams(refl, 4.0));
    }
    else
    {
        cubes0 = textureCube(texture_prefilteredCubeMap8, fixSeams(refl, 4.0));
        cubes1 = textureCube(texture_prefilteredCubeMap4, fixSeams(refl, 5.0));
    }

    vec4 cubeFinal = mix(cubes0, cubes1, fract(bias));
    return processEnvironment($DECODE(cubeFinal).rgb);
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
