import { CHUNKAPI_1_51, CHUNKAPI_1_55, CHUNKAPI_1_56, CHUNKAPI_1_57, CHUNKAPI_1_60, CHUNKAPI_1_62, CHUNKAPI_1_65, CHUNKAPI_1_70 } from '../../../platform/graphics/constants.js';
import { Debug } from '../../../core/debug.js';
import { shaderChunks } from './chunks.js';

const chunkVersions = {
    // frontend
    aoPS: CHUNKAPI_1_57,
    clearCoatPS: CHUNKAPI_1_57,
    clearCoatGlossPS: CHUNKAPI_1_60,
    clearCoatNormalPS: CHUNKAPI_1_57,
    diffusePS: CHUNKAPI_1_57,
    diffuseDetailMapPS: CHUNKAPI_1_57,
    emissivePS: CHUNKAPI_1_57,
    glossPS: CHUNKAPI_1_60,
    lightmapDirPS: CHUNKAPI_1_55,
    lightmapSinglePS: CHUNKAPI_1_55,
    metalnessPS: CHUNKAPI_1_57,
    normalMapPS: CHUNKAPI_1_57,
    normalDetailMapPS: CHUNKAPI_1_57,
    opacityPS: CHUNKAPI_1_57,
    parallaxPS: CHUNKAPI_1_57,
    sheenPS: CHUNKAPI_1_57,
    sheenGlossPS: CHUNKAPI_1_60,
    specularPS: CHUNKAPI_1_57,
    specularityFactorPS: CHUNKAPI_1_57,
    thicknessPS: CHUNKAPI_1_57,
    transmissionPS: CHUNKAPI_1_57,

    // backend
    normalVertexPS: CHUNKAPI_1_55,
    startPS: CHUNKAPI_1_55,

    ambientConstantPS: CHUNKAPI_1_62,
    ambientEnvPS: CHUNKAPI_1_62,
    ambientSHPS: CHUNKAPI_1_62,
    aoDiffuseOccPS: CHUNKAPI_1_62,
    aoSpecOccPS: CHUNKAPI_1_62,
    aoSpecOccConstPS: CHUNKAPI_1_62,
    aoSpecOccConstSimplePS: CHUNKAPI_1_62,
    aoSpecOccSimplePS: CHUNKAPI_1_62,
    clusteredLightPS: CHUNKAPI_1_62,
    clusteredLightShadowPS: CHUNKAPI_1_62,
    combinePS: CHUNKAPI_1_62,
    falloffInvSquaredPS: CHUNKAPI_1_62,
    falloffLinearPS: CHUNKAPI_1_62,
    lightDiffuseLambertPS: CHUNKAPI_1_62,
    lightSheenPS: CHUNKAPI_1_62,
    lightSpecularAnisoGGXPS: CHUNKAPI_1_62,
    lightSpecularBlinnPS: CHUNKAPI_1_62,
    ltcPS: CHUNKAPI_1_62,
    reflDirPS: CHUNKAPI_1_62,
    reflDirAnisoPS: CHUNKAPI_1_62,
    reflectionCCPS: CHUNKAPI_1_62,
    reflectionCubePS: CHUNKAPI_1_62,
    reflectionEnvPS: CHUNKAPI_1_62,
    reflectionEnvHQPS: CHUNKAPI_1_62,
    reflectionSheenPS: CHUNKAPI_1_62,
    reflectionSpherePS: CHUNKAPI_1_62,
    shadowCommonPS: CHUNKAPI_1_62,
    shadowCoordPS: CHUNKAPI_1_62,
    shadowCoordPerspZBufferPS: CHUNKAPI_1_62,
    shadowEVSMPS: CHUNKAPI_1_62,
    shadowEVSMnPS: CHUNKAPI_1_62,
    shadowStandardPS: CHUNKAPI_1_62,
    shadowStandardGL2PS: CHUNKAPI_1_62,
    shadowVSM8PS: CHUNKAPI_1_62,
    spotPS: CHUNKAPI_1_62,
    TBNPS: CHUNKAPI_1_62,
    TBNObjectSpacePS: CHUNKAPI_1_62,
    TBNderivativePS: CHUNKAPI_1_62,
    TBNfastPS: CHUNKAPI_1_62,

    endPS: CHUNKAPI_1_65,
    metalnessModulatePS: CHUNKAPI_1_65,
    outputAlphaPS: CHUNKAPI_1_65,
    outputAlphaPremulPS: CHUNKAPI_1_65,
    fresnelSchlickPS: CHUNKAPI_1_65,
    iridescenceDiffractionPS: CHUNKAPI_1_65,
    lightmapAddPS: CHUNKAPI_1_65,
    lightmapDirAddPS: CHUNKAPI_1_65,
    refractionCubePS: CHUNKAPI_1_70,
    refractionDynamicPS: CHUNKAPI_1_70
};

