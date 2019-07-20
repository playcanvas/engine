Object.assign(pc, function () {
    var StandardMaterialValidator = function () {
        this.removeInvalid = true;

        this.valid = true; // start off valid

        this.enumValidators = {
            occludeSpecular: this._createEnumValidator([
                pc.SPECOCC_NONE,
                pc.SPECOCC_AO,
                pc.SPECOCC_GLOSSDEPENDENT
            ]),
            cull: this._createEnumValidator([
                pc.CULLFACE_NONE,
                pc.CULLFACE_BACK,
                pc.CULLFACE_FRONT,
                pc.CULLFACE_FRONTANDBACK
            ]),
            blendType: this._createEnumValidator([
                pc.BLEND_SUBTRACTIVE,
                pc.BLEND_ADDITIVE,
                pc.BLEND_NORMAL,
                pc.BLEND_NONE,
                pc.BLEND_PREMULTIPLIED,
                pc.BLEND_MULTIPLICATIVE,
                pc.BLEND_ADDITIVEALPHA,
                pc.BLEND_MULTIPLICATIVE2X,
                pc.BLEND_SCREEN,
                pc.BLEND_MIN,
                pc.BLEND_MAX
            ]),
            shadingModel: this._createEnumValidator([
                pc.SPECULAR_PHONG,
                pc.SPECULAR_BLINN
            ])
        };
    };

    StandardMaterialValidator.prototype.setInvalid = function (key, data) {
        this.valid = false;

        // #ifdef DEBUG
        console.warn('Ignoring invalid StandardMaterial property: ' + key, data[key]);
        // #endif

        if (this.removeInvalid) {
            delete data[key];
        }
    };

    StandardMaterialValidator.prototype.validate = function (data) {
         // validate input data against defined standard-material properties and types\
         // if removeInvalid flag is set to true then remove invalid properties from data

        var TYPES = pc.StandardMaterial.PARAMETER_TYPES;
        var type;
        var i;

        var pathMapping = (data.mappingFormat === "path");

        for (var key in data) {
            type = TYPES[key];

            if (!type) {
                // #ifdef DEBUG
                console.warn('Ignoring unsupported input property to standard material: ' + key);
                // #endif
                this.valid = false;
                continue;
            }

            if (type.startsWith("enum")) {
                var enumType = type.split(":")[1];
                if (this.enumValidators[enumType]) {
                    if (!this.enumValidators[enumType](data[key])) {
                        this.setInvalid(key, data);
                    }
                }

            } else if (type === 'number') {
                if (typeof(data[key]) !== 'number') {
                    this.setInvalid(key, data);
                }
            } else if (type === 'boolean') {
                if (typeof(data[key]) !== 'boolean') {
                    this.setInvalid(key, data);
                }
            } else if (type === 'string') {
                if (typeof(data[key]) !== 'string') {
                    this.setInvalid(key, data);
                }
            } else if (type === 'vec2') {
                if (!(data[key] instanceof Array && data[key].length === 2)) {
                    this.setInvalid(key, data);
                }
            } else if (type === 'rgb') {
                if (!(data[key] instanceof Array && data[key].length === 3)) {
                    this.setInvalid(key, data);
                }
            } else if (type === 'texture') {
                if (!pathMapping) {
                    if (typeof(data[key]) === 'number' || data[key] === null) {
                        // materials are often initialized with the asset id of textures which are assigned later
                        // this counts as a valid input
                        // null texture reference is also valid
                    } else if (!(data[key] instanceof pc.Texture)) {
                        this.setInvalid(key, data);
                    }
                } else {
                    if (typeof(data[key]) === 'string' || data[key === null]) {
                        // fpr path mapped we expect a string not an asset id
                    } else if (!(data[key] instanceof pc.Texture)) {
                        this.setInvalid(key, data);
                    }
                }
            } else if (type === 'boundingbox') {
                if (!(data[key].center && data[key].center instanceof Array && data[key].center.length === 3)) {
                    this.setInvalid(key, data);
                }
                if (!(data[key].halfExtents && data[key].halfExtents instanceof Array && data[key].halfExtents.length === 3)) {
                    this.setInvalid(key, data);
                }
            } else if (type === 'cubemap') {
                if (typeof(data[key]) === 'number' || data[key] === null || data[key] === undefined) {
                    // materials are often initialized with the asset id of textures which are assigned later
                    // this counts as a valid input
                    // null texture reference is also valid
                } else if (!(data[key] instanceof pc.Texture && data[key].cubemap)) {
                    this.setInvalid(key, data);
                }
            } else if (type === 'chunks') {
                var chunkNames = Object.keys(data[key]);
                for (i = 0; i < chunkNames.length; i++) {
                    if (typeof(data[key][chunkNames[i]]) !== 'string') {
                        this.setInvalid(chunkNames[i], data[key]);
                    }
                }

            } else {
                console.error("Unknown material type: " + type);
            }
        }

        // mark data as validated so we don't validate twice
        data.validated = true;

        return this.valid;
    };

    StandardMaterialValidator.prototype._createEnumValidator = function (values) {
        return function (value) {
            return (values.indexOf(value) >= 0);
        };
    };

    return {
        StandardMaterialValidator: StandardMaterialValidator
    };
}());
