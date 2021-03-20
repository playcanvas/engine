import {
    CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, CULLFACE_NONE
} from '../../graphics/constants.js';
import { Texture } from '../../graphics/texture.js';

import {
    SPECOCC_AO, SPECOCC_GLOSSDEPENDENT, SPECOCC_NONE,
    BLEND_SUBTRACTIVE, BLEND_ADDITIVE, BLEND_NORMAL, BLEND_NONE, BLEND_PREMULTIPLIED,
    BLEND_MULTIPLICATIVE, BLEND_ADDITIVEALPHA, BLEND_MULTIPLICATIVE2X, BLEND_SCREEN,
    BLEND_MIN, BLEND_MAX,
    SPECULAR_BLINN, SPECULAR_PHONG
} from '../constants.js';
import { standardMaterialParameterTypes } from './standard-material-parameters.js';

function StandardMaterialValidator() {
    this.removeInvalid = true;

    this.valid = true; // start off valid

    this.enumValidators = {
        occludeSpecular: this._createEnumValidator([
            SPECOCC_NONE,
            SPECOCC_AO,
            SPECOCC_GLOSSDEPENDENT
        ]),
        cull: this._createEnumValidator([
            CULLFACE_NONE,
            CULLFACE_BACK,
            CULLFACE_FRONT,
            CULLFACE_FRONTANDBACK
        ]),
        blendType: this._createEnumValidator([
            BLEND_SUBTRACTIVE,
            BLEND_ADDITIVE,
            BLEND_NORMAL,
            BLEND_NONE,
            BLEND_PREMULTIPLIED,
            BLEND_MULTIPLICATIVE,
            BLEND_ADDITIVEALPHA,
            BLEND_MULTIPLICATIVE2X,
            BLEND_SCREEN,
            BLEND_MIN,
            BLEND_MAX
        ]),
        shadingModel: this._createEnumValidator([
            SPECULAR_PHONG,
            SPECULAR_BLINN
        ])
    };
}

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

    var TYPES = standardMaterialParameterTypes;
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
                if (!(typeof(data[key]) === 'number' || data[key] === null)) {
                    if (!(data[key] instanceof Texture)) {
                        this.setInvalid(key, data);
                    }
                }
                // OTHERWISE: materials are often initialized with the asset id of textures which are assigned later
                // this counts as a valid input
                // null texture reference is also valid
            } else {
                if (!(typeof(data[key]) === 'string' || data[key === null])) {
                    if (!(data[key] instanceof Texture)) {
                        this.setInvalid(key, data);
                    }
                }
                // OTHERWISE: fpr path mapped we expect a string not an asset id
            }
        } else if (type === 'boundingbox') {
            if (!(data[key].center && data[key].center instanceof Array && data[key].center.length === 3)) {
                this.setInvalid(key, data);
            }
            if (!(data[key].halfExtents && data[key].halfExtents instanceof Array && data[key].halfExtents.length === 3)) {
                this.setInvalid(key, data);
            }
        } else if (type === 'cubemap') {
            if (!(typeof(data[key]) === 'number' || data[key] === null || data[key] === undefined)) {

                if (!(data[key] instanceof Texture && data[key].cubemap)) {
                    this.setInvalid(key, data);
                }
            }
            // OTHERWISE: materials are often initialized with the asset id of textures which are assigned later
            // this counts as a valid input
            // null texture reference is also valid
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

export { StandardMaterialValidator };
