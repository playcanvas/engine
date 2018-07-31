Object.assign(pc, function () {

    var JsonMaterialParser = function (device) {
        this._device = device;
        // this._assets = assets; // might need this
    };

    JsonMaterialParser.prototype.parse = function (input) {
        var migrated = this._migrate(input);
        var validated = this._validate(migrated);

        var data = {
            parameters: this._parameterize(validated),
            chunks: []
        };

        var material = new pc.StandardMaterial();
        material.init(data);

        return material;
    };

    // convert any properties that are out of date
    // or from old versions into current
    // version
    JsonMaterialParser.prototype._migrate = function (data) {
        if (data.shader === 'blinn') {
            data.shadingModel = pc.SPECULAR_BLINN;
        } else {
            data.shadingModel = pc.SPECULAR_PHONG;
        }
        delete data.shader;

        // make JS style
        if (data.mapping_format) {
            data.mappingFormat = data.mapping_format;
            delete data.mapping_format;
        }

        return data;
    };

    // check for invalid properties
    JsonMaterialParser.prototype._validate = function (data) {
        return data;
    };

    // convert json-style file-format data into typed parameters
    // that pc.StandardMaterial expects.
    JsonMaterialParser.prototype._parameterize = function (data) {
        var parameters = [];

        for (var key in data) {
            if (!data.hasOwnProperty(key)) continue;

            if (IGNORE_FIELDS.indexOf(key) >= 0) continue;

            // #ifdef DEBUG
            if (!PARAMETER_TYPES[key]) {
                console.warn('Loading material with unsupported parameter: ' + key);
            }
            // #endif

            parameters.push({
                name: key,
                type: PARAMETER_TYPES[key],
                data: data[key]
            });
        }

        return parameters;
    };

    var IGNORE_FIELDS = [
        '_engine',
        'mappingFormat'
    ]

    // pre-defined types
    var PARAMETER_TYPES = {
        alphaToCoverage: 'boolean',
        ambient: 'vec3',
        ambientTint: 'boolean',
        aoMap: 'texture',
        aoMapVertexColor: 'boolean',
        aoMapVertexColorChannel: 'string',
        aoMapChannel: 'string',
        aoMapUv: 'number',
        aoMapTiling: 'vec2',
        aoMapOffset: 'vec2',
        conserveEnergy: 'boolean',
        diffuse: 'vec3',
        diffuseMap: 'texture',
        diffuseTint: 'boolean',
        diffuseMapVertexColor: 'boolean',
        diffuseMapVertexColorChannel: 'string',
        diffuseMapChannel: 'string',
        diffuseMapUv: 'number',
        diffuseMapTiling: 'vec2',
        diffuseMapOffset: 'vec2',
        diffuseMapTint: 'boolean',
        specular: 'vec3',
        specularMapVertexColor: 'boolean',
        specularMapVertexColorChannel: 'string',
        specularMapChannel: 'string',
        specularMapUv: 'number',
        specularMap: 'texture',
        specularTint: 'boolean',
        specularMapTiling: 'vec2',
        specularMapOffset: 'vec2',
        specularMapTint: 'boolean',
        specularAntialias: 'boolean',
        useMetalness: 'boolean',
        metalnessMap: 'texture',
        metalnessMapVertexColor: 'boolean',
        metalnessMapVertexColorChannel: 'string',
        metalnessMapChannel: 'string',
        metalnessMapUv: 'number',
        metalnessMapTiling: 'vec2',
        metalnessMapOffset: 'vec2',
        metalnessMapTint: 'boolean',
        metalness: 'number',
        occludeSpecular: 'boolean',
        shininess: 'number',
        glossMap: 'texture',
        glossMapVertexColor: 'boolean',
        glossMapVertexColorChannel: 'string',
        glossMapChannel: 'string',
        glossMapUv: 'number',
        glossMapTiling: 'vec2',
        glossMapOffset: 'vec2',
        fresnelModel: 'number',
        fresnelFactor: 'float',
        emissive: 'vec3',
        emissiveMap: 'texture',
        emissiveMapVertexColor: 'boolean',
        emissiveMapVertexColorChannel: 'string',
        emissiveMapChannel: 'string',
        emissiveMapUv: 'number',
        emissiveMapTiling: 'vec2',
        emissiveMapOffset: 'vec2',
        emissiveMapTint: 'boolean',
        emissiveIntensity: 'number',
        normalMap: 'texture',
        normalMapTiling: 'vec2',
        normalMapOffset: 'vec2',
        normalMapUv: 'number',
        bumpMapFactor: 'number',
        heightMap: 'texture',
        heightMapChannel: 'string',
        heightMapUv: 'number',
        heightMapTiling: 'vec2',
        heightMapOffset: 'vec2',
        heightMapFactor: 'number',
        alphaTest: 'number',
        opacity: 'number',
        opacityMap: 'texture',
        opacityMapVertexColor: 'boolean',
        opacityMapVertexColorChannel: 'string',
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
        lightMap: 'texture',
        lightMapVertexColor: 'boolean',
        lightMapVertexColorChannel: 'string',
        lightMapChannel: 'string',
        lightMapUv: 'number',
        lightMapTiling: 'vec2',
        lightMapOffset: 'vec2',
        depthTest: 'boolean',
        depthWrite: 'boolean',
        depthBias: 'number',
        slopeDepthBias: 'number',
        cull: 'number',
        blendType: 'number',
        shadingModel: 'number',
        useFog: 'boolean',
        useLighting: 'boolean',
        useSkybox: 'boolean',
        useGammaTonemap: 'boolean'
    };

    return {
        JsonMaterialParser: JsonMaterialParser
    };
}());
