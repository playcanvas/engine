// add StandardMaterial parameter types the engine v2 supports to avoid validation warnings
export function __adjustStandardMaterialParameterTypes(types) {
    types.useGamma = 'boolean';
    types.aoIntensity = 'number';
}

const _tintProperties = [
    'ambientTint',
    'emissiveTint',
    'diffuseTint',
    'sheenTint'
];

// in the engine v2 material json data, the tints were removed and are assumed to be always true
// for the engine v1, force them to be true
export function __adjustStandardMaterialData(data) {
    _tintProperties.forEach((prop) => {
        if (data[prop] === undefined) {
            data[prop] = true;
        }
    });
}
