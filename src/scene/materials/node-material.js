import { programlib } from '../../graphics/program-lib/program-lib.js';
import { Shader } from '../../graphics/shader.js';

import { Material } from './material.js';

import {
    SHADER_FORWARD
    //SHADER_DEPTH, SHADER_FORWARD, SHADER_FORWARDHDR, SHADER_PICK, SHADER_SHADOW
 } from '../constants.js';

import { Texture } from '../../graphics/texture.js';
import { Vec2 } from '../../math/vec2.js';
import { Vec3 } from '../../math/vec3.js';
import { Vec4 } from '../../math/vec4.js';

/**
 *
 *
 * @class
 * @name NodeMaterial
 * @classdesc A Node material is for rendering geometry with material properties set by a material node graph
 * @example
 * // Create a new Node material
 * var material = new NodeMaterial();
 *
 *
 * // Notify the material that it has been modified
 * material.update();
 */
var NodeMaterial = function (funcGlsl, declGlsl) {
    Material.call(this);

    // storage for asset references
    this._iocVarAssetReferences = [];
    this._glslAssetReferences = {};
    this._subGraphAssetReferences = [];

    this.graphData = {};

    this.graphData.iocVars = []; //input, output or constant variables

    if (funcGlsl)
    {
        this.graphData.customFuncGlsl=funcGlsl;
        this.graphData.customDeclGlsl=declGlsl;
        this.genCustomFuncIocVars();
    }
    else
    {
        this.graphData.subGraphs = [];
        this.graphData.connections = []; 
    }
    
    this.shaderVariants = [];
 
};

NodeMaterial.prototype = Object.create(Material.prototype);
NodeMaterial.prototype.constructor = NodeMaterial;

