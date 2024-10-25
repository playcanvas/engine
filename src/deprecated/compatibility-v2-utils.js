// add StandardMaterial parameter types the engine v2 supports to avoid validation warnings
export function __adjustStandardMaterialParameterTypes(types) {
    types.useGamma = 'boolean';
}