// removed
const removedChunks = {
    ambientPrefilteredCubePS: CHUNKAPI_1_51,
    ambientPrefilteredCubeLodPS: CHUNKAPI_1_51,
    dpAtlasQuadPS: CHUNKAPI_1_51,
    genParaboloidPS: CHUNKAPI_1_51,
    prefilterCubemapPS: CHUNKAPI_1_51,
    reflectionDpAtlasPS: CHUNKAPI_1_51,
    reflectionPrefilteredCubePS: CHUNKAPI_1_51,
    reflectionPrefilteredCubeLodPS: CHUNKAPI_1_51,
    refractionPS: CHUNKAPI_1_56,
    combineClearCoatPS: CHUNKAPI_1_56,
    combineDiffusePS: CHUNKAPI_1_56,
    combineDiffuseSpecularPS: CHUNKAPI_1_56,
    combineDiffuseSpecularNoReflPS: CHUNKAPI_1_56,
    combineDiffuseSpecularNoReflSeparateAmbientPS: CHUNKAPI_1_56,
    combineDiffuseSpecularOldPS: CHUNKAPI_1_56,
    lightmapSingleVertPS: CHUNKAPI_1_55,
    normalMapFastPS: CHUNKAPI_1_55,
    specularAaNonePS: CHUNKAPI_1_55,
    specularAaToksvigPS: CHUNKAPI_1_55,
    specularAaToksvigFastPS: CHUNKAPI_1_55
};

// compare two "major.minor" semantic version strings and return true if a is a smaller version than b.
const semverLess = (a, b) => {
    const aver = a.split('.').map(t => parseInt(t, 10));
    const bver = b.split('.').map(t => parseInt(t, 10));
    return (aver[0] < bver[0]) || ((aver[0] === bver[0]) && (aver[1] < bver[1]));
};

// validate user chunks
const validateUserChunks = (userChunks) => {
    const userAPIVersion = userChunks.APIVersion;
    for (const chunkName in userChunks) {
        if (chunkName === 'APIVersion') {
            continue;
        }

        if (!shaderChunks.hasOwnProperty(chunkName)) {
            const removedVersion = removedChunks[chunkName];
            if (removedVersion) {
                Debug.warnOnce(`Shader chunk '${chunkName}' was removed in API ${removedVersion} and is no longer supported.`);
            } else {
                Debug.warnOnce(`Shader chunk '${chunkName}' is not supported.`);
            }
        } else {
            const engineAPIVersion = chunkVersions[chunkName];
            const chunkIsOutdated = engineAPIVersion && (!userAPIVersion || semverLess(userAPIVersion, engineAPIVersion));

            if (chunkIsOutdated) {
                Debug.warnOnce(`Shader chunk '${chunkName}' is API version ${engineAPIVersion}, but the supplied chunk is version ${userAPIVersion || '-'}. Please update to the latest API: https://developer.playcanvas.com/user-manual/graphics/shader-chunk-migrations/`);
            }
        }
    }
};

export {
    validateUserChunks
};
