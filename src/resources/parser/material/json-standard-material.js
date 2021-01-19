import { Color } from '../../../core/color.js';

import { Vec2 } from '../../../math/vec2.js';
import { Vec3 } from '../../../math/vec3.js';

import { Texture } from '../../../graphics/texture.js';

import { BoundingBox } from '../../../shape/bounding-box.js';

import { SPECULAR_BLINN, SPECULAR_PHONG } from '../../../scene/constants.js';

import { StandardMaterial } from '../../../scene/materials/standard-material.js';
import { StandardMaterialValidator } from '../../../scene/materials/standard-material-validator.js';
import { standardMaterialParameterTypes } from '../../../scene/materials/standard-material-parameters.js';

/**
 * @private
 * @name JsonStandardMaterialParser
 * @description Convert incoming JSON data into a {@link StandardMaterial}.
 */
class JsonStandardMaterialParser {
    constructor() {
        this._validator = null;
    }

    parse(input) {
        var migrated = this.migrate(input);
        var validated = this._validate(migrated);

        var material = new StandardMaterial();
        this.initialize(material, validated);

        return material;
    }

    /**
     * @private
     * @function
     * @name JsonStandardMaterialParser#initialize
     * @description  Initialize material properties from the material data block e.g. Loading from server.
     * @param {pc.StandardMaterial} material - The material to be initialized.
     * @param {object} data - The data block that is used to initialize.
     */
    initialize(material, data) {
        // usual flow is that data is validated in resource loader
        // but if not, validate here.
        if (!data.validated) {
            if (!this._validator) {
                this._validator = new StandardMaterialValidator();
            }
            this._validator.validate(data);
        }

        if (data.chunks) {
            material.chunks.copy(data.chunks);
        }

        // initialize material values from the input data
        for (var key in data) {
            var type = standardMaterialParameterTypes[key];
            var value = data[key];

            if (type === 'vec2') {
                material[key] = new Vec2(value[0], value[1]);
            } else if (type === 'rgb') {
                material[key] = new Color(value[0], value[1], value[2]);
            } else if (type === 'texture') {
                if (value instanceof Texture) {
                    material[key] = value;
                } else if (!(material[key] instanceof Texture && typeof(value) === 'number' && value > 0)) {
                    material[key] = null;
                }
                // OTHERWISE: material already has a texture assigned, but data contains a valid asset id (which means the asset isn't yet loaded)
                // leave current texture (probably a placeholder) until the asset is loaded
            } else if (type === 'cubemap') {
                if (value instanceof Texture) {
                    material[key] = value;
                } else if (!(material[key] instanceof Texture && typeof(value) === 'number' && value > 0)) {
                    material[key] = null;
                }
                // OTHERWISE: material already has a texture assigned, but data contains a valid asset id (which means the asset isn't yet loaded)
                // leave current texture (probably a placeholder) until the asset is loaded
            } else if (type === 'boundingbox') {
                var center = new Vec3(value.center[0], value.center[1], value.center[2]);
                var halfExtents = new Vec3(value.halfExtents[0], value.halfExtents[1], value.halfExtents[2]);
                material[key] = new BoundingBox(center, halfExtents);
            } else {
                // number, boolean and enum types don't require type creation
                material[key] = data[key];
            }
        }

        material.update();
    }

    // convert any properties that are out of date
    // or from old versions into current version
    migrate(data) {
        // replace old shader property with new shadingModel property
        if (data.shadingModel === undefined) {
            if (data.shader === 'blinn') {
                data.shadingModel = SPECULAR_BLINN;
            } else {
                data.shadingModel = SPECULAR_PHONG;
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
    }

    // check for invalid properties
    _validate(data) {
        if (!this._validator) {
            this._validator = new StandardMaterialValidator();
        }
        this._validator.validate(data);

        return data;
    }
}

export { JsonStandardMaterialParser };