Object.assign(NodeMaterial.prototype, {
    /**
     * @function
     * @name NodeMaterial#clone
     * @description Duplicates a Node material. All properties are duplicated except textures
     * where only the references are copied.
     * @returns {NodeMaterial} A cloned Node material.
     */
    clone: function () {
        var clone = new NodeMaterial();

        Material.prototype._cloneInternal.call(this, clone);

        clone.graphData = {};

        clone.graphData.iocVars=this.graphData.iocVars.slice(0);
        clone.graphData.subGraphs=this.graphData.subGraphs.slice(0);
        clone.graphData.connections=this.graphData.connections.slice(0);

        clone.graphData.customDeclGlsl=this.graphData.customDeclGlsl;
        clone.graphData.customFuncGlsl=this.graphData.customFuncGlsl;

        clone.shaderVariants=this.shaderVariants.slice(0);

        return clone;
    },

    updateUniforms: function () {
        this.clearParameters();

        for (var n = 0; n < this.graphData.iocVars.length; n++) 
        {
            var iocVar=this.graphData.iocVars[n];

            if (iocVar.name.startsWith('IN_') || (iocVar.name.startsWith('CONST_') && iocVar.type==='sampler2D'))
            {
                var g_id='_'+this.id;

                switch (iocVar.type) {
                    case 'sampler2D':
                        this.setParameter(iocVar.name+g_id, iocVar.valueTex);
                        break;
                    case 'float':
                        this.setParameter(iocVar.name+g_id, iocVar.valueX);
                        break;
                    case 'vec2':
                        this.setParameter(iocVar.name+g_id, [iocVar.valueX, iocVar.valueY]);
                        break;
                    case 'vec3':
                        this.setParameter(iocVar.name+g_id, [iocVar.valueX, iocVar.valueY, iocVar.valueZ]);
                        break;                    
                    case 'vec4':
                        this.setParameter(iocVar.name+g_id, [iocVar.valueX, iocVar.valueY, iocVar.valueZ, iocVar.valueW]);
                        break;
                    case 'samplerCube':
                    default:
                        // error
                        break;
                }
            }
        }
/*
        if (this._depGraphTextureList)
        {
            for (var i = 0; i < this._depGraphTextureList.length; i++) 
            {
                var depGraphTexture=this._depGraphTextureList[i];

                this.setParameter(depGraphTexture.name, depGraphTexture.valueTex);
            }
        }*/

        if (this.dirtyShader || !this._scene) {
            this.shader = null;
            this.clearVariants();
        }
    },

    updateShader: function (device, scene, objDefs, staticLightList, pass, sortedLights)
    {
        //update dynamic lighting - for now main light is first directional light in slot 0 of 32 slots
 /*      
        var dynamicLightlist = [];
        var mainLight;

        for (i = 0; i < sortedLights[LIGHTTYPE_DIRECTIONAL].length; i++) 
        {
            var light = sortedLights[LIGHTTYPE_DIRECTIONAL][i];
            if (light.enabled && light. ) {
                if (light.mask & mask) {
                    if (lType !== LIGHTTYPE_DIRECTIONAL) {
                        if (light.isStatic) {
                            continue;
                        }
                    }
                    lightsFiltered.push(light);
                }
            }
        }
*/
        if (this.hasValidGraphData())
        {
            this.initShader(device);
            this.dirtyShader = false;
        }

        if (this.shaderVariants[pass])
        {
            this.shader = this.shaderVariants[pass];
        }
        else
        {
            this.shader = this._placeHolderShader;
        }
    },

    setPlaceHolderShader: function (placeHolderMat) {   
        this._placeHolderShader=placeHolderMat.shaderVariants[SHADER_FORWARD];
    },
    
    hasValidGraphData: function ()
    {
        if (this.graphData.iocVars && this.graphData.iocVars.length>0 && (this.graphData.customFuncGlsl || ( this.graphData.subGraphs && this.graphData.subGraphs.length>0 && this.graphData.connections)))
        {
            for (var i=0;i<this.graphData.iocVars.length;i++)
            {   
                if (this.graphData.iocVars[i] && this.graphData.iocVars[i].name && this.graphData.iocVars[i].type)
                {
                    if (this.graphData.iocVars[i].type==='sampler2D' && !this.graphData.iocVars[i].name.startsWith('OUT_') )
                    {
                        if (!(this.graphData.iocVars[i].valueTex && this.graphData.iocVars[i].valueTex instanceof Texture))
                        {
                            return false;
                        }
                    }
                    else if (this.graphData.iocVars[i].type==='float' && !this.graphData.iocVars[i].name.startsWith('OUT_') )
                    {
                        if (!(this.graphData.iocVars[i].valueX!=undefined && typeof(this.graphData.iocVars[i].valueX)==='number'))
                        {
                            return false;
                        }
                    }                    
                    else if (this.graphData.iocVars[i].type==='vec2' && !this.graphData.iocVars[i].name.startsWith('OUT_') )
                    {
                        if (!(this.graphData.iocVars[i].valueX!=undefined && typeof(this.graphData.iocVars[i].valueX)==='number' &&
                              this.graphData.iocVars[i].valueY!=undefined && typeof(this.graphData.iocVars[i].valueY)==='number' ))
                        {
                            return false;
                        }
                    }
                    else if (this.graphData.iocVars[i].type==='vec3' && !this.graphData.iocVars[i].name.startsWith('OUT_') )
                    {
                        if (!(this.graphData.iocVars[i].valueX!=undefined && typeof(this.graphData.iocVars[i].valueX)==='number' &&
                              this.graphData.iocVars[i].valueY!=undefined && typeof(this.graphData.iocVars[i].valueY)==='number' &&
                              this.graphData.iocVars[i].valueZ!=undefined && typeof(this.graphData.iocVars[i].valueZ)==='number' ))
                        {
                            return false;
                        }
                    }                                        
                    else if (this.graphData.iocVars[i].type==='vec4' && !this.graphData.iocVars[i].name.startsWith('OUT_') )
                    {
                        if (!(this.graphData.iocVars[i].valueX!=undefined && typeof(this.graphData.iocVars[i].valueX)==='number' &&
                              this.graphData.iocVars[i].valueY!=undefined && typeof(this.graphData.iocVars[i].valueY)==='number' &&
                              this.graphData.iocVars[i].valueZ!=undefined && typeof(this.graphData.iocVars[i].valueZ)==='number' &&
                              this.graphData.iocVars[i].valueW!=undefined && typeof(this.graphData.iocVars[i].valueW)==='number' ))
                        {
                            return false;
                        }
                    }
                }
                else
                {
                    return false;
                }
            }
            
            if (this.graphData.customFuncGlsl)
            {
                if (typeof(this.graphData.customFuncGlsl)==='number')
                {
                    return false;
                }
            }
            else
            {
                //var verify={};
                for (var i=0;i<this.graphData.connections.length;i++)
                {   
                    if (this.graphData.connections[i])
                    {
                        if (!((this.graphData.connections[i].iocVarName && (this.graphData.connections[i].outVarName || this.graphData.connections[i].inVarName)) || (!this.graphData.connections[i].iocVarName && (this.graphData.connections[i].outVarName && this.graphData.connections[i].inVarName))))
                        {
                            //verify[this.graphData.connections[i].outIndex]=1;
                            return false
                        }
                    }
                    else
                    {
                        return false;
                    }
                }

                for (var i=0;i<this.graphData.subGraphs.length;i++)
                {   
                    if (this.graphData.subGraphs[i] && this.graphData.subGraphs[i] instanceof NodeMaterial && this.graphData.subGraphs[i].name)
                    {
                        if (!(this.graphData.subGraphs[i].hasValidGraphData())) //NB recursive!
                        {
                            return false;
                        }
                    }
                    else
                    {
                        return false;
                    }
                }
            }
            return true;
        }    
        return false;
    },

    //NB only called when shader graph is valid and shader is marked as dirty
    initShader: function (device) {    
        // this is where we could get a list of pass types in current app render pipeline (layers)
        // and query shader graph to check if there is a special output
        //var passes=[SHADER_DEPTH, SHADER_FORWARD, SHADER_FORWARDHDR, SHADER_PICK, SHADER_SHADOW];
        var passes=[SHADER_FORWARD];

        for (var i=0;i<passes.length; i++)
        {
            var useSkin = false;

            if (this.meshInstances && this.meshInstances[0] && this.meshInstances[0].skinInstance) 
            {
                useSkin = true; //TODO make this a variant?
            }

            var options = {
                skin: useSkin,
                shaderGraph: this,
                pass: passes[i],
                maxPixelLights: (this.maxPixelLights) ? this.maxPixelLights : 4,
                maxVertexLights: (this.maxVertexLights) ? this.maxVertexLights : 8
            };

            //var depGraphTextureList=[];

            var shaderDefinition = programlib.node.createShaderDefinition(device, options);
            this.shaderVariants[passes[i]] = new Shader(device, shaderDefinition);

            //this._depGraphTextureList=depGraphTextureList;
        }
    },

/*    _defineIocVarSetterGetter: function (name, iocVar) {
        Object.defineProperty(this, name, {
            set: function (value) {
                if (value instanceof NodeMaterial)
                {
                    this.connectNodeToIocVar(value, 'OUT_ret', iocVar.name);
                }
            },
            get: function () {
                return iocVar;
            }
        });
    },*/

    _addIocVar: function (type, name, value) {
        var iocVar
        if (value instanceof Texture)
        {
            iocVar={type:type, name:name, valueTex:value};
        }
        else if (value instanceof Vec4)
        {
            iocVar={type:type, name:name, valueX:value.x, valueY:value.y, valueZ:value.z, valueW:value.w};
        }
        else if (value instanceof Vec3)
        {
            iocVar={type:type, name:name, valueX:value.x, valueY:value.y, valueZ:value.z};
        }
        else if (value instanceof Vec2)
        {
            iocVar={type:type, name:name, valueX:value.x, valueY:value.y};
        }
        else if (typeof(value) === 'number')
        {
            iocVar={type:type, name:name, valueX:value};
        }
        else
        {
            iocVar={type:type, name:name};
        }

        this.graphData.iocVars.push(iocVar);
    
        return iocVar;
    },
    
    addInput: function (type, name, value) {
        return this._addIocVar(type, 'IN_'+name, value);
    },
    
    addOutput: function (type, name, value) {
        return this._addIocVar(type, 'OUT_'+name, value);
    },
    
    addConstant: function (type, value) {
        return this._addIocVar(type, 'CONST_'+type+'_'+this.graphData.iocVars.length, value); //create a unique name
    },
    
    genCustomFuncIocVars: function () {
        var functionString = this.graphData.customFuncGlsl.trim();
    
        var head = functionString.split(")")[0];
        var rettype_funcname = head.split("(")[0];
        var rettype = rettype_funcname.split(" ")[0];
        var params = head.split("(")[1].split(",");
    
        this.name = rettype_funcname.split(" ")[1];
        // TODO check for function name clashes - maybe replace func name in function string with hash key?
    
        if (rettype != "void") {
            this.addOutput(rettype,'ret');
            //this.defineOuputGetter(this.outputName[0], 0);
        }
    
        for (var p = 0; p < params.length; p++) {
            var io_type_name = params[p].split(" ");
    
            if (io_type_name[0] === "") io_type_name.shift();
    
            if (io_type_name[0] === "out") {
                this.addOutput(io_type_name[1],io_type_name[2]);
                //this.defineOuputGetter(this.outputName[this.outputName.length - 1], this.outputName.length - 1);
            }
            if (io_type_name[0] === "in") {
                this.addInput(io_type_name[1],io_type_name[2]);    
                //this.defineInputSetter(this.inputName[this.inputName.length - 1], this.inputName.length - 1);
            } else {
                // unsupported parameter !!! TODO add support for more parameter types?
            }
        }
    },
    
    addSubGraph: function (graph) {
        var ret=this.graphData.subGraphs.length;
        this.graphData.subGraphs.push(graph);
        return ret;
    },
    
    connectNodeToNode: function (outNodeIndex, outVarName, inNodeIndex, inVarName) {
        var connection = { outNodeIndex: outNodeIndex, outVarName: 'OUT_'+outVarName, inNodeIndex: inNodeIndex, inVarName: 'IN_'+inVarName };
    
        this.graphData.connections.push(connection);
    },

    connectIocVarToNode: function (iocVarName, inNodeIndex, inVarName) {
        var connection = { iocVarName: iocVarName, inNodeIndex: inNodeIndex, inVarName: 'IN_'+inVarName };
    
        this.graphData.connections.push(connection);
    },    
    
    connectNodeToIocVar: function (outNodeIndex, outVarName, iocVarName) {
        var connection = { outNodeIndex: outNodeIndex, outVarName: 'OUT_'+outVarName, iocVarName: iocVarName };
 
        this.graphData.connections.push(connection);
    },

    _getIocVarValueString: function (iocVar)
    {
        var ret;

        if (iocVar.type==='float')
        {
            ret = 'float('+ iocVar.valueX +')';
        }
        else if (iocVar.type==='vec2')
        {
            ret = 'vec2('+ iocVar.valueX +', ' + iocVar.valueY +')';
        }                
        else if (iocVar.type==='vec3')
        {
            ret = 'vec3('+ iocVar.valueX +', ' + iocVar.valueY +', ' + iocVar.valueZ +')';
        }        
        else if (iocVar.type==='vec4')
        {
            ret = 'vec4('+ iocVar.valueX +', ' + iocVar.valueY +', ' + iocVar.valueZ +', ' + iocVar.valueW +')';
        }   
        
        return ret;
    },

    _generateSubGraphCall: function (inNames, outNames)
    {
        var callString='';
    
        for (var i=0; i<this.graphData.iocVars.length;i++) 
        {
            var iocVar = this.graphData.iocVars[i];
            if (iocVar.name.startsWith('OUT_ret'))
            {
                if (outNames[iocVar.name]!=undefined)
                {
                    callString+=outNames[iocVar.name]+' = ';
                }
                else
                {
                    //I guess this is actually valid (return value not assigned to anything)
                }
            }
        }


        if (this.graphData.customFuncGlsl) 
        {
            callString+=this.name+'( ';
        }
        else
        {
            callString+=this.name+'_'+this.id+'( ';
        }

        for (var i=0; i<this.graphData.iocVars.length;i++) 
        {
            var iocVar = this.graphData.iocVars[i];
            if (iocVar.name.startsWith('IN_'))
            {
                if (inNames && inNames[iocVar.name]!=undefined)
                {
                    callString+=inNames[iocVar.name]+', ';
                }
                else
                {
                    //not connected
                    //if (iocVar.type==='sampler2D')
                    {
                        //this is tricky - use varname and unique (temp) id
                        callString+=iocVar.name+'_'+this.id+', ';
                    }
                    //else
                    //{
                    //    callString+=this._getIocVarValueString(iocVar)+', ';
                    //}
                }
            }
        }

        for (var i=0; i<this.graphData.iocVars.length;i++) 
        {
            var iocVar = this.graphData.iocVars[i];
            if (iocVar.name.startsWith('OUT_') && !iocVar.name.startsWith('OUT_ret'))
            {
                if (outNames[iocVar.name]!=undefined)
                {
                    callString+=outNames[iocVar.name]+', ';
                }
                else
                {
                    //this shouldn't be possible - all outputs from connected subgraphs will have a tmpVar declared.
                    //ERROR!!!!                    
                }
            }
        }
    
        if (callString.endsWith(', ')) callString=callString.slice(0,-2);
                
        callString+=' );\n';
    
        return callString;
    },
    
    _getIocVarByName: function (name)
    {
        //convienient but not fast - TODO: optimize?
        return this.graphData.iocVars.filter(function(iocVar) { return iocVar.name === name; })[0];
    },

    _generateSubGraphFuncs: function (depGraphFuncs, depGraphVarList)
    {
        if (this.graphData.subGraphs!=undefined)
        {
            for (var i=0; i<this.graphData.subGraphs.length; i++) 
            {
                var subGraph=this.graphData.subGraphs[i];

                var name = subGraph.name;
                if (!subGraph.graphData.customFuncGlsl) 
                {
                    name+='_'+subGraph.id;
                }

                if (depGraphFuncs[name]===undefined)
                {
                    if (subGraph.graphData.iocVars)
                    {
                        for (var v=0; v<subGraph.graphData.iocVars.length; v++) 
                        {
                            var iocVar = subGraph.graphData.iocVars[v];
                            if (iocVar.name.startsWith('IN_') || (iocVar.name.startsWith('CONST_') && iocVar.type === 'sampler2D') )
                            {
                                var depGraphVar = 'uniform '+iocVar.type+' '+iocVar.name+'_'+subGraph.id+';\n';
                                
                                depGraphVarList.push(depGraphVar);

                                /*
                                if (iocVar.type === 'sampler2D' )
                                {
                                    var depGraphTexture = {name: iocVar.name+'_'+subGraph.id, valueTex: iocVar.valueTex, declString: 'uniform '+iocVar.type+' '+iocVar.name+'_'+subGraph.id+';\n'};

                                    depGraphTextureList.push(depGraphTexture);
                                }
                                */
                            }
                        }
                    }

                    depGraphFuncs[name]=subGraph._generateFuncGlsl();
                    subGraph._generateSubGraphFuncs(depGraphFuncs,depGraphVarList);
                }
            }
        }
    },

    generateRootDeclGlsl: function () 
    {
        var generatedGlsl='';
        //run through inputs (and const sampler2Ds) to declare uniforms - (default) values are set elsewhere
        for (var i=0; i<this.graphData.iocVars.length;i++) 
        {
            var g_id='_'+this.id;
            var iocVar = this.graphData.iocVars[i];
            if (iocVar.name.startsWith('IN_') || (iocVar.name.startsWith('CONST_') && iocVar.type === 'sampler2D'))
            {
                generatedGlsl += 'uniform ' + iocVar.type + ' ' + iocVar.name+g_id + ';\n';
            }
        }
        //run through constants values are set here (except for textures - which have to be uniforms)
        for (var i=0; i<this.graphData.iocVars.length;i++) 
        {
            var iocVar = this.graphData.iocVars[i];
            if (iocVar.name.startsWith('CONST_') && (iocVar.type != 'sampler2D' ))
            {
                generatedGlsl += iocVar.type + ' ' + iocVar.name + ' = '+this._getIocVarValueString(iocVar)+';\n';                                
            }
        }    

        //get all sub graph function definitions (including functions in sub graphs' sub graphs ...)
        //assumes names are unique - maybe should be id or key?
        var depGraphFuncs={};
        var depGraphVarList=[];

        var depName = this.name;
        if (!this.graphData.customFuncGlsl) 
        {
            depName+='_'+this.id;
        }
        depGraphFuncs[depName]=this._generateFuncGlsl(); //this should prevent infinite recursion?

        this._generateSubGraphFuncs(depGraphFuncs, depGraphVarList);

        //declare all dependancy textures
        for (var i=0; i<depGraphVarList.length;i++) 
        {
            generatedGlsl+=depGraphVarList[i];//.declString;
        }

        //add all the graph definitions
        var depGraphList=[]; //reverse order
        for (const func in depGraphFuncs) 
        {
            var funcString='';

            if ( func.endsWith('PS') ) {
                funcString += '#ifdef SG_PS\n';
            } else if ( func.endsWith('VS') ) {
                funcString += '#ifdef SG_VS\n';
            }
    
            funcString += depGraphFuncs[func] + '\n';
    
            if ( func.endsWith('PS')  ) {
                funcString += '#endif //SG_PS\n';
            } else if ( func.endsWith('VS') ) {
                funcString += '#endif //SG_VS\n';
            }

            depGraphList.push(funcString);
        };
        var t_len=depGraphList.length; //need this because pop() reduces array length!
        for (var i=0; i<t_len;i++) 
        {
            generatedGlsl+=depGraphList.pop();
        };

        return generatedGlsl;
    },

    generateRootCallGlsl: function () 
    {
        var generatedGlsl='';
        
        //generate input and output names for function call and run through outputs to declare variables
        var inNames = {};
        var outNames = {};

        for (var i=0; i<this.graphData.iocVars.length;i++) 
        {
            var g_id='_'+this.id;
            var iocVar = this.graphData.iocVars[i];
            if (iocVar.name.startsWith('IN_'))
            {
                inNames[iocVar.name]=iocVar.name+g_id;
            }
            if (iocVar.name.startsWith('OUT_'))
            {
                generatedGlsl += iocVar.type + ' ' + iocVar.name + ';\n';
                outNames[iocVar.name]=iocVar.name;
            }
        }

        generatedGlsl+=this._generateSubGraphCall(inNames, outNames);

        return generatedGlsl;
        //NB the pass (or layer) will decide which output is used and how
    },

    _generateFuncGlsl: function () {
        var generatedGlsl;

        if (this.graphData.customFuncGlsl) 
        {
            //custom and built-in
            generatedGlsl = this.graphData.customFuncGlsl.trim();
        }
        else if (this.graphData.subGraphs) 
        {
            //graph
            //function head
            var ret_used=false;

            for (var i=0; i<this.graphData.iocVars.length;i++) 
            {
                var iocVar = this.graphData.iocVars[i];
                if (iocVar.name.startsWith('OUT_ret'))
                {
                    //iocVarNameToIndexMap[iocVar.name]={type:iocVar.type, value:iocVar.value};
                    generatedGlsl=iocVar.type+' ';
                    ret_used = true;
                }
            }

            if (ret_used === true)
            {
                generatedGlsl+=this.name+'_'+this.id+'( ';
            }
            else
            {
                generatedGlsl='void '+this.name+'_'+this.id+'( ';
            }
    
            //temporary structures - with temp scope only in parsing function
            //var iocVarNameToIndexMap = [];

            for (var i=0; i<this.graphData.iocVars.length;i++) 
            {
                var iocVar = this.graphData.iocVars[i];
                if (iocVar.name.startsWith('IN_'))
                {
                    //iocVarNameToIndexMap[iocVar.name]={type:iocVar.type, value:iocVar.value};

                    generatedGlsl+='in '+iocVar.type+' '+iocVar.name+', ';
                }
            };
    
            for (var i=0; i<this.graphData.iocVars.length;i++) 
            {
                var iocVar = this.graphData.iocVars[i];
                if (iocVar.name.startsWith('OUT_'))
                {
                    if (!iocVar.name.startsWith('OUT_ret'))
                    {
                        //iocVarNameToIndexMap[iocVar.name]={type:iocVar.type, value:iocVar.value};
                        generatedGlsl+='out '+iocVar.type+' '+iocVar.name+', ';
                    }
                }
            }
    
            if (generatedGlsl.endsWith(', ')) generatedGlsl=generatedGlsl.slice(0,-2);
                
            generatedGlsl+=' ) {\n';
    
            //temporary structures - with temp scope only in parsing function
            var tmpVarCounter = 0;
            var outsgTmpVarMap = [];
            var insgTmpVarMap = [];
            var outIocVarTmpVarMap = {};
            
            var outsgConnectedsgMap = [];
            var insgConnectedsgMap = [];
    
            //create temp vars and graph traversal data
            for (var i=0; i<this.graphData.connections.length; i++) 
            {
                var con=this.graphData.connections[i];
    
                if (con.outNodeIndex!=undefined && con.inNodeIndex!=undefined)
                {
                    var outsgIndex=con.outNodeIndex;

                    if (outsgTmpVarMap[outsgIndex]===undefined) 
                    {
                        outsgTmpVarMap[outsgIndex]={};
        
                        for (var o=0; o<this.graphData.subGraphs[con.outNodeIndex].graphData.iocVars.length; o++)
                        {
                            var outIocVar=this.graphData.subGraphs[con.outNodeIndex].graphData.iocVars[o];//_getIocVarByName(con.outVarName);  
                            if (outIocVar.name.startsWith('OUT_'))
                            {
                                //generatedGlsl+=iocVar.type+' temp_'+iocVar.type+'_'+tmpVarCounter+' = '+iocVar.value+';\n';
                                generatedGlsl+=outIocVar.type+' temp_'+outIocVar.type+'_'+tmpVarCounter+';\n'
                                outsgTmpVarMap[outsgIndex][outIocVar.name]='temp_'+outIocVar.type+'_'+tmpVarCounter;
                                tmpVarCounter++;
                            }
                        }
                    }
                    
                    if (outsgConnectedsgMap[outsgIndex]===undefined) outsgConnectedsgMap[outsgIndex]=[];
                    outsgConnectedsgMap[outsgIndex].push(con.inNodeIndex);
    
                    var insgIndex=con.inNodeIndex;
                    if (insgTmpVarMap[insgIndex]===undefined) insgTmpVarMap[insgIndex]={};
                    
                    insgTmpVarMap[insgIndex][con.inVarName]=outsgTmpVarMap[outsgIndex][con.outVarName];
    
                    if (insgConnectedsgMap[insgIndex]===undefined) insgConnectedsgMap[insgIndex]=[];
                    insgConnectedsgMap[insgIndex].push(con.outNodeIndex);
                }
                else if (con.iocVarName && con.inNodeIndex!=undefined)
                {
                    var iocVarName=con.iocVarName;
                    
                    var insgIndex=con.inNodeIndex;
                    if (insgTmpVarMap[insgIndex]===undefined) insgTmpVarMap[insgIndex]={};
                    insgTmpVarMap[insgIndex][con.inVarName]=iocVarName;
                    
                    //sgFlag[insgIndex]=sgList.length;
                    //sgList.push(insgIndex);
                }       
                else if (con.outNodeIndex!=undefined && con.iocVarName)
                {
                    var outsgIndex=con.outNodeIndex;
                    
                    if (outsgTmpVarMap[outsgIndex]===undefined) 
                    {
                        outsgTmpVarMap[outsgIndex]={};
        
                        for (var o=0; o<this.graphData.subGraphs[con.outNodeIndex].graphData.iocVars.length; o++)
                        {
                            var outIocVar=this.graphData.subGraphs[con.outNodeIndex].graphData.iocVars[o];//_getIocVarByName(con.outVarName);  

                            if (outIocVar.name.startsWith('OUT_'))
                            {
                                //generatedGlsl+=iocVar.type+' temp_'+iocVar.type+'_'+tmpVarCounter+' = '+iocVar.value+';\n';
                                generatedGlsl+=outIocVar.type+' temp_'+outIocVar.type+'_'+tmpVarCounter+';\n'
                                outsgTmpVarMap[outsgIndex][outIocVar.name]='temp_'+outIocVar.type+'_'+tmpVarCounter;
                                tmpVarCounter++;
                            }
                        }
                    }
                    
                    var iocVarName=con.iocVarName;
                    outIocVarTmpVarMap[iocVarName]=outsgTmpVarMap[outsgIndex][con.outVarName];
                }    
            }
            
            //sort sub graphs for correct ordering
            var sgOnList=[];
            var sgList=[];

            var while_loop_count=0; //it should not be possible for the the number of iterations to exceeds the number of connections - unless there is a cyclic dependency

            while (sgList.length<this.graphData.subGraphs.length || while_loop_count<this.graphData.connections.length) 
            {
                while_loop_count++;

                for (var i=0; i<this.graphData.subGraphs.length; i++) 
                {
                    if (sgOnList[i]!=true)
                    {
                        var allInputsOnList=true;
                        if (insgConnectedsgMap[i]!=undefined)
                        {
                            for (var n=0; n<insgConnectedsgMap[i].length; n++) 
                            {
                                var inConi=insgConnectedsgMap[i][n];
                                if (sgOnList[inConi]!=true)
                                {
                                    allInputsOnList=false;
                                    break;
                                }
                            }
                        }
                        if (allInputsOnList===true)
                        {
                            sgList.push(i);
                            sgOnList[i]=true;
                        }
                    }
                }
            }

            // sub graph function calls     
            for (var i=0; i<sgList.length; i++) 
            {
                var sgIndex=sgList[i];
    
                //skip if no outputs 
                if (outsgTmpVarMap[sgIndex]!=undefined) 
                {
                    var func=this.graphData.subGraphs[sgIndex].name;

                    if ( func.endsWith('PS') ) {
                        generatedGlsl += '#ifdef SG_PS\n';
                    } else if ( func.endsWith('VS') ) {
                        generatedGlsl += '#ifdef SG_VS\n';
                    }
            
                    generatedGlsl+=this.graphData.subGraphs[sgIndex]._generateSubGraphCall(insgTmpVarMap[sgIndex], outsgTmpVarMap[sgIndex]);

                    if ( func.endsWith('PS')  ) {
                        generatedGlsl += '#endif //SG_PS\n';
                    } else if ( func.endsWith('VS') ) {
                        generatedGlsl += '#endif //SG_VS\n';
                    }
                }
            }
    
            //output assignment
            for (var i=0; i<this.graphData.iocVars.length;i++) 
            {
                var iocVar = this.graphData.iocVars[i];
                if (iocVar.name.startsWith('OUT_') && !iocVar.name.startsWith('OUT_ret'))
                {
                    generatedGlsl+=iocVar.name+' = '+outIocVarTmpVarMap[iocVar.name]+';\n';
                }
            }
    
            generatedGlsl+='}\n';
        }

        return generatedGlsl;
    }

});

