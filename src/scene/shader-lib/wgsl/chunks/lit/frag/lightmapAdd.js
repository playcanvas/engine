export default /* wgsl */`
fn addLightMap(
    lightmap: vec3f,
    dir: vec3f,
    worldNormal: vec3f,
    viewDir: vec3f,
    reflectionDir: vec3f,
    gloss: f32,
    specularity: vec3f,
    vertexNormal: vec3f,
    tbn: mat3x3f
#if defined(LIT_IRIDESCENCE)
    , iridescenceFresnel: vec3f,
    iridescenceIntensity: f32
#endif
) {

    // directional lightmap
    #if defined(LIT_SPECULAR) && defined(LIT_DIR_LIGHTMAP)

        if (dot(dir, dir) < 0.0001) {
                dDiffuseLight = dDiffuseLight + lightmap;
        } else {
            let vlight: f32 = saturate(dot(dir, -vertexNormal));
            let flight: f32 = saturate(dot(dir, -worldNormal));
            let nlight: f32 = (flight / max(vlight, 0.01)) * 0.5;

            dDiffuseLight = dDiffuseLight + lightmap * nlight * 2.0;

            let halfDir: vec3f = normalize(-dir + viewDir);
            var specularLight: vec3f = lightmap * getLightSpecular(halfDir, reflectionDir, worldNormal, viewDir, dir, gloss, tbn);

            #ifdef LIT_SPECULAR_FRESNEL

                specularLight = specularLight *
                    getFresnel(dot(viewDir, halfDir),
                    gloss,
                    specularity
                #if defined(LIT_IRIDESCENCE)
                    , iridescenceFresnel,
                    iridescenceIntensity
                #endif
                    );
            #endif

            dSpecularLight = dSpecularLight + specularLight;
        }

    #else // non-directional lightmap

        dDiffuseLight = dDiffuseLight + lightmap;

    #endif
}
`;
