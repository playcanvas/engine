import { CHUNKAPI_1_51, CHUNKAPI_1_54 } from '../../constants.js';
import { Debug } from '../../../core/debug.js';
import { shaderChunks } from './chunks.js';

const chunkVersions = {
    // frontend
    aoPS: CHUNKAPI_1_51,
    clearCoatNormalPS: CHUNKAPI_1_54,
    diffusePS: CHUNKAPI_1_54,
    diffuseDetailMapPS: CHUNKAPI_1_54,
    emissivePS: CHUNKAPI_1_54,
    lightmapDirPS: CHUNKAPI_1_54,
    lightmapSinglePS: CHUNKAPI_1_54,
    normalMapPS: CHUNKAPI_1_54,
    normalDetailMapPS: CHUNKAPI_1_54,

    // backend
    clusteredLightPS: CHUNKAPI_1_54,
    endPS: CHUNKAPI_1_54,
    lightmapAddPS: CHUNKAPI_1_54,
    lightmapDirAddPS: CHUNKAPI_1_54,
    lightSpecularAnisoGGXPS: CHUNKAPI_1_54,
    lightSpecularBlinnPS: CHUNKAPI_1_54,
    lightSpecularPhongPS: CHUNKAPI_1_54,
    normalVertexPS: CHUNKAPI_1_54,
    startPS: CHUNKAPI_1_54,
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

    lightmapSingleVertPS: CHUNKAPI_1_54,
    normalMapFastPS: CHUNKAPI_1_54,
    specularAaNonePS: CHUNKAPI_1_54,
    specularAaToksvigPS: CHUNKAPI_1_54,
    specularAaToksvigFastPS: CHUNKAPI_1_54
};

// compare two "major.minor" semantic version strings and return true if a is a smaller version than b.
const semverLess = (a, b) => {
    const aver = a.split('.').map(t => parseInt(t, 10));
    const bver = b.split('.').map(t => parseInt(t, 10));
    return (aver[0] < bver[0]) || ((aver[0] === bver[0]) && (aver[1] < bver[1]));
};

// validate user chunks
const validateUserChunks = (userChunks) => {
    const result = { };

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

            result[chunkName] = userChunks[chunkName];
        }
    }
    return result;
};

export {
    validateUserChunks
};
