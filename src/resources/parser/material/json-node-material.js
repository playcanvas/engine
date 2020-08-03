import { Color } from '../../../core/color.js';

import { Vec2 } from '../../../math/vec2.js';
import { Vec3 } from '../../../math/vec3.js';

import { Texture } from '../../../graphics/texture.js';

import { BoundingBox } from '../../../shape/bounding-box.js';

import { NodeMaterial } from '../../../scene/materials/node-material.js';
//import { ShaderGraphNode } from '../../../scene/materials/shader-node.js';

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
    this.initialize(material, validated.graphData);

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

    var material_ready=true;

    //input or output or constant variables - all node material types have this block
    if (!data.iocVars)
    {
        if (data.customFuncGlsl && (typeof(data.customFuncGlsl) === 'number' && data.customFuncGlsl > 0))
        {
            material_ready = false
        }
    }

    if (data.iocVars)
    {
        for (var i=0;i<data.iocVars.length;i++)
        {
            if (data.iocVars[i].valueTex)
            {
                if (typeof(data.iocVars[i].valueTex) === 'number' && data.iocVars[i].valueTex > 0)
                {
                    //texture asset not loaded yet - deal with in node material binder
                    if (!material.iocVars[i].valueTex) 
                    {   
                        //seems no placeholder is set yet
                        material_ready = false;
                    }
                }
                else
                {
                    //texture asset loaded - assign
                    Object.assign(material.iocVars[i], data.iocVars[i]);
                }
            }
            else
            {
                //assign directly - we (probably) don't need to convert to Vec2/3/4 objects?
                Object.assign(material.iocVars[i], data.iocVars[i]);
            }
        }
    }

    if (data.customFuncGlsl)
    {
        //this means this is a custom node (often also has a decl shader)
        if (data.customDeclGlsl)
        {
            if (typeof(data.customDeclGlsl) === 'number' && data.customDeclGlsl > 0)
            {
                //this means asset is not loaded yet - cannot assign
                material_ready = false;
            }
            else
            {
                //shader asset loaded - assign!
                material.customDeclGlsl=data.customDeclGlsl;
            }
        }

        if (data.customFuncGlsl) 
        {
            if (typeof(data.customFuncGlsl) === 'number' && data.customFuncGlsl > 0)
            {
                //this means asset is not loaded yet - cannot assign
                material_ready = false;
            }
            else
            {
                //shader asset loaded - assign!
                material.customFuncGlsl=data.customFuncGlsl;
            }
        }

        if (material_ready && !data.iocVars)
        {
            material._genIocVars();
        }
    }
    else if (data.subGraphs)
    {
        // graph node material
        
        if (data.connections)
        {
            // sub graph connections - only graph node materials have this
            material.connections=[];

            for (var i=0;i<data.connections.length;i++)
            {
                //connections are indices and names - just assign
                Object.assign(material.connections[i], data.connections[i]);
            }
        }

        if (data.subGraphs)
        {
            material.subGraphs=[];

            for (var i=0;i<data.subGraphs.length;i++)
            {
                if (typeof(data.subGraphs[i]) === 'number' && data.subGraphs[i] > 0)
                {
                    //this means sub graph asset is not loaded yet - cannot assign
                    material_ready = false;
                }
                else
                {
                    //sub graph asset loaded - assign!
                    material.subGraphs[i]=data.subGraphs[i];
                }
            }
        }
    }
    else
    {
        //no custom glsl or sub graphs - this means this is a node material instance
    }

    //only mark for update if ready dependent assets (with no placeholders) are loaded
    if (material_ready) material.update();
};

// convert any properties that are out of date
// or from old versions into current version
JsonNodeMaterialParser.prototype.migrate = function (data) {
 
    //no conversion needed (yet)

    return data;
};

// check for invalid properties
JsonNodeMaterialParser.prototype._validate = function (data) {
    
    //no validation needed (yet)

    return data;
};

export { JsonNodeMaterialParser };
