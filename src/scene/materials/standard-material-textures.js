import { _matTex2D } from '../shader-lib/programs/standard.js';

/**
 * @import { StandardMaterial } from './standard-material.js'
 */

/**
 * A texture of a standard material, which is one slot of its bind group and one sampler of its
 * shader.
 *
 * @typedef {object} MaterialTextureDescriptor
 * @property {string} name - The name of the texture uniform, `texture_<map>Map`.
 * @property {string} samplerName - The name of the sampler which goes with it, as the WGSL chunks
 * declare it.
 * @property {string} mapName - The property of the material holding the texture, `<map>Map`.
 * @ignore
 */

/**
 * The map property which claims the sampler of each assigned map of a material. Maps pointing at
 * the same texture share one sampler, named after whichever of them comes first, which keeps an
 * imported material that packs several maps into one texture down to a single slot. Both the bind
 * group layout of the material and the generation of its shader follow this, so the slots of the
 * layout are the samplers the shader declares.
 *
 * @param {StandardMaterial} material - The material.
 * @returns {Map<string, string>} The claiming map property for each assigned map property.
 * @ignore
 */
const getTextureIdentifiers = (material) => {

    const identifiers = new Map();
    const claimedBy = new Map();

    for (const map of _matTex2D.keys()) {
        const texture = material[`${map}Map`];
        if (texture) {
            const claimed = claimedBy.get(texture.id);
            if (claimed === undefined) {
                claimedBy.set(texture.id, map);
                identifiers.set(map, map);
            } else {
                identifiers.set(map, claimed);
            }
        }
    }

    return identifiers;
};

/**
 * The textures of a material, one per texture its assigned maps point at, in the order of the maps
 * which claimed them. See {@link getTextureIdentifiers}.
 *
 * @param {StandardMaterial} material - The material.
 * @returns {MaterialTextureDescriptor[]} The textures.
 * @ignore
 */
const getTextureDescriptors = (material) => {

    const descriptors = [];

    getTextureIdentifiers(material).forEach((claimed, map) => {
        if (claimed === map) {
            const name = `texture_${map}Map`;
            descriptors.push({
                name: name,
                samplerName: `${name}Sampler`,
                mapName: `${map}Map`
            });
        }
    });

    return descriptors;
};

export { getTextureDescriptors, getTextureIdentifiers };
