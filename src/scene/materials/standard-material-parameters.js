function _textureParameter(name, channel = true) {
    const tex = {};
    tex[`${name}Map`] = 'texture';
    if (channel)
        tex[`${name}MapChannel`] = 'string';
    tex[`${name}MapUv`] = 'number';
    tex[`${name}MapTiling`] = 'vec2';
    tex[`${name}MapOffset`] = 'vec2';
    tex[`${name}MapRotation`] = 'number';
    return tex;
}

const standardMaterialParameterTypes = {
    name: 'string',
    chunks: 'chunks',

    mappingFormat: 'string',
    _engine: 'boolean', // internal param for engine-only loading

    ambient: 'rgb',
    ambientTint: 'boolean',

    aoVertexColor: 'boolean',
    aoVertexColorChannel: 'string',
    ..._textureParameter('ao'),

    diffuse: 'rgb',
    diffuseTint: 'boolean',
    diffuseVertexColor: 'boolean',
    diffuseVertexColorChannel: 'string',
    ..._textureParameter('diffuse'),
    ..._textureParameter('diffuseDetail'),
    diffuseDetailMode: 'string',

    specular: 'rgb',
    specularTint: 'boolean',
    specularVertexColor: 'boolean',
    specularVertexColorChannel: 'string',
    ..._textureParameter('specular'),
    occludeSpecular: 'enum:occludeSpecular',
    specularityFactor: 'number',
    specularityFactorTint: 'boolean',
    specularityFactorVertexColor: 'boolean',
    specularityFactorVertexColorChannel: 'string',
    ..._textureParameter('specularityFactor'),

    useMetalness: 'boolean',
    metalness: 'number',
    enableGGXSpecular: 'boolean',
    anisotropy: 'number',
    metalnessTint: 'boolean',
    metalnessVertexColor: 'boolean',
    metalnessVertexColorChannel: 'string',
    ..._textureParameter('metalness'),
    useMetalnessSpecularColor: 'boolean',

    conserveEnergy: 'boolean',
    shininess: 'number',
    glossVertexColor: 'boolean',
    glossVertexColorChannel: 'string',
    ..._textureParameter('gloss'),

    clearCoat: 'number',
    clearCoatVertexColor: 'boolean',
    clearCoatVertexColorChannel: 'string',
    ..._textureParameter('clearCoat'),
    clearCoatGlossiness: 'number',
    clearCoatGlossVertexColor: 'boolean',
    clearCoatGlossVertexColorChannel: 'string',
    ..._textureParameter('clearCoatGloss'),
    clearCoatBumpiness: 'number',
    ..._textureParameter('clearCoatNormal', false),

    useSheen: 'boolean',
    sheen: 'rgb',
    ..._textureParameter('sheen'),
    sheenTint: 'boolean',
    sheenVertexColor: 'boolean',
    sheenVertexColorChannel: 'string',
    sheenGloss: 'number',
    ..._textureParameter('sheenGloss'),
    sheenGlossTint: 'boolean',
    sheenGlossVertexColor: 'boolean',
    sheenGlossVertexColorChannel: 'string',

    fresnelModel: 'number',

    emissive: 'rgb',
    emissiveTint: 'boolean',
    emissiveVertexColor: 'boolean',
    emissiveVertexColorChannel: 'string',
    ..._textureParameter('emissive'),
    emissiveIntensity: 'number',

    ..._textureParameter('normal', false),
    bumpiness: 'number',
    // normalMapFactor: 'number', // TODO rename bumpiness to normalMapFactor
    ..._textureParameter('normalDetail', false),
    normalDetailMapBumpiness: 'number',

    ..._textureParameter('height'),
    heightMapFactor: 'number',

    alphaToCoverage: 'boolean',
    alphaTest: 'number',
    alphaFade: 'number',
    opacity: 'number',
    opacityVertexColor: 'boolean',
    opacityVertexColorChannel: 'string',
    ..._textureParameter('opacity'),
    opacityFadesSpecular: 'boolean',

    reflectivity: 'number',
    refraction: 'number',
    ..._textureParameter('refraction'),
    refractionTint: 'boolean',
    refractionVertexColor: 'boolean',
    refractionVertexColorChannel: 'string',
    refractionIndex: 'number',
    thickness: 'number',
    ..._textureParameter('thickness'),
    thicknessTint: 'boolean',
    thicknessVertexColor: 'boolean',
    thicknessVertexColorChannel: 'string',
    attenuation: 'rgb',
    attenuationDistance: 'number',
    useDynamicRefraction: 'boolean',
    sphereMap: 'texture',
    cubeMap: 'cubemap',
    cubeMapProjection: 'number',
    cubeMapProjectionBox: 'boundingbox',

    useIridescence: 'boolean',
    iridescence: 'number',
    ..._textureParameter('iridescence'),
    iridescenceTint: 'boolean',
    iridescenceVertexColor: 'boolean',
    iridescenceVertexColorChannel: 'string',
    iridescenceThicknessMin: 'number',
    iridescenceThicknessMax: 'number',
    ..._textureParameter('iridescenceThickness'),
    iridescenceThicknessTint: 'boolean',
    iridescenceThicknessVertexColor: 'boolean',
    iridescenceThicknessVertexColorChannel: 'string',
    iridescenceRefractionIndex: 'number',

    lightVertexColor: 'boolean',
    lightVertexColorChannel: 'string',
    ..._textureParameter('light'),

    depthTest: 'boolean',
    depthFunc: 'enum:depthFunc',
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
    // msdfTextAttribute
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

const standardMaterialRemovedParameters = {
    aoMapVertexColor: 'boolean',
    diffuseMapTint: 'boolean',
    diffuseMapVertexColor: 'boolean',
    emissiveMapTint: 'boolean',
    emissiveMapVertexColor: 'boolean',
    glossMapVertexColor: 'boolean',
    metalnessMapVertexColor: 'boolean',
    opacityMapVertexColor: 'boolean',
    specularAntialias: 'boolean',
    specularMapTint: 'boolean',
    specularMapVertexColor: 'boolean'
};

export {
    standardMaterialParameterTypes,
    standardMaterialCubemapParameters,
    standardMaterialTextureParameters,
    standardMaterialRemovedParameters
};
