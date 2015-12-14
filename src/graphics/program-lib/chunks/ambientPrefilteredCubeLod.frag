void addAmbient(inout psInternalData data) {
    vec3 fixedReflDir = fixSeamsStatic(data.normalW, 1.0 - 1.0 / 4.0);
    fixedReflDir.x *= -1.0;
    data.diffuseLight = processEnvironment($DECODE( textureCubeLodEXT(texture_prefilteredCubeMap128, fixedReflDir, 5.0) ).rgb);
}

