Object.assign(pc, function () {

    /**
     * @private
     * @name pc.JsonStandardMaterialParser
     * @description Convert incoming JSON data into a {@link pc.StandardMaterial}
     */
    var JsonStandardMaterialParser = function () {
        this._validator = null;
    };

    JsonStandardMaterialParser.prototype.parse = function (input) {
        var migrated = this.migrate(input);
        var validated = this._validate(migrated);

        var material = new pc.StandardMaterial();
        this.initialize(material, validated);

        return material;
    };

    /**
     * @private
     * @function
     * @name pc.JsonStandardMaterialParser#initialize
     * @description  Initialize material properties from the material data block e.g. loading from server
     * @param {pc.StandardMaterial} material The material to be initialized
     * @param {Object} data The data block that is used to initialize
     */
    JsonStandardMaterialParser.prototype.initialize = function (material, data) {
        // usual flow is that data is validated in resource loader
        // but if not, validate here.
        if (!data.validated) {
            if (!this._validator) {
                this._validator = new pc.StandardMaterialValidator();
            }
            this._validator.validate(data);
        }

        if (data.chunks) {
            material.chunks.copy(data.chunks);
        }

        // initialize material values from the input data
        for (var key in data) {
            var type = pc.StandardMaterial.PARAMETER_TYPES[key];
            var value = data[key];

            if (type === 'vec2') {
                material[key] = new pc.Vec2(value[0], value[1]);
            } else if (type === 'rgb') {
                material[key] = new pc.Color(value[0], value[1], value[2]);
            } else if (type === 'texture') {
                if (value instanceof pc.Texture) {
                    material[key] = value;
                } else if (material[key] instanceof pc.Texture && typeof(value) === 'number' && value > 0) {
                    // material already has a texture assigned, but data contains a valid asset id (which means the asset isn't yet loaded)
                    // leave current texture (probably a placeholder) until the asset is loaded
                } else {
                    material[key] = null;
                }
            } else if (type === 'cubemap') {
                if (value instanceof pc.Texture) {
                    material[key] = value;
                } else if (material[key] instanceof pc.Texture && typeof(value) === 'number' && value > 0) {
                    // material already has a texture assigned, but data contains a valid asset id (which means the asset isn't yet loaded)
                    // leave current texture (probably a placeholder) until the asset is loaded
                } else {
                    material[key] = null;
                }
            } else if (type === 'boundingbox') {
                var center = new pc.Vec3(value.center[0], value.center[1], value.center[2]);
                var halfExtents = new pc.Vec3(value.halfExtents[0], value.halfExtents[1], value.halfExtents[2]);
                material[key] = new pc.BoundingBox(center, halfExtents);
            } else {
                // number, boolean and enum types don't require type creation
                material[key] = data[key];
            }
        }

        material.update();
    };

    // convert any properties that are out of date
    // or from old versions into current version
    JsonStandardMaterialParser.prototype.migrate = function (data) {
        // replace old shader property with new shadingModel property
        if (data.shadingModel === undefined) {
            if (data.shader === 'blinn') {
                data.shadingModel = pc.SPECULAR_BLINN;
            } else {
                data.shadingModel = pc.SPECULAR_PHONG;
            }
        }
        if (data.shader) delete data.shader;


        // make JS style
        if (data.mapping_format) {
            data.mappingFormat = data.mapping_format;
            delete data.mapping_format;
        }

        var i;
        // list of properties that have been renamed in StandardMaterial
        // but may still exists in data in old format
        var RENAMED_PROPERTIES = [
            ["bumpMapFactor", "bumpiness"],

            ["aoUvSet", "aoMapUv"],

            ["aoMapVertexColor", "aoVertexColor"],
            ["diffuseMapVertexColor", "diffuseVertexColor"],
            ["emissiveMapVertexColor", "emissiveVertexColor"],
            ["specularMapVertexColor", "specularVertexColor"],
            ["metalnessMapVertexColor", "metalnessVertexColor"],
            ["opacityMapVertexColor", "opacityVertexColor"],
            ["glossMapVertexColor", "glossVertexColor"],
            ["lightMapVertexColor", "lightVertexColor"],

            ["diffuseMapTint", "diffuseTint"],
            ["specularMapTint", "specularTint"],
            ["emissiveMapTint", "emissiveTint"],
            ["metalnessMapTint", "metalnessTint"]
        ];

        // if an old property name exists without a new one,
        // move property into new name and delete old one.
        for (i = 0; i < RENAMED_PROPERTIES.length; i++) {
            var _old = RENAMED_PROPERTIES[i][0];
            var _new = RENAMED_PROPERTIES[i][1];

            if (data[_old] !== undefined && !(data[_new] !== undefined)) {
                data[_new] = data[_old];
                delete data[_old];
            }
        }

        // Properties that may exist in input data, but are now ignored
        var DEPRECATED_PROPERTIES = [
            'fresnelFactor',
            'shadowSampleType'
        ];

        for (i = 0; i < DEPRECATED_PROPERTIES.length; i++) {
            var name = DEPRECATED_PROPERTIES[i];
            if (data.hasOwnProperty(name)) {
                delete data[name];
            }
        }

        return data;
    };

    // check for invalid properties
    JsonStandardMaterialParser.prototype._validate = function (data) {
        if (!this._validator) {
            this._validator = new pc.StandardMaterialValidator();
        }
        this._validator.validate(data);

        return data;
    };

    return {
        JsonStandardMaterialParser: JsonStandardMaterialParser
    };
}());
