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
        material.initialize(validated);

        return material;
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
