var standardMaterialParameterTypes = {
    name: 'string',
    chunks: 'chunks',

    mappingFormat: 'string',
    _engine: 'boolean', // internal param for engine-only loading

    ambient: 'rgb',
    ambientTint: 'boolean',

    aoVertexColor: 'boolean',
    aoVertexColorChannel: 'string',
    aoMap: 'texture',
    aoMapChannel: 'string',
    aoMapUv: 'number',
    aoMapTiling: 'vec2',
    aoMapOffset: 'vec2',

    diffuse: 'rgb',
    diffuseTint: 'boolean',
    diffuseVertexColor: 'boolean',
    diffuseVertexColorChannel: 'string',
    diffuseMap: 'texture',
    diffuseMapChannel: 'string',
    diffuseMapUv: 'number',
    diffuseMapTiling: 'vec2',
    diffuseMapOffset: 'vec2',
    diffuseDetailMap: 'texture',
    diffuseDetailMapChannel: 'string',
    diffuseDetailMapUv: 'number',
    diffuseDetailMapTiling: 'vec2',
    diffuseDetailMapOffset: 'vec2',
    diffuseDetailMode: 'string',

    specular: 'rgb',
    specularTint: 'boolean',
    specularVertexColor: 'boolean',
    specularVertexColorChannel: 'string',
    specularMap: 'texture',
    specularMapChannel: 'string',
    specularMapUv: 'number',
    specularMapTiling: 'vec2',
    specularMapOffset: 'vec2',
    specularAntialias: 'boolean',
    occludeSpecular: 'enum:occludeSpecular',

    useMetalness: 'boolean',
    metalness: 'number',
    enableGGXSpecular: 'boolean',
    anisotropy: 'number',
    metalnessTint: 'boolean',
    metalnessVertexColor: 'boolean',
    metalnessVertexColorChannel: 'string',
    metalnessMap: 'texture',
    metalnessMapChannel: 'string',
    metalnessMapUv: 'number',
    metalnessMapTiling: 'vec2',
    metalnessMapOffset: 'vec2',

    conserveEnergy: 'boolean',
    shininess: 'number',
    glossVertexColor: 'boolean',
    glossVertexColorChannel: 'string',
    glossMap: 'texture',
    glossMapChannel: 'string',
    glossMapUv: 'number',
    glossMapTiling: 'vec2',
    glossMapOffset: 'vec2',

    clearCoat: 'number',
    clearCoatVertexColor: 'boolean',
    clearCoatVertexColorChannel: 'string',
    clearCoatMap: 'texture',
    clearCoatMapChannel: 'string',
    clearCoatMapUv: 'number',
    clearCoatMapTiling: 'vec2',
    clearCoatMapOffset: 'vec2',
    clearCoatGlossiness: 'number',
    clearCoatGlossVertexColor: 'boolean',
    clearCoatGlossVertexColorChannel: 'string',
    clearCoatGlossMap: 'texture',
    clearCoatGlossMapChannel: 'string',
    clearCoatGlossMapUv: 'number',
    clearCoatGlossMapTiling: 'vec2',
    clearCoatGlossMapOffset: 'vec2',
    clearCoatBumpiness: 'number',
    clearCoatNormalMap: 'texture',
    clearCoatNormalMapUv: 'number',
    clearCoatNormalMapTiling: 'vec2',
    clearCoatNormalMapOffset: 'vec2',

    fresnelModel: 'number',

    emissive: 'rgb',
    emissiveTint: 'boolean',
    emissiveVertexColor: 'boolean',
    emissiveVertexColorChannel: 'string',
    emissiveMap: 'texture',
    emissiveMapChannel: 'string',
    emissiveMapUv: 'number',
    emissiveMapTiling: 'vec2',
    emissiveMapOffset: 'vec2',
    emissiveIntensity: 'number',

    normalMap: 'texture',
    normalMapTiling: 'vec2',
    normalMapOffset: 'vec2',
    normalMapUv: 'number',
    bumpiness: 'number',
    // normalMapFactor: 'number', // TODO rename bumpiness to normalMapFactor
    normalDetailMap: 'texture',
    normalDetailMapTiling: 'vec2',
    normalDetailMapOffset: 'vec2',
    normalDetailMapUv: 'number',
    normalDetailMapBumpiness: 'number',

    heightMap: 'texture',
    heightMapChannel: 'string',
    heightMapUv: 'number',
    heightMapTiling: 'vec2',
    heightMapOffset: 'vec2',
    heightMapFactor: 'number',

    alphaToCoverage: 'boolean',
    alphaTest: 'number',
    alphaFade: 'number',
    opacity: 'number',
    opacityVertexColor: 'boolean',
    opacityVertexColorChannel: 'string',
    opacityMap: 'texture',
    opacityMapChannel: 'string',
    opacityMapUv: 'number',
    opacityMapTiling: 'vec2',
    opacityMapOffset: 'vec2',
    opacityFadesSpecular: 'boolean',

    reflectivity: 'number',
    refraction: 'number',
    refractionIndex: 'number',
    sphereMap: 'texture',
    cubeMap: 'cubemap',
    cubeMapProjection: 'number',
    cubeMapProjectionBox: 'boundingbox',

    lightVertexColor: 'boolean',
    lightVertexColorChannel: 'string',
    lightMap: 'texture',
    lightMapChannel: 'string',
    lightMapUv: 'number',
    lightMapTiling: 'vec2',
    lightMapOffset: 'vec2',

    depthTest: 'boolean',
    depthWrite: 'boolean',
    depthBias: 'number',
    slopeDepthBias: 'number',

    cull: 'enum:cull',
    blendType: 'enum:blendType',
    shadingModel: 'enum:shadingModel',

    useFog: 'boolean',
    useLighting: 'boolean',
    useSkybox: 'boolean',
    useGammaTonemap: 'boolean',

    prefilteredCubeMap128: 'texture',
    prefilteredCubeMap64: 'texture',
    prefilteredCubeMap32: 'texture',
    prefilteredCubeMap16: 'texture',
    prefilteredCubeMap8: 'texture',
    prefilteredCubeMap4: 'texture'

    // twoSidedLighting
    // nineSlicedMode
    // pixelSnap
    // forceUv1
    // occludeDirect
    // occludeSpecularIntensity
    // fastTbn
    // normalizeNormalMap

    // msdfMap
    // msdfMapChannel
    // msdfMapUv
    // msdfMapTiling
    // msdfMapOffset
    // msdfVertexColor
    // msdfVertexColorChannel
};

var key, type;
var standardMaterialTextureParameters = [];
for (key in standardMaterialParameterTypes) {
    type = standardMaterialParameterTypes[key];
    if (type === 'texture') {
        standardMaterialTextureParameters.push(key);
    }
}

var standardMaterialCubemapParameters = [];
for (key in standardMaterialParameterTypes) {
    type = standardMaterialParameterTypes[key];
    if (type === 'cubemap') {
        standardMaterialCubemapParameters.push(key);
    }
}

export { standardMaterialParameterTypes, standardMaterialCubemapParameters, standardMaterialTextureParameters };