var shadergraph = {};

shadergraph.graphCounter=0;

shadergraph.nodeRegistry={};

shadergraph._getNode = function (name, funcString, declString)
{
    if (!this.nodeRegistry[name])
    {
        this.nodeRegistry[name] = new NodeMaterial(funcString, declString);
    }
    
    return this.nodeRegistry[name];
};

shadergraph.start = function () {
    //check current graph is null? 
    shadergraph.graph=this._getNode('graphRoot_'+shadergraph.graphCounter);
    shadergraph.graph.name='graphRoot_'+shadergraph.graphCounter;
};

shadergraph.end = function () {
    var ret=shadergraph.graph;
    shadergraph.graph=null;
    shadergraph.graphCounter++;
    return ret;
};

shadergraph.textureSample2D = function (name, texture, uv) {

    var texSampNode = this.graph.addSubGraph(this._getNode('texSample','vec4 texSample(in sampler2D tex, in vec2 uv, out vec3 color, out float alpha) {\n vec4 samp=texture2D(tex, uv);\n color=samp.rgb;\n alpha=samp.a;\n return samp;\n}'));

    //assumes name is unique TODO: verify?
    var iocVar = this.graph.addInput('sampler2D', name, texture);
    this.graph.connectIocVarToNode(iocVar.name, texSampNode, 'tex');    
    this.graph.connectNodeToNode(uv, 'ret', texSampNode, 'uv');

    return texSampNode;
};

