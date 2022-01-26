const standardMaterialParameterTypes = {
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
    aoMapRotation: 'number',

    diffuse: 'rgb',
    diffuseTint: 'boolean',
    diffuseVertexColor: 'boolean',
    diffuseVertexColorChannel: 'string',
    diffuseMap: 'texture',
    diffuseMapChannel: 'string',
    diffuseMapUv: 'number',
    diffuseMapTiling: 'vec2',
    diffuseMapOffset: 'vec2',
    diffuseMapRotation: 'number',
    diffuseDetailMap: 'texture',
    diffuseDetailMapChannel: 'string',
    diffuseDetailMapUv: 'number',
    diffuseDetailMapTiling: 'vec2',
    diffuseDetailMapOffset: 'vec2',
    diffuseDetailMapRotation: 'number',
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
    specularMapRotation: 'number',
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
    netalnessMapRotation: 'number',

    conserveEnergy: 'boolean',
    shininess: 'number',
    glossVertexColor: 'boolean',
    glossVertexColorChannel: 'string',
    glossMap: 'texture',
    glossMapChannel: 'string',
    glossMapUv: 'number',
    glossMapTiling: 'vec2',
    glossMapOffset: 'vec2',
    glossMapRotation: 'number',

    clearCoat: 'number',
    clearCoatVertexColor: 'boolean',
    clearCoatVertexColorChannel: 'string',
    clearCoatMap: 'texture',
    clearCoatMapChannel: 'string',
    clearCoatMapUv: 'number',
    clearCoatMapTiling: 'vec2',
    clearCoatMapOffset: 'vec2',
    clearCoatMapRotation: 'number',
    clearCoatGlossiness: 'number',
    clearCoatGlossVertexColor: 'boolean',
    clearCoatGlossVertexColorChannel: 'string',
    clearCoatGlossMap: 'texture',
    clearCoatGlossMapChannel: 'string',
    clearCoatGlossMapUv: 'number',
    clearCoatGlossMapTiling: 'vec2',
    clearCoatGlossMapOffset: 'vec2',
    clearCoatGlossMapRotation: 'number',
    clearCoatBumpiness: 'number',
    clearCoatNormalMap: 'texture',
    clearCoatNormalMapUv: 'number',
    clearCoatNormalMapTiling: 'vec2',
    clearCoatNormalMapOffset: 'vec2',
    clearCoatNormalMapRotation: 'number',

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
    emissiveMapMapRotation: 'number',
    emissiveIntensity: 'number',

    normalMap: 'texture',
    normalMapTiling: 'vec2',
    normalMapOffset: 'vec2',
    normalMapRotation: 'number',
    normalMapUv: 'number',
    bumpiness: 'number',
    // normalMapFactor: 'number', // TODO rename bumpiness to normalMapFactor
    normalDetailMap: 'texture',
    normalDetailMapTiling: 'vec2',
    normalDetailMapOffset: 'vec2',
    normalDetailMapRotation: 'number',
    normalDetailMapUv: 'number',
    normalDetailMapBumpiness: 'number',

    heightMap: 'texture',
    heightMapChannel: 'string',
    heightMapUv: 'number',
    heightMapTiling: 'vec2',
    heightMapOffset: 'vec2',
    heightMapRotation: 'number',
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
    opacityMapRotation: 'number',
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
    lightMapRotation: 'number',

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

    envAtlas: 'texture'

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

const standardMaterialTextureParameters = [];
for (const key in standardMaterialParameterTypes) {
    const type = standardMaterialParameterTypes[key];
    if (type === 'texture') {
        standardMaterialTextureParameters.push(key);
    }
}

const standardMaterialCubemapParameters = [];
for (const key in standardMaterialParameterTypes) {
    const type = standardMaterialParameterTypes[key];
    if (type === 'cubemap') {
        standardMaterialCubemapParameters.push(key);
    }
}

export { standardMaterialParameterTypes, standardMaterialCubemapParameters, standardMaterialTextureParameters };
