export default /* wgsl */`

#if LIT_AMBIENT_SOURCE == AMBIENTSH
    uniform ambientSH: array<vec3f, 9>;
#endif

#if LIT_AMBIENT_SOURCE == ENVALATLAS
    #include "envAtlasPS"

    #ifndef ENV_ATLAS
        #define ENV_ATLAS
        var texture_envAtlas: texture_2d<f32>;
        var texture_envAtlasSampler: sampler;
    #endif
#endif

fn addAmbient(worldNormal: vec3f) {
    #ifdef LIT_AMBIENT_SOURCE == AMBIENTSH

        let n: vec3f = cubeMapRotate(worldNormal);
        let color: vec3f =
            uniform.ambientSH[0] +
            uniform.ambientSH[1] * n.x +
            uniform.ambientSH[2] * n.y +
            uniform.ambientSH[3] * n.z +
            uniform.ambientSH[4] * n.x * n.z +
            uniform.ambientSH[5] * n.z * n.y +
            uniform.ambientSH[6] * n.y * n.x +
            uniform.ambientSH[7] * (3.0 * n.z * n.z - 1.0) +
            uniform.ambientSH[8] * (n.x * n.x - n.y * n.y);

        dDiffuseLight += processEnvironment(max(color, vec3f(0.0)));

    #endif

    #if LIT_AMBIENT_SOURCE == ENVALATLAS

        let dir: vec3f = normalize(cubeMapRotate(worldNormal) * vec3f(-1.0, 1.0, 1.0));
        let uv: vec2f = mapUv(toSphericalUv(dir), vec4f(128.0, 256.0 + 128.0, 64.0, 32.0) / atlasSize);

        let raw: vec4f = textureSample(texture_envAtlas, texture_envAtlasSampler, uv);
        let linear: vec3f = {ambientDecode}(raw);
        dDiffuseLight += processEnvironment(linear);

    #endif

    #if LIT_AMBIENT_SOURCE == CONSTANT

        dDiffuseLight += uniform.light_globalAmbient;

    #endif
}
`;