shadergraph.customNode = function (name,f,d) {
    var nodeIndex = this.graph.addSubGraph(this._getNode(name,f,d));
    return nodeIndex;
};

Object.defineProperty(shadergraph, 'uv0', {
    get: function () {
        var nodeIndex = this.graph.addSubGraph(this._getNode('uv0','vec2 uv0() { return vUv0; }'));
        return nodeIndex;
    }
});

Object.defineProperty(shadergraph, 'worldPosPS', {
    get: function () {
        var nodeIndex = this.graph.addSubGraph(this._getNode('worldPosPS','vec3 wpPS() { return vPosition; }'));
        return nodeIndex;
    }
});

Object.defineProperty(shadergraph, 'worldNormPS', {
    get: function () {
        var nodeIndex = this.graph.addSubGraph(this._getNode('worldNormPS','vec3 wnPS() { return vNormal; }'));
        return nodeIndex;
    }
});

Object.defineProperty(shadergraph, 'worldPosVS', {
    get: function () {
        var nodeIndex = this.graph.addSubGraph(this._getNode('worldPosVS','vec3 wpVS() { return getWorldPositionNM(); }'));
        return nodeIndex;
    }
});

Object.defineProperty(shadergraph, 'worldNormVS', {
    get: function () {
        var nodeIndex = this.graph.addSubGraph(this._getNode('worldNormVS','vec3 wnVS() { return getWorldNormalNM(); }'));
        return nodeIndex;
    }
});

