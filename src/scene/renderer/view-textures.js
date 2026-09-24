/**
 * @import { UniformBufferFormat } from '../../platform/graphics/uniform-buffer-format.js'
 */

/**
 * The textures the renderer sets once per pass or per frame, whatever the lights of the pass. On
 * WebGPU the shaders of the materials built from the engine shader chunks read these from the view
 * bind group, which the renderer builds once per pass, instead of each draw binding them in its
 * mesh bind group. See Material#_usesViewTextures.
 */
const viewTextureNames = [
    // clustered lighting
    'clusterWorldTexture', 'lightsTexture', 'shadowAtlasTexture', 'cookieAtlasTexture',

    // scene environment
    'scene_envAtlas', 'scene_skybox',

    // area lights
    'areaLightsLutTex1', 'areaLightsLutTex2',

    // opacity dithering
    'blueNoiseTex32',

    // scene textures
    'uSceneDepthMap', 'uSceneColorMap',

    // ambient occlusion applied in lighting
    'ssaoTexture'
];

const viewTextureNameSet = new Set(viewTextureNames);

// the shadow map and the cookie of a light slot, see LightSlotUniforms
const lightSlotTexture = /^light\d+_(?:shadowMap|cookie)$/;

/**
 * The view textures of each view uniform format.
 *
 * @type {WeakMap<UniformBufferFormat, Set<string>>}
 */
const _viewTexturesCache = new WeakMap();

/**
 * Returns the names of the textures the view bind group holds for shaders processed against a
 * view uniform format: the textures set once per pass or per frame, and the shadow map and the
 * cookie of each light slot the format holds, which the light dispatch of the pass sets. A name no
 * shader declares costs nothing. The set is a function of the format alone, so the key of the
 * format identifies it in the shader processing key.
 *
 * @param {UniformBufferFormat} [viewUniformFormat] - The view uniform format.
 * @returns {Set<string>|null} The names, or null without a view uniform format.
 * @ignore
 */
const getViewTextures = (viewUniformFormat) => {
    if (!viewUniformFormat) {
        return null;
    }

    let names = _viewTexturesCache.get(viewUniformFormat);
    if (!names) {
        names = new Set(viewTextureNames);

        // the slots are numbered from 0, and each declares its color, see LightSlotUniforms
        for (let slot = 0; viewUniformFormat.get(`light${slot}_color`); slot++) {
            names.add(`light${slot}_shadowMap`);
            names.add(`light${slot}_cookie`);
        }

        _viewTexturesCache.set(viewUniformFormat, names);
    }
    return names;
};

/**
 * Returns true for a name of a texture the renderer supplies through the view bind group in some
 * pass, which is ignored when set on a material using view textures, or on a mesh instance of one.
 * Used by the debug checks, which do not know the pass.
 *
 * @param {string} name - The name of the texture.
 * @returns {boolean} True when the texture can be a view texture.
 * @ignore
 */
const isViewTexture = name => viewTextureNameSet.has(name) || lightSlotTexture.test(name);

export { getViewTextures, isViewTexture };
