import { Color } from '../../../core/color.js';

import { Vec2 } from '../../../math/vec2.js';
import { Vec3 } from '../../../math/vec3.js';

import { Texture } from '../../../graphics/texture.js';

import { BoundingBox } from '../../../shape/bounding-box.js';

import { NodeMaterial } from '../../../scene/materials/node-material.js';
import { ShaderGraphNode } from '../../../scene/materials/shader-node.js';

/**
 * @private
 * @name pc.JsonNodeMaterialParser
 * @description Convert incoming JSON data into a {@link pc.NodeMaterial}.
 */
function JsonNodeMaterialParser() {
    this._validator = null;
}

JsonNodeMaterialParser.prototype.parse = function (input) {
    var migrated = this.migrate(input);
    var validated = this._validate(migrated);

    var material = new NodeMaterial();
    this.initialize(material, validated);

    return material;
};

/**
 * @private
 * @function
 * @name pc.JsonNodeMaterialParser#initialize
 * @description  Initialize material properties from the material data block e.g. Loading from server.
 * @param {pc.StandardMaterial} material - The material to be initialized.
 * @param {object} data - The data block that is used to initialize.
 */
JsonNodeMaterialParser.prototype.initialize = function (material, data) {

    // initialize material values from the input data
    // no predefined list of properties - apart from shaderGraph
    for (var key in data) {
        var value = data[key];

        var isGraph = (key=='shaderGraph');

        var isTexture = (key.indexOf('tex_')===0);
        var isVec2 = (key.indexOf('vec2_')===0);
        var isRgb = (key.indexOf('rgb_')===0);
        var isBoundingbox = (key.indexOf('bb_')===0);

        if (isVec2) {
            material[key] = new Vec2(value[0], value[1]);
        } else if (isRgb) {
            material[key] = new Color(value[0], value[1], value[2]);
        } else if (isTexture || isGraph) {
            if (value instanceof Texture || value instanceof ShaderGraphNode) {
                material[key] = value;
            } else if (material[key] instanceof Texture && typeof(value) === 'number' && value > 0) {
                // material already has a texture or graph assigned, but data contains a valid asset id (which means the asset isn't yet loaded)
                // leave current texture/graph (probably a placeholder) until the asset is loaded
            } else {
                material[key] = null;
            }
        } else if (isBoundingbox) {
            var center = new Vec3(value.center[0], value.center[1], value.center[2]);
            var halfExtents = new Vec3(value.halfExtents[0], value.halfExtents[1], value.halfExtents[2]);
            material[key] = new BoundingBox(center, halfExtents);
        } else {
            // number, boolean and enum types don't require type creation
            material[key] = data[key];
        }
    }

    material.update();
};

// convert any properties that are out of date
// or from old versions into current version
JsonNodeMaterialParser.prototype.migrate = function (data) {
 
    //no conversion needed (yet)

    return data;
};

// check for invalid properties
JsonNodeMaterialParser.prototype._validate = function (data) {
    
    //no conversion needed (yet)

    return data;
};

export { JsonNodeMaterialParser };
