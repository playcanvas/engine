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

void addReflection() {

    // Unfortunately, WebGL doesn't allow us using textureCubeLod. Therefore bunch of nasty workarounds is required.
    // We fix mip0 to 128x128, so code is rather static.
    // Mips smaller than 4x4 aren't great even for diffuse. Don't forget that we don't have bilinear filtering between different faces.

    float bias = saturate(1.0 - dGlossiness) * 5.0; // multiply by max mip level
    int index1 = int(bias);
    int index2 = int(min(bias + 1.0, 7.0));

    vec3 fixedReflDir = fixSeams(cubeMapProject(dReflDirW), bias);
    fixedReflDir.x *= -1.0;

    vec4 cubes[6];
    cubes[0] = textureCube(texture_prefilteredCubeMap128, fixedReflDir);
    cubes[1] = textureCube(texture_prefilteredCubeMap64, fixedReflDir);
    cubes[2] = textureCube(texture_prefilteredCubeMap32, fixedReflDir);
    cubes[3] = textureCube(texture_prefilteredCubeMap16, fixedReflDir);
    cubes[4] = textureCube(texture_prefilteredCubeMap8, fixedReflDir);
    cubes[5] = textureCube(texture_prefilteredCubeMap4, fixedReflDir);

    // Also we don't have dynamic indexing in PS, so...
    vec4 cube[2];
    for(int i = 0; i < 6; i++) {
        if (i == index1) {
            cube[0] = cubes[i];
        }
        if (i == index2) {
            cube[1] = cubes[i];
        }
    }

    // another variant
    /*if (index1==0){ cube[0]=cubes[0];
    }else if (index1==1){ cube[0]=cubes[1];
    }else if (index1==2){ cube[0]=cubes[2];
    }else if (index1==3){ cube[0]=cubes[3];
    }else if (index1==4){ cube[0]=cubes[4];
    }else if (index1==5){ cube[0]=cubes[5];}

    if (index2==0){ cube[1]=cubes[0];
    }else if (index2==1){ cube[1]=cubes[1];
    }else if (index2==2){ cube[1]=cubes[2];
    }else if (index2==3){ cube[1]=cubes[3];
    }else if (index2==4){ cube[1]=cubes[4];
    }else if (index2==5){ cube[1]=cubes[5];}*/

    vec4 cubeFinal = mix(cube[0], cube[1], fract(bias));
    vec3 refl = processEnvironment($DECODE(cubeFinal).rgb);

    dReflection += vec4(refl, material_reflectivity);
}

