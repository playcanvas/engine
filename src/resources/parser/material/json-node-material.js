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
function JsonNodeMaterialParser(device, placeholderNodeMat) {
    this._device = device;
    this._validator = null;

    this._placeholderNodeMat = placeholderNodeMat;
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

    var material_ready=true;

    //input or output or constant variables - all node material types have this block
    if (data.graphData.iocVars)
    {
        //for (var i=0;i<data.graphData.iocVars.length;i++)
        for (var i=0;i<Object.keys(data.graphData.iocVars).length;i++)        
        {
            if (data.graphData.iocVars[i].type==='sampler2D' && data.graphData.iocVars[i].valueTex)
            {
                if (typeof(data.graphData.iocVars[i].valueTex) === 'number' && data.graphData.iocVars[i].valueTex > 0)
                {
                    //texture asset not loaded yet - deal with in node material binder
                    if (!(material.graphData.iocVars[i] && material.graphData.iocVars[i].valueTex))
                    {   
                        //seems no placeholder is set yet
                        material_ready = false;
                    }
                }
                else
                {
                    //texture asset loaded - assign
                    material.graphData.iocVars[i]={};
                    Object.assign(material.graphData.iocVars[i], data.graphData.iocVars[i]);
                }
            }
            else
            {
                //assign directly - we (probably) don't need to convert to Vec2/3/4 objects?
                material.graphData.iocVars[i]={};
                Object.assign(material.graphData.iocVars[i], data.graphData.iocVars[i]);

                //deal with 0 being undefined (TODO: find better way?)
                var var_type=material.graphData.iocVars[i].type;
                if (material.graphData.iocVars[i].valueW===undefined && var_type==='vec4') material.graphData.iocVars[i].valueW=0;
                if (material.graphData.iocVars[i].valueZ===undefined && (var_type==='vec4' || var_type==='vec3' )) material.graphData.iocVars[i].valueZ=0;
                if (material.graphData.iocVars[i].valueY===undefined && (var_type==='vec4' || var_type==='vec3' || var_type==='vec2' )) material.graphData.iocVars[i].valueY=0;
                if (material.graphData.iocVars[i].valueX===undefined && (var_type==='vec4' || var_type==='vec3' || var_type==='vec2' || var_type==='float' )) material.graphData.iocVars[i].valueX=0;
            }
        }
    }
    
    if (data.graphData.customFuncGlsl)
    {
        //this means this is a custom node (often also has a decl shader)
        if (data.graphData.customDeclGlsl)
        {
            if (typeof(data.graphData.customDeclGlsl) === 'number' && data.graphData.customDeclGlsl > 0)
            {
                //this means asset is not loaded yet - cannot assign
                material_ready = false;
            }
            else
            {
                //shader asset loaded - assign!
                material.graphData.customDeclGlsl=data.graphData.customDeclGlsl;
            }
        }

        if (data.graphData.customFuncGlsl) 
        {
            if (typeof(data.graphData.customFuncGlsl) === 'number' && data.graphData.customFuncGlsl > 0)
            {
                //this means asset is not loaded yet - cannot assign
                material_ready = false;
            }
            else
            {
                //shader asset loaded - assign and generate matching iocVars
                material.graphData.customFuncGlsl=data.graphData.customFuncGlsl;
                material.graphData.iocVars.length=0;
                material.genCustomFuncIocVars();

                //copy values that match into new iocVars - if not matching reset
                //TODO: make this more robust (match even if index doesn't match)?
                if (material.graphData.iocVars)
                {
                    for (var i=0;i<material.graphData.iocVars.length;i++)
                    {
                        //if (data.graphData.iocVars && i<data.graphData.iocVars.length && material.graphData.iocVars[i].name===data.graphData.iocVars[i].name && material.graphData.iocVars[i].type===data.graphData.iocVars[i].type )
                        if (data.graphData.iocVars && i<Object.keys(data.graphData.iocVars).length && material.graphData.iocVars[i].name===data.graphData.iocVars[i].name && material.graphData.iocVars[i].type===data.graphData.iocVars[i].type )
                        {
                            //exists and matches copy what is already set in the asset 
                            Object.assign(material.graphData.iocVars[i], data.graphData.iocVars[i]);
                        }
                        else
                        {
                            //reset and copy material into data.graphData
                            //data.graphData.iocVars[i]={};
                            //Object.assign(data.graphData.iocVars[i], material.graphData.iocVars[i]);
                        }
                    }
                }
            }
        }
    }
    else if (data.graphData.subGraphs)
    {
        // graph node material
        if (data.graphData.connections)
        {
            // sub graph connections - only graph node materials have this
            material.graphData.connections=[];

            //for (var i=0;i<data.graphData.connections.length;i++)
            for (var i=0;i<Object.keys(data.graphData.connections).length;i++)              
            {
                //connections are indices and names - no asset refs - so just assign
                material.graphData.connections[i]={};
                Object.assign(material.graphData.connections[i], data.graphData.connections[i]);

                //deal with 0 index problem
                if (material.graphData.connections[i].inVarName && material.graphData.connections[i].inNodeIndex===undefined) material.graphData.connections[i].inNodeIndex=0;
                if (material.graphData.connections[i].outVarName && material.graphData.connections[i].outNodeIndex===undefined) material.graphData.connections[i].outNodeIndex=0;
            }
        }

        if (data.graphData.subGraphs)
        {
            if (material.graphData.subGraphs.length!=Object.keys(data.graphData.subGraphs).length)
            {
                material.graphData.subGraphs.length=Object.keys(data.graphData.subGraphs).length;
            }

            //for (var i=0;i<data.graphData.subGraphs.length;i++)
            for (var i=0;i<Object.keys(data.graphData.subGraphs).length;i++)                  
            {
                if (typeof(data.graphData.subGraphs[i]) === 'number' && data.graphData.subGraphs[i] > 0)
                {
                    material.graphData.subGraphs[i]=data.graphData.subGraphs[i];
                    //this means sub graph asset is not loaded yet - cannot assign
                    material_ready = false;
                }
                else
                {
                    //check if ready
                    //if (data.graphData.subGraphs[i]._material_ready===true)
                    {
                        //sub graph asset loaded and ready - assign!
                        material.graphData.subGraphs[i]=data.graphData.subGraphs[i];
                    }
                    //else
                    //{
                    //    material_ready = false;
                    //}
                }
            }
        }
    }
    else
    {
        if (data.graphData.iocVars)
        {
            //no custom glsl or sub graphs - this means this is a node material instance?
            //TODO: support material instances properly
            material_ready=false;
        }
        else
        {
            //completely empty?
            material_ready=false;
        }        
    }

    //only mark for update if ready dependent assets (with no placeholders) are loaded
    if (material_ready)
    {
        //data._material_ready=true;
        material.dirtyShader = true;
        material.update();
    }
    else
    {
        //data._material_ready = false;
        material.setPlaceHolderShader(this._placeholderNodeMat);
    }
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
