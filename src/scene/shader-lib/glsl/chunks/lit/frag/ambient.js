export default /* glsl */`

#ifdef LIT_AMBIENT_SOURCE == AMBIENTSH
    uniform vec3 ambientSH[9];
#endif

#if LIT_AMBIENT_SOURCE == ENVALATLAS
    #include "envAtlasPS"

    #ifndef ENV_ATLAS
    #define ENV_ATLAS
        uniform sampler2D texture_envAtlas;
    #endif
#endif

void addAmbient(vec3 worldNormal) {
    #ifdef LIT_AMBIENT_SOURCE == AMBIENTSH

        vec3 n = cubeMapRotate(worldNormal);
        vec3 color =
            ambientSH[0] +
            ambientSH[1] * n.x +
            ambientSH[2] * n.y +
            ambientSH[3] * n.z +
            ambientSH[4] * n.x * n.z +
            ambientSH[5] * n.z * n.y +
            ambientSH[6] * n.y * n.x +
            ambientSH[7] * (3.0 * n.z * n.z - 1.0) +
            ambientSH[8] * (n.x * n.x - n.y * n.y);

        dDiffuseLight += processEnvironment(max(color, vec3(0.0)));

    #endif

    #if LIT_AMBIENT_SOURCE == ENVALATLAS
        // magnopus patched - correct ambient rotation
        vec3 dir = normalize(cubeMapRotate(worldNormal) * vec3(1.0, 1.0, -1.0));

        vec2 uv = mapUv(toSphericalUv(dir), vec4(128.0, 256.0 + 128.0, 64.0, 32.0) / atlasSize);

        vec4 raw = texture2D(texture_envAtlas, uv);
        vec3 linear = {ambientDecode}(raw);
        dDiffuseLight += processEnvironment(linear);

    #endif

    #if LIT_AMBIENT_SOURCE == CONSTANT

        dDiffuseLight += light_globalAmbient;

    #endif
}
`;