shadergraph.param = function (type, name, value) {
    //assumes name is unique TODO: verify this
    var iocVar = this.graph.addInput(type, name, value);
    return iocVar;
};

shadergraph.connectFragOut = function (nodeIndex, name)
{
    //assumes this is only called once per graph TODO: verify this
    var iocVar = this.graph.addOutput('vec4', 'fragOut', [0,0,0,0]);
    this.graph.connectNodeToIocVar(nodeIndex, (name)?name:'ret', iocVar.name);   
}

shadergraph.connectVertexOffset = function (nodeIndex, name)
{
    //assumes this is only called once per graph TODO: verify this
    var iocVar = this.graph.addOutput('vec3', 'vertOff', [0,0,0]);
    this.graph.connectNodeToIocVar(nodeIndex, (name)?name:'ret', iocVar.name);   
}

shadergraph.connectCustom = function (destNodeIndex, destName, nodeIndex_or_param, name)
{
    if (typeof(nodeIndex_or_param) === 'number')
    {
        var nodeIndex=nodeIndex_or_param;
        this.graph.connectNodeToNode(nodeIndex, (name)?name:'ret', destNodeIndex, destName);        
    }
    else
    {
        var iocVar=nodeIndex_or_param;
        this.graph.connectIocVarToNode(iocVar.name, destNodeIndex, destName);
    }
}

export { NodeMaterial, shadergraph };
