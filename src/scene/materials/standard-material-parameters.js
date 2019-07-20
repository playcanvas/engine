(function () {
    //
    pc.StandardMaterial.PARAMETER_TYPES = {
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

        heightMap: 'texture',
        heightMapChannel: 'string',
        heightMapUv: 'number',
        heightMapTiling: 'vec2',
        heightMapOffset: 'vec2',
        heightMapFactor: 'number',

        alphaToCoverage: 'boolean',
        alphaTest: 'number',
        opacity: 'number',
        opacityVertexColor: 'boolean',
        opacityVertexColorChannel: 'string',
        opacityMap: 'texture',
        opacityMapChannel: 'string',
        opacityMapUv: 'number',
        opacityMapTiling: 'vec2',
        opacityMapOffset: 'vec2',

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
        // msdfVexterColorChannel
    };

    var key, type;
    pc.StandardMaterial.TEXTURE_PARAMETERS = [];
    for (key in pc.StandardMaterial.PARAMETER_TYPES) {
        type = pc.StandardMaterial.PARAMETER_TYPES[key];
        if (type === 'texture') {
            pc.StandardMaterial.TEXTURE_PARAMETERS.push(key);
        }
    }

    pc.StandardMaterial.CUBEMAP_PARAMETERS = [];
    for (key in pc.StandardMaterial.PARAMETER_TYPES) {
        type = pc.StandardMaterial.PARAMETER_TYPES[key];
        if (type === 'cubemap') {
            pc.StandardMaterial.CUBEMAP_PARAMETERS.push(key);
        }
    }

}());
