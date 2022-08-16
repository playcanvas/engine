import { CHUNKAPI_1_51, CHUNKAPI_1_55, CHUNKAPI_1_56 } from '../../constants.js';
import { Debug } from '../../../core/debug.js';
import { shaderChunks } from './chunks.js';

const chunkVersions = {
    // frontend
    aoPS: CHUNKAPI_1_51,
    clearCoatNormalPS: CHUNKAPI_1_55,
    diffusePS: CHUNKAPI_1_55,
    diffuseDetailMapPS: CHUNKAPI_1_55,
    emissivePS: CHUNKAPI_1_55,
    lightmapDirPS: CHUNKAPI_1_55,
    lightmapSinglePS: CHUNKAPI_1_55,
    metalnessPS: CHUNKAPI_1_55,
    specularPS: CHUNKAPI_1_55,
    normalMapPS: CHUNKAPI_1_55,
    normalDetailMapPS: CHUNKAPI_1_55,
    thicknessPS: CHUNKAPI_1_56,

    // backend
    clusteredLightPS: CHUNKAPI_1_55,
    fresnelSchlickPS: CHUNKAPI_1_55,
    endPS: CHUNKAPI_1_55,
    lightmapAddPS: CHUNKAPI_1_55,
    lightmapDirAddPS: CHUNKAPI_1_55,
    lightSpecularAnisoGGXPS: CHUNKAPI_1_55,
    lightSpecularBlinnPS: CHUNKAPI_1_55,
    lightSpecularPhongPS: CHUNKAPI_1_55,
    normalVertexPS: CHUNKAPI_1_55,
    startPS: CHUNKAPI_1_55,
    refractionCubePS: CHUNKAPI_1_56,
    refractionDynamicPS: CHUNKAPI_1_56
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
                Debug.warnOnce(`Shader chunk '${chunkName}' is API version ${engineAPIVersion}, but the supplied chunk is version ${userAPIVersion || '-'}. Please update to the latest API.`);
            }
        }
    }
};

export {
    validateUserChunks
};
