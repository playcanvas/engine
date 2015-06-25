#extension GL_EXT_shader_texture_lod : enable

uniform samplerCube texture_prefilteredCubeMap128;
uniform float material_reflectivity;

void addReflection(inout psInternalData data) {

    float bias = saturate(1.0 - data.glossiness) * 5.0; // multiply by max mip level
    vec3 fixedReflDir = fixSeams(cubeMapProject(data.reflDirW), bias);
    fixedReflDir.x *= -1.0;

    vec3 refl = processEnvironment($DECODE( textureCubeLodEXT(texture_prefilteredCubeMap128, fixedReflDir, bias) ).rgb);

    data.reflection += vec4(refl, material_reflectivity);
}

