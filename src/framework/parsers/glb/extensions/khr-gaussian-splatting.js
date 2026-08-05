import { Debug } from '../../../../core/debug.js';
import { GSplatData } from '../../../../scene/gsplat/gsplat-data.js';
import { GSplatResource } from '../../../../scene/gsplat/gsplat-resource.js';
import { GltfAccessor } from '../gltf-accessor.js';

// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_gaussian_splatting
//
// Gaussian splat data is stored on POINTS primitives using namespaced attributes. The attribute
// data is converted to a GSplatData instance, matching the layout produced by the PLY parser,
// with one difference: the extension stores activated values (linear scale, post-sigmoid
// opacity), so the resulting GSplatData is marked as activated.
//
// Note that the sortingMethod and projection properties are ignored - sorting is controlled by
// the engine's global gsplat settings instead.

const extensionName = 'KHR_gaussian_splatting';

// number of SH coefficients for each degree 1..3
const shDegreeCoefCounts = [3, 5, 7];

// total number of per-channel rest coefficients for 1, 2 and 3 SH bands
const shBandCoefCounts = { 1: 3, 2: 8, 3: 15 };

const hasGSplatExtension = (primitive) => {
    return !!primitive?.extensions?.[extensionName];
};

// converts a splat primitive to a GSplatData instance, returns null when the data is not valid
const createGSplatData = (primitive, accessors, bufferViews) => {
    const extensionData = primitive.extensions[extensionName];

    Debug.call(() => {
        if (primitive.mode !== 0) {
            Debug.warn(`glTF ${extensionName} extension is used on a primitive with non-POINTS mode ${primitive.mode}.`);
        }
        if (extensionData.kernel !== undefined && extensionData.kernel !== 'ellipse') {
            Debug.warn(`glTF ${extensionName} extension uses unsupported kernel '${extensionData.kernel}', rendering as 'ellipse'.`);
        }
        if (extensionData.colorSpace === 'lin_rec709_display') {
            Debug.warn(`glTF ${extensionName} extension uses colorSpace '${extensionData.colorSpace}' which is not supported, colors are treated as srgb_rec709_display.`);
        }
    });

    const attributes = primitive.attributes;
    const numSplats = accessors[attributes.POSITION]?.count ?? 0;

    // reads attribute data, returns null when the attribute is missing, its accessor is invalid
    // or its element count does not match the splat count
    const readAttribute = (name) => {
        const accessor = accessors[attributes[name]];
        if (!accessor || accessor.count !== numSplats) {
            return null;
        }
        return GltfAccessor.getDataFloat32(accessor, bufferViews);
    };

    const positions = readAttribute('POSITION');
    const rotations = readAttribute(`${extensionName}:ROTATION`);
    const scales = readAttribute(`${extensionName}:SCALE`);
    const opacities = readAttribute(`${extensionName}:OPACITY`);
    const sh0 = readAttribute(`${extensionName}:SH_DEGREE_0_COEF_0`);

    if (!numSplats || !positions || !rotations || !scales || !opacities || !sh0) {
        Debug.error(`glTF ${extensionName} primitive is missing required attributes or their data is invalid, the primitive is skipped.`);
        return null;
    }

    const properties = [];
    const addProp = (name, storage) => {
        properties.push({ type: 'float', name, storage, byteSize: 4 });
    };

    addProp('x', GltfAccessor.extractComponent(positions, 3, 0, numSplats));
    addProp('y', GltfAccessor.extractComponent(positions, 3, 1, numSplats));
    addProp('z', GltfAccessor.extractComponent(positions, 3, 2, numSplats));

    // glTF stores the quaternion as xyzw, PLY layout uses rot_0 for w
    addProp('rot_0', GltfAccessor.extractComponent(rotations, 4, 3, numSplats));
    addProp('rot_1', GltfAccessor.extractComponent(rotations, 4, 0, numSplats));
    addProp('rot_2', GltfAccessor.extractComponent(rotations, 4, 1, numSplats));
    addProp('rot_3', GltfAccessor.extractComponent(rotations, 4, 2, numSplats));

    addProp('scale_0', GltfAccessor.extractComponent(scales, 3, 0, numSplats));
    addProp('scale_1', GltfAccessor.extractComponent(scales, 3, 1, numSplats));
    addProp('scale_2', GltfAccessor.extractComponent(scales, 3, 2, numSplats));

    addProp('opacity', GltfAccessor.extractComponent(opacities, 1, 0, numSplats));

    addProp('f_dc_0', GltfAccessor.extractComponent(sh0, 3, 0, numSplats));
    addProp('f_dc_1', GltfAccessor.extractComponent(sh0, 3, 1, numSplats));
    addProp('f_dc_2', GltfAccessor.extractComponent(sh0, 3, 2, numSplats));

    // determine the number of complete SH bands present
    let bands = 0;
    for (let d = 1; d <= 3; d++) {
        let complete = true;
        for (let c = 0; c < shDegreeCoefCounts[d - 1]; c++) {
            if (attributes[`${extensionName}:SH_DEGREE_${d}_COEF_${c}`] === undefined) {
                complete = false;
                break;
            }
        }
        if (!complete) {
            break;
        }
        bands = d;
    }

    // convert per-coefficient RGB attributes to the channel-major PLY layout: f_rest_[0..N-1]
    // holds the red channel coefficients, followed by green and blue, where N is the number of
    // per-channel coefficients
    if (bands > 0) {
        const numCoefs = shBandCoefCounts[bands];
        const rest = new Array(numCoefs * 3);
        let k = 0;
        for (let d = 1; d <= bands; d++) {
            for (let c = 0; c < shDegreeCoefCounts[d - 1]; c++) {
                const name = `${extensionName}:SH_DEGREE_${d}_COEF_${c}`;
                const source = readAttribute(name);
                if (!source) {
                    Debug.error(`glTF ${extensionName} primitive has an invalid ${name} attribute, the primitive is skipped.`);
                    return null;
                }
                rest[k] = GltfAccessor.extractComponent(source, 3, 0, numSplats);
                rest[numCoefs + k] = GltfAccessor.extractComponent(source, 3, 1, numSplats);
                rest[numCoefs * 2 + k] = GltfAccessor.extractComponent(source, 3, 2, numSplats);
                k++;
            }
        }
        for (let i = 0; i < numCoefs * 3; i++) {
            addProp(`f_rest_${i}`, rest[i]);
        }
    }

    const data = new GSplatData([{
        name: 'vertex',
        count: numSplats,
        properties
    }]);

    // the extension stores linear scale and post-sigmoid opacity
    data.activated = true;

    return data;
};

// creates gsplat resources for splat primitives of all meshes. Returns an array aligned with
// gltf.meshes, each entry an array of GSplatResource or null when the mesh has no splat
// primitives.
const createGSplats = (device, gltf, bufferViews) => {
    if (!gltf.hasOwnProperty('meshes')) {
        return [];
    }

    return gltf.meshes.map((gltfMesh) => {
        let resources = null;
        gltfMesh.primitives.forEach((primitive) => {
            if (hasGSplatExtension(primitive)) {
                const gsplatData = createGSplatData(primitive, gltf.accessors, bufferViews);
                if (gsplatData) {
                    // reorder the splat data to aid in better gpu memory access at render time
                    gsplatData.reorderData();

                    if (!resources) resources = [];
                    resources.push(new GSplatResource(device, gsplatData));
                }
            }
        });
        return resources;
    });
};

export { createGSplats, hasGSplatExtension };
