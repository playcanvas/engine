// Area lights of clustered lighting, evaluated with the LTC functions of ltcPS.
export default /* wgsl */`

// Area light dimensions and orientation, decoded on demand only for non-punctual lights.
struct ClusterLightAreaData {
    halfWidth: vec3f,
    halfHeight: vec3f
}

// The LTC evaluations of an area light: the diffuse and diffuse transmission attenuations, and the
// specular and clear coat specular terms.
struct ClusterAreaLightLobes {
    diffuse: f32,
    transmission: f32,
    specular: f32,
    specularCC: f32
}

fn decodeClusterLightAreaData(lightIndex: i32) -> ClusterLightAreaData {
    return ClusterLightAreaData(
        sampleLightTextureF(lightIndex, {CLUSTER_TEXTURE_AREA_DATA_WIDTH}).xyz,
        sampleLightTextureF(lightIndex, {CLUSTER_TEXTURE_AREA_DATA_HEIGHT}).xyz
    );
}

// Prepares the LTC coordinates of an area light, and returns its distance attenuation.
fn prepareClusterAreaLight(light: ClusterLightData, lightDirW: vec3f) -> f32 {

    let areaData: ClusterLightAreaData = decodeClusterLightAreaData(light.lightIndex);

    // handle light shape, only the enabled shapes are compiled (a disk uses the rect coordinates)
    #ifdef CLUSTER_AREALIGHT_SPHERE
    if (light.shape == {LIGHTSHAPE_SPHERE}) {
        calcSphereLightValues(light.position, areaData.halfWidth, areaData.halfHeight);
    } else
    #endif
    {
        calcRectLightValues(light.position, areaData.halfWidth, areaData.halfHeight);
    }

    return getFalloffWindow(light.range, lightDirW);
}

fn evaluateClusterAreaLightLobes(light: ClusterLightData, worldNormal: vec3f, viewDir: vec3f, lightDirW: vec3f, lightDirNormW: vec3f, clearcoat_worldNormal: vec3f) -> ClusterAreaLightLobes {

    var lobes = ClusterAreaLightLobes(0.0, 0.0, 0.0, 0.0);

    // All LTC evaluations of the light - diffuse (0), diffuse transmission (1), specular (2)
    // and clear coat specular (3) - go through a single loop, so the large LTC functions are
    // emitted once instead of once per term and shape. Shader compilers inline all calls,
    // and on Windows (FXC / DXC) the compile time of the inlined copies dominates.
    let areaIsRect: bool = light.shape == {LIGHTSHAPE_RECT};
    let areaIsDisk: bool = light.shape == {LIGHTSHAPE_DISK};
    let identityInvMat = mat3x3f(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), vec3f(0.0, 0.0, 1.0));

    // LTC matrices of the specular and the clear coat specular, from their own gloss and normal
    #ifdef LIT_SPECULAR
        let areaSpecularInvMat: mat3x3f = getLTCLightInvMat(dLTCUV);
    #endif
    #ifdef LIT_CLEARCOAT
        let areaClearcoatInvMat: mat3x3f = getLTCLightInvMat(ccLTCUV);
    #endif

    for (var lobe: i32 = 0; lobe < 4; lobe++) {

        #ifndef LIT_DIFFUSE_TRANSMISSION
            if (lobe == 1) { continue; }
        #endif
        #ifndef LIT_SPECULAR
            if (lobe == 2) { break; }
        #endif
        #ifndef LIT_CLEARCOAT
            if (lobe == 3) { break; }
        #endif

        var lobeNormal: vec3f = select(worldNormal, -worldNormal, lobe == 1);
        var lobeInvMat: mat3x3f = identityInvMat;
        #ifdef LIT_SPECULAR
            if (lobe >= 2) { lobeInvMat = areaSpecularInvMat; }
        #endif
        #ifdef LIT_CLEARCOAT
            if (lobe == 3) {
                lobeNormal = clearcoat_worldNormal;
                lobeInvMat = areaClearcoatInvMat;
            }
        #endif

        // only the enabled area light shapes are compiled
        var lobeValue: f32 = 0.0;
        #ifdef CLUSTER_AREALIGHT_RECT
        if (areaIsRect) {
            lobeValue = LTC_EvaluateRect(lobeNormal, viewDir, litArgs_worldPosition, lobeInvMat, dLTCCoords);
        } else
        #endif
        #if defined(CLUSTER_AREALIGHT_DISK) || defined(CLUSTER_AREALIGHT_SPHERE)
        if (areaIsDisk || lobe >= 2) {
            // the specular of a sphere light uses the disk facing the reflection
            lobeValue = LTC_EvaluateDisk(lobeNormal, viewDir, litArgs_worldPosition, lobeInvMat, dLTCCoords);
            if (lobe < 2) { lobeValue = FixNan(lobeValue); }
        } else
        #endif
        {
            #ifdef CLUSTER_AREALIGHT_SPHERE
                lobeValue = getSphereLightDiffuse(lobeNormal, viewDir, lightDirW, lightDirNormW);
            #endif
        }

        if (lobe == 0) { lobes.diffuse = lobeValue * 16.0; }
        if (lobe == 1) { lobes.transmission = lobeValue * 16.0; }
        if (lobe == 2) { lobes.specular = lobeValue; }
        if (lobe == 3) { lobes.specularCC = lobeValue; }
    }

    return lobes;
}

// Adds the lighting of an area light. The light color includes the cookie attenuation, and the
// transmission attenuation is only used with diffuse transmission.
fn addClusterAreaLight(lobes: ClusterAreaLightLobes, falloffAttenuation: f32, transmissionAttenuation: f32, lightColor: vec3f) {

    // area light diffuse
    var areaDiffuse: vec3f = (lobes.diffuse * falloffAttenuation) * lightColor;

    #if defined(LIT_SPECULAR)
        areaDiffuse = mix(areaDiffuse, vec3f(0.0), dLTCSpecFres);
    #endif

    // area light diffuse - it does not mix diffuse lighting into specular attenuation
    dDiffuseLight = dDiffuseLight + areaDiffuse;

    #ifdef LIT_DIFFUSE_TRANSMISSION
        var areaTransmission: vec3f = transmissionAttenuation * lightColor;

        #if defined(LIT_SPECULAR)
            areaTransmission = mix(areaTransmission, vec3f(0.0), dLTCSpecFres);
        #endif

        dDiffuseTransmissionLight = dDiffuseTransmissionLight + areaTransmission;
    #endif

    // specular and clear coat are material settings and get included by a define based on the material
    #ifdef LIT_SPECULAR

        // area light specular, evaluated together with the diffuse term
        dSpecularLight = dSpecularLight + dLTCSpecFres * lobes.specular * falloffAttenuation * lightColor;

        #ifdef LIT_CLEARCOAT

            // area light specular clear coat
            ccSpecularLight = ccSpecularLight + ccLTCSpecFres * lobes.specularCC * falloffAttenuation * lightColor;

        #endif

    #endif
}
`;
