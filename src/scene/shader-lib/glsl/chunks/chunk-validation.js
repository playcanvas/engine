import { Debug } from '../../../core/debug.js';

const chunkVersions = {
    // frontend
    aoPS: '1.57',
    clearCoatPS: '1.57',
    clearCoatGlossPS: '1.60',
    clearCoatNormalPS: '1.57',
    diffusePS: '1.57',
    emissivePS: '1.57',
    glossPS: '1.60',
    metalnessPS: '1.57',
    normalMapPS: '1.57',
    opacityPS: '1.57',
    parallaxPS: '1.57',
    sheenPS: '1.57',
    sheenGlossPS: '1.60',
    specularPS: '1.57',
    specularityFactorPS: '1.57',
    thicknessPS: '1.57',
    transmissionPS: '1.57',

    // backend
    normalVertexPS: '1.55',
    aoDiffuseOccPS: '1.62',
    aoSpecOccPS: '2.6',
    clusteredLightPS: '1.62',
    clusteredLightShadowPS: '1.62',
    combinePS: '1.62',
    falloffInvSquaredPS: '1.62',
    falloffLinearPS: '1.62',
    lightDiffuseLambertPS: '1.62',
    lightSheenPS: '1.62',
    lightSpecularAnisoGGXPS: '1.62',
    lightSpecularBlinnPS: '1.62',
    ltcPS: '1.62',
    reflDirPS: '1.62',
    reflDirAnisoPS: '1.62',
    reflectionCCPS: '1.62',
    reflectionCubePS: '2.6',
    reflectionEnvPS: '2.6',
    reflectionEnvHQPS: '2.6',
    reflectionSpherePS: '2.6',
    reflectionSheenPS: '1.62',
    shadowCommonPS: '1.62',
    shadowCoordPS: '1.62',
    shadowCoordPerspZBufferPS: '1.62',
    shadowEVSMPS: '1.62',
    spotPS: '1.62',
    TBNPS: '1.62',

    endPS: '1.65',
    metalnessModulatePS: '1.65',
    outputAlphaPS: '1.65',
    outputAlphaPremulPS: '1.65',
    fresnelSchlickPS: '1.65',
    iridescenceDiffractionPS: '1.65',
    lightmapAddPS: '1.65',
    refractionCubePS: '1.70',
    refractionDynamicPS: '1.70'
};

// removed
const removedChunks = {
    ambientPrefilteredCubePS: '1.51',
    ambientPrefilteredCubeLodPS: '1.51',
    dpAtlasQuadPS: '1.51',
    genParaboloidPS: '1.51',
    prefilterCubemapPS: '1.51',
    reflectionDpAtlasPS: '1.51',
    reflectionPrefilteredCubePS: '1.51',
    reflectionPrefilteredCubeLodPS: '1.51',
    refractionPS: '1.56',
    combineClearCoatPS: '1.56',
    combineDiffusePS: '1.56',
    combineDiffuseSpecularPS: '1.56',
    combineDiffuseSpecularNoReflPS: '1.56',
    combineDiffuseSpecularNoReflSeparateAmbientPS: '1.56',
    combineDiffuseSpecularOldPS: '1.56',
    lightmapSingleVertPS: '1.55',
    normalMapFastPS: '1.55',
    specularAaNonePS: '1.55',
    specularAaToksvigPS: '1.55',
    specularAaToksvigFastPS: '1.55',
    skyboxEnvPS: '2.1',
    skyboxHDRPS: '2.1',
    shadowVSM8PS: '2.3',
    fogExpPS: '2.5',
    fogExp2PS: '2.5',
    fogLinearPS: '2.5',
    fogNonePS: '2.5',
    gamma1_0PS: '2.5',
    gamma2_2PS: '2.5',
    storeEVSMPS: '2.6',
    shadowEVSMnPS: '2.6',
    shadowVSM_commonPS: '2.6',
    shadowStandardPS: '2.6',
    shadowStandardGL2PS: '2.6',
    startVS: '2.6',
    endVS: '2.6',
    baseVS: '2.6',
    baseNineSlicedVS: '2.6',
    viewNormalVS: '2.6',
    lightmapDirAddPS: '2.6',
    TBNObjectSpacePS: '2.6',
    TBNderivativePS: '2.6',
    startPS: '2.6',
    outputAlphaOpaque: '2.6',
    outputAlphaPremul: '2.6',
    cubeMapProjectBoxPS: '2.6',
    cubeMapProjectNonePS: '2.6',
    envMultiplyPS: '2.6',
    envConstPS: '2.6',
    aoSpecOccConstPS: '2.6',
    aoSpecOccConstSimplePS: '2.6',
    aoSpecOccSimplePS: '2.6',
    ambientConstantPS: '2.6',
    ambientEnvPS: '2.6',
    ambientSHPS: '2.6',
    shadowSampleCoordPS: '2.6',
    diffuseDetailMapPS: '2.7',
    normalDetailMapPS: '2.7',
    normalXYPS: '2.7',
    normalXYZPS: '2.7',
    aoDetailMapPS: '2.7',
    lightmapDirPS: '2.7',
    lightmapSinglePS: '2.7',
    tangentBinormalVS: '2.7'
};

// compare two "major.minor" semantic version strings and return true if a is a smaller version than b.
const semverLess = (a, b) => {
    const aver = a.split('.').map(t => parseInt(t, 10));
    const bver = b.split('.').map(t => parseInt(t, 10));
    return (aver[0] < bver[0]) || ((aver[0] === bver[0]) && (aver[1] < bver[1]));
};

/**
 * @param {Map<string, string>} userChunks - User-defined shader chunks, stored in a Map.
 * @param {string} userAPIVersion - The API version of the user-defined shader chunks.
 */
const validateUserChunks = (userChunks, userAPIVersion) => {
    for (const chunkName of userChunks.keys()) {
        if (removedChunks.hasOwnProperty(chunkName)) {
            const removedVersion = removedChunks[chunkName];
            Debug.warnOnce(`Shader chunk '${chunkName}' was removed in API ${removedVersion} and is no longer supported.`);
        } else {
            const engineAPIVersion = chunkVersions[chunkName];
            const chunkIsOutdated = engineAPIVersion && (!userAPIVersion || semverLess(userAPIVersion, engineAPIVersion));

            if (chunkIsOutdated) {
                Debug.warnOnce(`Shader chunk '${chunkName}' is API version ${engineAPIVersion}, but the supplied chunk is version ${userAPIVersion || 'undefined'}. Please update to the latest API: https://developer.playcanvas.com/user-manual/graphics/shader-chunk-migrations/`);
            }
        }
    }
};

export { validateUserChunks };
