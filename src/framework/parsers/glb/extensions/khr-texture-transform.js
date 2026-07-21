import { math } from '../../../../core/math/math.js';
import { Vec2 } from '../../../../core/math/vec2.js';

// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_texture_transform
// Applies the texCoord and KHR_texture_transform data from the supplied glTF texture info to the
// given maps of the material.
const extractTextureTransform = (source, material, maps) => {
    let map;

    const texCoord = source.texCoord;
    if (texCoord) {
        for (map = 0; map < maps.length; ++map) {
            material[`${maps[map]}MapUv`] = texCoord;
        }
    }

    const zeros = [0, 0];
    const ones = [1, 1];
    const textureTransform = source.extensions?.KHR_texture_transform;
    if (textureTransform) {
        const offset = textureTransform.offset || zeros;
        const scale = textureTransform.scale || ones;
        const rotation = textureTransform.rotation ? (-textureTransform.rotation * math.RAD_TO_DEG) : 0;

        const tilingVec = new Vec2(scale[0], scale[1]);
        const offsetVec = new Vec2(offset[0], 1.0 - scale[1] - offset[1]);

        for (map = 0; map < maps.length; ++map) {
            material[`${maps[map]}MapTiling`] = tilingVec;
            material[`${maps[map]}MapOffset`] = offsetVec;
            material[`${maps[map]}MapRotation`] = rotation;
        }
    }
};

export { extractTextureTransform };
