import { KHR_materials_anisotropy } from './khr-materials-anisotropy.js';
import { KHR_materials_clearcoat } from './khr-materials-clearcoat.js';
import { KHR_materials_dispersion } from './khr-materials-dispersion.js';
import { KHR_materials_emissive_strength } from './khr-materials-emissive-strength.js';
import { KHR_materials_ior } from './khr-materials-ior.js';
import { KHR_materials_iridescence } from './khr-materials-iridescence.js';
import { KHR_materials_pbrSpecularGlossiness } from './khr-materials-pbr-specular-glossiness.js';
import { KHR_materials_sheen } from './khr-materials-sheen.js';
import { KHR_materials_specular } from './khr-materials-specular.js';
import { KHR_materials_transmission } from './khr-materials-transmission.js';
import { KHR_materials_unlit } from './khr-materials-unlit.js';
import { KHR_materials_volume } from './khr-materials-volume.js';

/**
 * Registry of the supported glTF material extensions, keyed by the extension name. Each entry
 * provides:
 *
 * - `apply(data, material, textures)` - applies the extension data to the standard material.
 * - `getColorTextures(data)` - optional, returns the texture infos of the extension's textures
 * that contain color data and so need to be loaded as sRGB.
 *
 * Note that handlers are applied in the order the extensions appear in the material's JSON, so
 * the result of overlapping extensions can depend on their order in the source asset.
 *
 * @ignore
 */
const glbMaterialExtensions = {
    KHR_materials_anisotropy,
    KHR_materials_clearcoat,
    KHR_materials_dispersion,
    KHR_materials_emissive_strength,
    KHR_materials_ior,
    KHR_materials_iridescence,
    KHR_materials_pbrSpecularGlossiness,
    KHR_materials_sheen,
    KHR_materials_specular,
    KHR_materials_transmission,
    KHR_materials_unlit,
    KHR_materials_volume
};

export { glbMaterialExtensions };
