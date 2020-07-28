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


    this.iocVars = []; //input, output or constant variables

    if (funcGlsl)
    {
        this.customFuncGlsl=funcGlsl;
        this.customDeclGlsl=declGlsl;
        this._genIocVars();
    }
    else
    {
        this.subGraphs = [];
        this.connections = []; 
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

        clone.iocVars=this.iocVars.slice(0);
        clone.subGraphs=this.subGraphs.slice(0);
        clone.connections=this.connections.slice(0);

        clone.customDeclGlsl=this.customDeclGlsl;
        clone.customFuncGlsl=this.customFuncGlsl;

        clone.shaderVariants=this.shaderVariants.slice(0);

        return clone;
    },

    updateUniforms: function () {
        this.clearParameters();
/*
        for (var n = 0; n < this.shaderGraph.params.length; n++) {
            // if (!this.paramValues[n])
            // {
            //     this.paramValues[n] = (this.shaderGraph.params[n].value.clone) ? this.shaderGraph.params[n].value.clone() : this.shaderGraph.params[n].value;
            // }

            switch (this.shaderGraph.params[n].type) {
                case 'sampler2D':
                case 'samplerCube':
                case 'float':
                case 'vec2':
                case 'vec3':
                case 'vec4':
                    this.setParameter(this.shaderGraph.params[n].name, this.shaderGraph.params[n].value);
                    break;
                default:
                    // error
                    break;
            }
        }*/
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
        if (this.shaderVariants[pass])
        {
            this.shader = this.shaderVariants[pass];
        }
        else
        {
            //new variant - maybe new layer that this material has a special output for?
            //TODO: 
            this.shader = this.shaderVariants[SHADER_FORWARD];//pass];
        }
    },

    //initShaderVariants: function (device) {
    initShader: function (device) {    
        // this is where we could get a list of pass types in current app render pipeline (layers)
        // and query shader graph to check if there is a special output
        //var passes=[SHADER_DEPTH, SHADER_FORWARD, SHADER_FORWARDHDR, SHADER_PICK, SHADER_SHADOW];
        var passes=[SHADER_FORWARD];

        for (var i=0;i<passes.length; i++)
        {
            if (!this.shaderVariants[passes[i]]) 
            {
                var options = {
                    skin: !!this.meshInstances[0].skinInstance,
                    shaderGraph: this,
                    pass: passes[i],
                    maxPixelLights: (this.maxPixelLights) ? this.maxPixelLights : 4,
                    maxVertexLights: (this.maxVertexLights) ? this.maxVertexLights : 8
                };

                var shaderDefinition = programlib.node.createShaderDefinition(device, options);
                this.shaderVariants[passes[i]] = new Shader(device, shaderDefinition);
            }
        }
    },

    _addIocVar: function (type, name, value) {
        
        var iocVar
        if (value instanceof Texture)
        {
            iocVar={type:type, name:name, valueTex:value};
        }
        else if (value instanceof Vec4)
        {
            iocVar={type:type, name:name, valueVec4:value};
        }
        else if (value instanceof Vec3)
        {
            iocVar={type:type, name:name, valueVec3:value};
        }
        else if (value instanceof Vec2)
        {
            iocVar={type:type, name:name, valueVec2:value};
        }
        else
        {
            iocVar={type:type, name:name, valueFloat:value};
        }

        this.iocVars.push(iocVar);
    
        return iocVar;
    },
    
    addInput: function (type, name, value) {
        return this._addIocVar(type, 'IN_'+name, value);
    },
    
    addOutput: function (type, name, value) {
        return this._addIocVar(type, 'OUT_'+name, value);
    },
    
    addConstant: function (type, value) {
        return this._addIocVar(type, 'CONST_'+type+'_'+this.iocVars.length, value); //create a unique name
    },
    
    _genIocVars: function () {
        var functionString = this.customFuncGlsl.trim();
    
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
        this.subGraphs.push(graph);
    
        return graph;
    },
    
    connectNodeToNode: function (outNodeIndex, outVarName, inNodeIndex, inVarName) {
        var connection = { outNodeIndex: outNodeIndex, outVarName: outVarName, inNodeIndex: inNodeIndex, inVarName: inVarName };
    
        this.connections.push(connection);
    },
    
    connectIocVarToNode: function (iocVarIndex, iocVarName, inNodeIndex, inIndex) {
        var connection = { iocVarIndex: iocVarIndex, iocVarName: iocVarName, inNodeIndex: inNodeIndex, inVarName: inVarName };
    
        this.connections.push(connection);
    },
    
    connectNodeToIocVar: function (outNodeIndex, outIndex, iocVarIndex, iocVarName) {
        var connection = { outNodeIndex: outNodeIndex, outVarName: outVarName, iocVarIndex: iocVarIndex, iocVarName: iocVarName };
 
        this.connections.push(connection);
    },
    
    _generateSubGraphCall: function (inNames, outNames)
    {
        var callString='';
    
        for (var name in outNames) 
        {
            if (name.startsWith("OUT_ret"))
            {
                callString+=outNames[name]+' = ';
            }
        }
        if (this.customFuncGlsl) 
        {
            callString+=this.name+'( ';
        }
        else
        {
            callString+=this.name+'_'+this.id+'( ';
        }

        for (var name in inNames) 
        {
            callString+=inNames[name]+', ';
        };
    
        for (var name in outNames) 
        {
            if (!name.startsWith("OUT_ret"))
            {
                callString+=outNames[name]+', ';
            }
        };
    
        if (callString.endsWith(', ')) callString=callString.slice(0,-2);
                
        callString+=' );\n';
    
        return callString;
    },
    
    _getIocVarByName: function (name)
    {
        //convienient but not fast - TODO: optimize?
        return this.iocVars.filter(function(iocVar) { return iocVar.name === name; })[0];
    },

    generateRootDeclGlsl: function () 
    {
        var generatedGlsl='';
        //run through inputs to declare uniforms - (default) values are set elsewhere
        for (var i=0; i<this.iocVars.length;i++) 
        {
            var iocVar = this.iocVars[i];
            if (iocVar.name.startsWith('IN_'))
            {
                generatedGlsl += 'uniform ' + iocVar.type + ' ' + iocVar.name + ';\n';
            }
        }

        generatedGlsl+=this._generateFuncGlsl();

        return generatedGlsl;
    },

    generateRootCallGlsl: function () 
    {
        var generatedGlsl='';
        
        //generate input and output names for function call and run through outputs to declare variables
        var inNames = {};
        var outNames = {};

        for (var i=0; i<this.iocVars.length;i++) 
        {
            var iocVar = this.iocVars[i];
            if (iocVar.name.startsWith('IN_'))
            {
                inNames[iocVar.name]=iocVar.name;
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

        if (this.customFuncGlsl) 
        {
            //custom and built-in
            generatedGlsl = this.customFuncGlsl.trim();
        }
        else if (this.subGraphs) 
        {
            //graph
            //function head
            var ret_used=false;

            for (var i=0; i<this.iocVars.length;i++) 
            {
                var iocVar = this.iocVars[i];
                if (iocVar.name.startsWith('OUT_RET'))
                {
                    iocVarNameToIndexMap[iocVar.name]={type:iocVar.type, value:iocVar.value};
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
            var iocVarNameToIndexMap = [];

            for (var i=0; i<this.iocVars.length;i++) 
            {
                var iocVar = this.iocVars[i];
                if (iocVar.name.startsWith('IN_'))
                {
                    iocVarNameToIndexMap[iocVar.name]={type:iocVar.type, value:iocVar.value};

                    generatedGlsl+='in '+iocVar.type+' '+iocVar.name+', ';
                }
            };
    
            for (var i=0; i<this.iocVars.length;i++) 
            {
                var iocVar = this.iocVars[i];
                if (iocVar.name.startsWith('OUT_'))
                {
                    if (!iocVar.name.startsWith('OUT_RET'))
                    {
                        iocVarNameToIndexMap[iocVar.name]={type:iocVar.type, value:iocVar.value};
                        generatedGlsl+='out '+iocVar.type+' '+iocVar.name+', ';
                    }
                }
            }
    
            if (generatedGlsl.endsWith(', ')) generatedGlsl=generatedGlslslice(0,-2);
                
            generatedGlsl+=' ) {\n';
    
            //run through constants values are set here (except for textures - which have to be uniforms)
            for (var i=0; i<this.iocVars.length;i++) 
            {
                var iocVar = this.iocVars[i];
                if (iocVar.name.startsWith('CONST_'))
                {
                    if (iocVar.valueTex)
                    {
                        generatedGlsl += 'uniform ' + iocVar.type + ' ' + iocVar.name + ';\n';
                    }
                    else if (iocVar.valueFloat)
                    {
                        generatedGlsl += iocVar.type + ' ' + iocVar.name + ' = float('+ iocVar.valueFloat +');\n';
                    }
                    else if (iocVar.valueVec2)
                    {
                        generatedGlsl += iocVar.type + ' ' + iocVar.name + ' = float('+ iocVar.valueVec2[0] +', ' + iocVar.valueVec2[1] +');\n';
                    }                
                    else if (iocVar.valueVec3)
                    {
                        generatedGlsl += iocVar.type + ' ' + iocVar.name + ' = float('+ iocVar.valueVec3[0] +', ' + iocVar.valueVec3[1] +', ' + iocVar.valueVec3[2] +');\n';
                    }        
                    else if (iocVar.valueVec4)
                    {
                        generatedGlsl += iocVar.type + ' ' + iocVar.name + ' = float('+ iocVar.valueVec4[0] +', ' + iocVar.valueVec4[1] +', ' + iocVar.valueVec4[2] +', ' + iocVar.valueVec4[3] +');\n';
                    }                                        
                }
            }
    
            //temporary structures - with temp scope only in parsing function
            var tmpVarCounter = 0;
            var outsgTmpVarMap = [];
            var insgTmpVarMap = [];
            var outIocVarTmpVarMap = {};
            
            var outsgConnectedsgMap = [];
            var insgConnectedsgMap = [];
    
            //var tmpVarFlag=[];
    
            var sgFlag=[];
            var sgList=[];
    
            //create temp vars and graph traversal data
            for (var i=0; i<this.connections.length; i++) 
            {
                var con=this.connections[i];
    
                if (con.outNodeIndex && con.inNodeIndex)
                {
                    if (!outsgTmpVarMap[con.outNodeIndex]) outsgTmpVarMap[con.outNodeIndex]={};
    
                    if (!outsgTmpVarMap[con.outNodeIndex][con.outVarName])
                    {
                        var iocVar=this.subGraphs[con.outNodeIndex].getIocVarByName(con.outVarName);  

                        generatedGlsl+=iocVar.type+' '+iocVar.name+'_'+tmpVarCounter+' = '+iocVar.value+';\n';
                        outsgTmpVarMap[con.outNodeIndex][con.outVarName]=iocVar.name+'_'+tmpVarCounter;
                        //tmpVarFlag[tmpVarCounter]=0;
                        tmpVarCounter++;
                    }
                    
                    if (!outsgConnectedsgMap[outsgIndex]) outsgConnectedsgMap[outsgIndex]=[];
                    outsgConnectedsgMap[outsgIndex].push(con.inNodeIndex);
    
                    var insgIndex=con.inNodeIndex;
                    if (!insgTmpVarMap[insgIndex]) insgTmpVarMap[insgIndex]=[];
                    
                    insgTmpVarMap[insgIndex][con.inVarName]=outsgTmpVarMap[outsgIndex][con.outVarName];
    
                    if (!insgConnectedsgMap[insgIndex]) insgConnectedsgMap[insgIndex]={};
                    insgConnectedsgMap[insgIndex][con.inVarName]=con.outNodeIndex;
                }
                else if (con.iocVarName && con.inNodeIndex)
                {
                    var iocVarName=con.iocVarName;
                    
                    var insgIndex=con.inNodeIndex;
                    if (!insgTmpVarMap[insgIndex]) insgTmpVarMap[insgIndex]=[];
                    insgTmpVarMap[insgIndex][con.inVarName]=iocVarName;
                    
                    sgList.push(insgIndex);
                    sgFlag[insgIndex]=1; //1 means on the list
                }       
                else if (con.outNodeIndex && con.iocVarName)
                {
                    var outsgIndex=con.outNodeIndex;
                    
                    if (!outsgTmpVarMap[outsgIndex]) outsgTmpVarMap[outsgIndex]={};
    
                    if (!outsgTmpVarMap[outsgIndex][con.outVarName])
                    {
                        var iocVar=this.subGraphs[con.outNodeIndex].getIocVarByName(con.outVarName);  

                        generatedGlsl+=iocVar.type+' '+iocVar.name+'_'+tmpVarCounter+' = '+iocVar.value+';\n';
                        outsgTmpVarMap[outsgIndex][con.outVarName]=iocVar.name+'_'+tmpVarCounter;
                        tmpVarCounter++;
                    }
                    
                    var iocVarName=con.iocVarName;
                    outIocVarTmpVarMap[iocVarName]=outsgTmpVarMap[outsgIndex][con.outVarName];
                }    
            }
    
            // sub graph function calls     
            for (var i=0; i<sgList.length; i++) 
            {
                var sgIndex=sgList[i];
    
                generatedGlsl+=this.subGraphs[sgIndex]._generateSubGraphCall(insgTmpVarMap[sgIndex], outsgTmpVarMap[sgIndex]);
    
                var splicedcount=0;
                //run through all nodes that connect to this node's outputs and splice in if all dependent nodes are before it on the list
                for (var n=0; n<outsgConnectedsgMap[sgIndex].length; n++) 
                {
                    var consgIndex=outsgConnectedsgMap[sgIndex][n];
                    if (sgFlag[consgIndex]===0)
                    {
                        var depflag=1;
                        //for (var j=0; j<insgConnectedsgMap[consgIndex].length; j++)
                        for (const depsgIndex in insgConnectedsgMap[consgIndex])
                        {
                            //var depsgIndex=insgConnectedsgMap[consgIndex][j]
                            if (!(sgFlag[depsgIndex]>0 && sgFlag[depsgIndex]<=(i+splicedcount)))
                            {
                                depflag=0;
                            }
                        }
                        if (depflag===1)
                        {
                            //sgList.push(consgIndex);
                            sgList.splice(i+splicedcount,0,consgIndex);
                            sgFlag[consgIndex]=i+splicedcount+1;
                            splicedcount++;
                        }
                    }
                }
            }
    
            //output assignment
            for (var i=0; i<this.iocVars.length;i++) 
            {
                var iocVar = this.iocVars[i];
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

shadergraph.textureSample2D = function (texture, uv) {
    var texSampleNode = new NodeMaterial('void texSample(in sampler2D tex, in vec2 uv, out vec4 rgba, out vec3 color, out float alpha) {\n vec4 samp=texture2D(tex, uv);\n rgba=samp;\n color=samp.rgb;\n alpha=samp.a;\n}');
//    texSampleNode.tex = new ShaderGraphNode('sampler2D', 'tex', texture);
//    texSampleNode.uv = uv;
    return texSampleNode;
};

Object.defineProperty(shadergraph, 'uv0', {
    get: function () {
        return new NodeMaterial('vec2 uv0() { return vUv0; }');
    }
});

shadergraph.customNode = function (f,d) {
    var customNode = new NodeMaterial(f,d);
    return customNode;
};

Object.defineProperty(shadergraph, 'worldPosPS', {
    get: function () {
        return new NodeMaterial('vec3 wpPS() { return vPosition; }');
    }
});

Object.defineProperty(shadergraph, 'worldNormPS', {
    get: function () {
        return new NodeMaterial('vec3 wnPS() { return vNormal; }');
    }
});

Object.defineProperty(shadergraph, 'worldPosVS', {
    get: function () {
        return new NodeMaterial('vec3 wpVS() { return getWorldPositionNM(); }');
    }
});

Object.defineProperty(shadergraph, 'worldNormVS', {
    get: function () {
        return new NodeMaterial('vec3 wnVS() { return getWorldNormalNM(); }');
    }
});

shadergraph.param = function (type, name, value) {
//    var paramNode = new NodeMaterial(type, name, value);
//    return paramNode;
};

shadergraph.root = function (color, alpha, vertOff) {
    var rootNode = new NodeMaterial('void root(in vec4 rgba, in vec3 color, in float alpha, in vec3 vertexOffset){}');
//    rootNode.color = color;
//    rootNode.alpha = alpha;
//    rootNode.vertexOffset = vertOff;
    return rootNode;
};

export { NodeMaterial, shadergraph };
