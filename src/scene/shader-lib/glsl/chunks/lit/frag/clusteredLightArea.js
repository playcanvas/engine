// Area lights of clustered lighting, evaluated with the LTC functions of ltcPS.
export default /* glsl */`

// Area light dimensions and orientation, decoded on demand only for non-punctual lights.
struct ClusterLightAreaData {
    vec3 halfWidth;
    vec3 halfHeight;
};

// The LTC evaluations of an area light: the diffuse and diffuse transmission attenuations, and the
// specular and clear coat specular terms.
struct ClusterAreaLightLobes {
    float diffuse;
    float transmission;
    float specular;
    float specularCC;
};

ClusterLightAreaData decodeClusterLightAreaData(int lightIndex) {
    return ClusterLightAreaData(
        sampleLightTextureF(lightIndex, {CLUSTER_TEXTURE_AREA_DATA_WIDTH}).xyz,
        sampleLightTextureF(lightIndex, {CLUSTER_TEXTURE_AREA_DATA_HEIGHT}).xyz
    );
}

// Prepares the LTC coordinates of an area light, and returns its distance attenuation.
float prepareClusterAreaLight(ClusterLightData light, vec3 lightDirW) {

    ClusterLightAreaData areaData = decodeClusterLightAreaData(light.lightIndex);

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

ClusterAreaLightLobes evaluateClusterAreaLightLobes(ClusterLightData light, vec3 worldNormal, vec3 viewDir, vec3 lightDirW, vec3 lightDirNormW, vec3 clearcoat_worldNormal) {

    ClusterAreaLightLobes lobes = ClusterAreaLightLobes(0.0, 0.0, 0.0, 0.0);

    // All LTC evaluations of the light - diffuse (0), diffuse transmission (1), specular (2)
    // and clear coat specular (3) - go through a single loop, so the large LTC functions are
    // emitted once instead of once per term and shape. Shader compilers inline all calls,
    // and on Windows (FXC / DXC) the compile time of the inlined copies dominates.
    bool areaIsRect = light.shape == {LIGHTSHAPE_RECT};
    bool areaIsDisk = light.shape == {LIGHTSHAPE_DISK};

    // LTC matrices of the specular and the clear coat specular, from their own gloss and normal
    #ifdef LIT_SPECULAR
        mat3 areaSpecularInvMat = getLTCLightInvMat(dLTCUV);
    #endif
    #ifdef LIT_CLEARCOAT
        mat3 areaClearcoatInvMat = getLTCLightInvMat(ccLTCUV);
    #endif

    for (int lobe = 0; lobe < 4; lobe++) {

        #ifndef LIT_DIFFUSE_TRANSMISSION
            if (lobe == 1) continue;
        #endif
        #ifndef LIT_SPECULAR
            if (lobe == 2) break;
        #endif
        #ifndef LIT_CLEARCOAT
            if (lobe == 3) break;
        #endif

        vec3 lobeNormal = lobe == 1 ? -worldNormal : worldNormal;
        mat3 lobeInvMat = mat3(1.0);
        #ifdef LIT_SPECULAR
            if (lobe >= 2) lobeInvMat = areaSpecularInvMat;
        #endif
        #ifdef LIT_CLEARCOAT
            if (lobe == 3) {
                lobeNormal = clearcoat_worldNormal;
                lobeInvMat = areaClearcoatInvMat;
            }
        #endif

        // only the enabled area light shapes are compiled
        float lobeValue = 0.0;
        #ifdef CLUSTER_AREALIGHT_RECT
        if (areaIsRect) {
            lobeValue = LTC_EvaluateRect(lobeNormal, viewDir, litArgs_worldPosition, lobeInvMat, dLTCCoords);
        } else
        #endif
        #if defined(CLUSTER_AREALIGHT_DISK) || defined(CLUSTER_AREALIGHT_SPHERE)
        if (areaIsDisk || lobe >= 2) {
            // the specular of a sphere light uses the disk facing the reflection
            lobeValue = LTC_EvaluateDisk(lobeNormal, viewDir, litArgs_worldPosition, lobeInvMat, dLTCCoords);
            if (lobe < 2) lobeValue = FixNan(lobeValue);
        } else
        #endif
        {
            #ifdef CLUSTER_AREALIGHT_SPHERE
                lobeValue = getSphereLightDiffuse(lobeNormal, viewDir, lightDirW, lightDirNormW);
            #endif
        }

        if (lobe == 0) lobes.diffuse = lobeValue * 16.0;
        if (lobe == 1) lobes.transmission = lobeValue * 16.0;
        if (lobe == 2) lobes.specular = lobeValue;
        if (lobe == 3) lobes.specularCC = lobeValue;
    }

    return lobes;
}

// Adds the lighting of an area light. The light color includes the cookie attenuation, and the
// transmission attenuation is only used with diffuse transmission.
void addClusterAreaLight(ClusterAreaLightLobes lobes, float falloffAttenuation, float transmissionAttenuation, vec3 lightColor) {

    // area light diffuse
    vec3 areaDiffuse = (lobes.diffuse * falloffAttenuation) * lightColor;

    #if defined(LIT_SPECULAR)
        areaDiffuse = mix(areaDiffuse, vec3(0), dLTCSpecFres);
    #endif

    // area light diffuse - it does not mix diffuse lighting into specular attenuation
    dDiffuseLight += areaDiffuse;

    #ifdef LIT_DIFFUSE_TRANSMISSION
        vec3 areaTransmission = transmissionAttenuation * lightColor;

        #if defined(LIT_SPECULAR)
            areaTransmission = mix(areaTransmission, vec3(0), dLTCSpecFres);
        #endif

        dDiffuseTransmissionLight += areaTransmission;
    #endif

    // specular and clear coat are material settings and get included by a define based on the material
    #ifdef LIT_SPECULAR

        // area light specular, evaluated together with the diffuse term
        dSpecularLight += dLTCSpecFres * lobes.specular * falloffAttenuation * lightColor;

        #ifdef LIT_CLEARCOAT

            // area light specular clear coat
            ccSpecularLight += ccLTCSpecFres * lobes.specularCC * falloffAttenuation * lightColor;

        #endif

    #endif
}
`;
