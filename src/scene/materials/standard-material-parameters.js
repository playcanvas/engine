function _textureParameter(name, channel = true, vertexColor = true) {
    const result = {};
    result[`${name}Map`] = 'texture';
    result[`${name}MapTiling`] = 'vec2';
    result[`${name}MapOffset`] = 'vec2';
    result[`${name}MapRotation`] = 'number';
    result[`${name}MapUv`] = 'number';
    if (channel) {
        result[`${name}MapChannel`] = 'string';
        if (vertexColor) {
            result[`${name}VertexColor`] = 'boolean';
            result[`${name}VertexColorChannel`] = 'string';
        }
    }
    return result;
}

const standardMaterialParameterTypes = {
    name: 'string',
    chunks: 'chunks',

    mappingFormat: 'string',
    _engine: 'boolean', // internal param for engine-only loading

    ambient: 'rgb',
    ambientTint: 'boolean',
    ..._textureParameter('ao'),
    ..._textureParameter('aoDetail', true, false),
    aoDetailMode: 'string',

    diffuse: 'rgb',
    ..._textureParameter('diffuse'),
    ..._textureParameter('diffuseDetail', true, false),
    diffuseDetailMode: 'string',

    specular: 'rgb',
    specularTint: 'boolean',
    ..._textureParameter('specular'),
    occludeSpecular: 'enum:occludeSpecular',
    specularityFactor: 'number',
    specularityFactorTint: 'boolean',
    ..._textureParameter('specularityFactor'),

    useMetalness: 'boolean',
    metalness: 'number',
    enableGGXSpecular: 'boolean',
    anisotropy: 'number',
    metalnessTint: 'boolean',
    ..._textureParameter('metalness'),
    useMetalnessSpecularColor: 'boolean',

    shininess: 'number',
    gloss: 'number',
    glossInvert: 'boolean',
    ..._textureParameter('gloss'),

    clearCoat: 'number',
    ..._textureParameter('clearCoat'),
    clearCoatGloss: 'number',
    clearCoatGlossInvert: 'boolean',
    ..._textureParameter('clearCoatGloss'),
    clearCoatBumpiness: 'number',
    ..._textureParameter('clearCoatNormal', false),

    useSheen: 'boolean',
    sheen: 'rgb',
    sheenTint: 'boolean',
    ..._textureParameter('sheen'),
    sheenGloss: 'number',
    sheenGlossTint: 'boolean',
    sheenGlossInvert: 'boolean',
    ..._textureParameter('sheenGloss'),

    fresnelModel: 'number',

    emissive: 'rgb',
    emissiveTint: 'boolean',
    ..._textureParameter('emissive'),
    emissiveIntensity: 'number',

    ..._textureParameter('normal', false),
    bumpiness: 'number',
    // normalMapFactor: 'number', // TODO rename bumpiness to normalMapFactor
    ..._textureParameter('normalDetail', false),
    normalDetailMapBumpiness: 'number',

    ..._textureParameter('height', true, false),
    heightMapFactor: 'number',

    alphaToCoverage: 'boolean',
    alphaTest: 'number',
    alphaFade: 'number',
    opacity: 'number',
    ..._textureParameter('opacity'),
    opacityFadesSpecular: 'boolean',
    opacityDither: 'string',
    opacityShadowDither: 'string',

    reflectivity: 'number',
    refraction: 'number',
    refractionTint: 'boolean',
    ..._textureParameter('refraction'),
    refractionIndex: 'number',
    dispersion: 'number',
    thickness: 'number',
    thicknessTint: 'boolean',
    ..._textureParameter('thickness'),
    attenuation: 'rgb',
    attenuationDistance: 'number',
    useDynamicRefraction: 'boolean',
    sphereMap: 'texture',
    cubeMap: 'cubemap',
    cubeMapProjection: 'number',
    cubeMapProjectionBox: 'boundingbox',

    useIridescence: 'boolean',
    iridescence: 'number',
    iridescenceTint: 'boolean',
    ..._textureParameter('iridescence'),
    iridescenceThicknessTint: 'boolean',
    iridescenceThicknessMin: 'number',
    iridescenceThicknessMax: 'number',
    iridescenceRefractionIndex: 'number',
    ..._textureParameter('iridescenceThickness'),

    ..._textureParameter('light'),

    depthTest: 'boolean',
    depthFunc: 'enum:depthFunc',
    depthWrite: 'boolean',
    depthBias: 'number',
    slopeDepthBias: 'number',

    cull: 'enum:cull',
    blendType: 'enum:blendType',

    useFog: 'boolean',
    useLighting: 'boolean',
    useSkybox: 'boolean',
    useTonemap: 'boolean',

    envAtlas: 'texture',

    twoSidedLighting: 'boolean'

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
