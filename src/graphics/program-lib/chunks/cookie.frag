vec3 getCookie2D(sampler2D tex, mat4 transform) {
    vec4 projPos = transform * vec4(vPositionW, 1.0);
    projPos.xy /= projPos.w;
    return texture2D(tex, projPos.xy).rgb;
}

vec3 getCookieCube(samplerCube tex, mat4 transform) {
    return textureCube(tex, dLightDirNormW * mat3(transform)).rgb;
}

