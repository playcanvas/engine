import { programlib } from '../../graphics/program-lib/program-lib.js';
import { Shader } from '../../graphics/shader.js';

import { Material } from './material.js';

import {
    SHADER_FORWARD
    // SHADER_DEPTH, SHADER_FORWARD, SHADER_FORWARDHDR, SHADER_PICK, SHADER_SHADOW
} from '../constants.js';

import { Texture } from '../../graphics/texture.js';
import { Vec2 } from '../../math/vec2.js';
import { Vec3 } from '../../math/vec3.js';
import { Vec4 } from '../../math/vec4.js';

/**
 * @class
 * @name NodeMaterial
 * @classdesc A Node material is for rendering geometry with material properties set by a material node graph
 * @param {string} funcGlsl - shader function used by this material
 * @param {string} declGlsl - shader declarations used by the shader function
 */
var NodeMaterial = function (funcGlsl, declGlsl) {
    Material.call(this);

    // storage for asset references
    this._graphVarAssetReferences = [];
    this._glslAssetReferences = {};
    this._subGraphAssetReferences = [];

    this.graphData = {};

    this.graphData.graphVars = []; // input, output or constant variables

    if (funcGlsl) {
        this.graphData.customFuncGlsl = funcGlsl;
        this.graphData.customDeclGlsl = declGlsl;
        this.genCustomFuncVars();
    } else {
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

        clone.graphData.graphVars = this.graphData.graphVars.slice(0);
        clone.graphData.subGraphs = this.graphData.subGraphs.slice(0);
        clone.graphData.connections = this.graphData.connections.slice(0);

        clone.graphData.customDeclGlsl = this.graphData.customDeclGlsl;
        clone.graphData.customFuncGlsl = this.graphData.customFuncGlsl;

        clone.shaderVariants = this.shaderVariants.slice(0);

        return clone;
    },

    updateUniforms: function () {
        this.clearParameters();

        for (var n = 0; n < this.graphData.graphVars.length; n++) {
            var graphVar = this.graphData.graphVars[n];

            if (graphVar.name.startsWith('IN_') || (graphVar.name.startsWith('CONST_') && graphVar.type === 'sampler2D')) {
                var matId = '_' + this.id;

                switch (graphVar.type) {
                    case 'sampler2D':
                        this.setParameter(graphVar.name + matId, graphVar.valueTex);
                        break;
                    case 'float':
                        this.setParameter(graphVar.name + matId, graphVar.valueX);
                        break;
                    case 'vec2':
                        this.setParameter(graphVar.name + matId, [graphVar.valueX, graphVar.valueY]);
                        break;
                    case 'vec3':
                        this.setParameter(graphVar.name + matId, [graphVar.valueX, graphVar.valueY, graphVar.valueZ]);
                        break;
                    case 'vec4':
                        this.setParameter(graphVar.name + matId, [graphVar.valueX, graphVar.valueY, graphVar.valueZ, graphVar.valueW]);
                        break;
                    case 'samplerCube':
                    default:
                        // error
                        break;
                }
            }
        }

        if (this.dirtyShader || !this._scene) {
            this.shader = null;
            this.clearVariants();
        }
    },

    updateShader: function (device, scene, objDefs, staticLightList, pass, sortedLights) {
        if (this.hasValidGraphData()) {
            this.initShader(device);
            this.dirtyShader = false;
        }

        if (this.shaderVariants[pass]) {
            this.shader = this.shaderVariants[pass];
        } else {
            this.shader = this._placeHolderShader;
        }
    },

    setPlaceHolderShader: function (placeHolderMat) {
        this._placeHolderShader = placeHolderMat.shaderVariants[SHADER_FORWARD];
    },

    hasValidGraphData: function (graphRootTime) {
        var i;
        if (this.graphData.graphVars && this.graphData.graphVars.length > 0 && (this.graphData.customFuncGlsl || ( this.graphData.subGraphs && this.graphData.subGraphs.length > 0 && this.graphData.connections))) {
            for (i = 0; i < this.graphData.graphVars.length; i++) {
                if (this.graphData.graphVars[i] && this.graphData.graphVars[i].name && this.graphData.graphVars[i].type) {
                    if (this.graphData.graphVars[i].type === 'sampler2D' && !this.graphData.graphVars[i].name.startsWith('OUT_') ) {
                        if (!(this.graphData.graphVars[i].valueTex && this.graphData.graphVars[i].valueTex instanceof Texture)) {
                            return false;
                        }
                    } else if (this.graphData.graphVars[i].type === 'float' && !this.graphData.graphVars[i].name.startsWith('OUT_') ) {
                        if (!(this.graphData.graphVars[i].valueX != undefined && typeof(this.graphData.graphVars[i].valueX) === 'number')) {
                            return false;
                        }
                    } else if (this.graphData.graphVars[i].type === 'vec2' && !this.graphData.graphVars[i].name.startsWith('OUT_') ) {
                        if (!(this.graphData.graphVars[i].valueX != undefined && typeof(this.graphData.graphVars[i].valueX) === 'number' &&
                              this.graphData.graphVars[i].valueY != undefined && typeof(this.graphData.graphVars[i].valueY) === 'number' )) {
                            return false;
                        }
                    } else if (this.graphData.graphVars[i].type === 'vec3' && !this.graphData.graphVars[i].name.startsWith('OUT_') ) {
                        if (!(this.graphData.graphVars[i].valueX != undefined && typeof(this.graphData.graphVars[i].valueX) === 'number' &&
                              this.graphData.graphVars[i].valueY != undefined && typeof(this.graphData.graphVars[i].valueY) === 'number' &&
                              this.graphData.graphVars[i].valueZ != undefined && typeof(this.graphData.graphVars[i].valueZ) === 'number' )) {
                            return false;
                        }
                    } else if (this.graphData.graphVars[i].type === 'vec4' && !this.graphData.graphVars[i].name.startsWith('OUT_') ) {
                        if (!(this.graphData.graphVars[i].valueX != undefined && typeof(this.graphData.graphVars[i].valueX) === 'number' &&
                              this.graphData.graphVars[i].valueY != undefined && typeof(this.graphData.graphVars[i].valueY) === 'number' &&
                              this.graphData.graphVars[i].valueZ != undefined && typeof(this.graphData.graphVars[i].valueZ) === 'number' &&
                              this.graphData.graphVars[i].valueW != undefined && typeof(this.graphData.graphVars[i].valueW) === 'number' )) {
                            return false;
                        }
                    }
                } else {
                    return false;
                }
            }

            if (this.graphData.customFuncGlsl) {
                if (typeof(this.graphData.customFuncGlsl) === 'number') {
                    return false;
                }
            } else {
                for (i = 0; i < this.graphData.connections.length; i++) {
                    if (this.graphData.connections[i]) {
                        if (!(this.graphData.connections[i].srcVarName && this.graphData.connections[i].dstVarName && (this.graphData.connections[i].srcIndex >= 0 || this.graphData.connections[i].dstIndex >= 0 ))) {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }

                // infinite recursion protection
                // if no graphRootTime set, set it to current time
                if (!graphRootTime) {
                    graphRootTime = new Date().getTime();
                    this._tmpRootTime = graphRootTime;
                }
                for (i = 0; i < this.graphData.subGraphs.length; i++) {
                    if (this.graphData.subGraphs[i] && this.graphData.subGraphs[i] instanceof NodeMaterial && this.graphData.subGraphs[i].name) {
                        if (this.graphData.subGraphs[i]._tmpRootTime === graphRootTime) {
                            // recursion detected!
                            return false;
                        }

                        this._tmpRootTime = graphRootTime;

                        if (!(this.graphData.subGraphs[i].hasValidGraphData(graphRootTime))) {
                            return false;
                        }

                    } else {
                        return false;
                    }
                }
            }
            return true;
        }
        return false;
    },

    // NB only called when shader graph is valid and shader is marked as dirty
    initShader: function (device) {
        // this is where we could get a list of pass types in current app render pipeline (layers)
        // and query shader graph to check if there is a special output
        // var passes=[SHADER_DEPTH, SHADER_FORWARD, SHADER_FORWARDHDR, SHADER_PICK, SHADER_SHADOW];
        var passes = [SHADER_FORWARD];

        for (var i = 0; i < passes.length; i++) {
            var useSkin = false;

            if (this.meshInstances && this.meshInstances[0] && this.meshInstances[0].skinInstance) {
                useSkin = true; // TODO make this a variant?
            }

            var options = {
                skin: useSkin,
                shaderGraph: this,
                pass: passes[i],
                maxPixelLights: (this.maxPixelLights) ? this.maxPixelLights : 4,
                maxVertexLights: (this.maxVertexLights) ? this.maxVertexLights : 8
            };

            // var depGraphTextureList=[];

            var shaderDefinition = programlib.node.createShaderDefinition(device, options);
            this.shaderVariants[passes[i]] = new Shader(device, shaderDefinition);
        }
    },

    _addGraphVar: function (type, name, value) {
        var graphVar;
        if (value instanceof Texture) {
            graphVar = { type: type, name: name, valueTex: value };
        } else if (value instanceof Vec4) {
            graphVar = { type: type, name: name, valueX: value.x, valueY: value.y, valueZ: value.z, valueW: value.w };
        } else if (value instanceof Vec3) {
            graphVar = { type: type, name: name, valueX: value.x, valueY: value.y, valueZ: value.z };
        } else if (value instanceof Vec2) {
            graphVar = { type: type, name: name, valueX: value.x, valueY: value.y };
        } else if (typeof(value) === 'number') {
            graphVar = { type: type, name: name, valueX: value };
        } else {
            graphVar = { type: type, name: name };
        }

        this.graphData.graphVars.push(graphVar);

        return graphVar;
    },

    addInput: function (type, name, value) {
        return this._addGraphVar(type, 'IN_' + name, value);
    },

    addOutput: function (type, name, value) {
        return this._addGraphVar(type, 'OUT_' + name, value);
    },

    addConstant: function (type, value) {
        return this._addGraphVar(type, 'CONST_' + type + '_' + this.graphData.graphVars.length, value); // create a unique name
    },

    genCustomFuncVars: function () {
        var functionString = this.graphData.customFuncGlsl.trim();

        var head = functionString.split(")")[0];
        var retTypeAndFuncName = head.split("(")[0];
        var retType = retTypeAndFuncName.split(" ")[0];
        var params = head.split("(")[1].split(",");

        this.name = retTypeAndFuncName.split(" ")[1];
        // TODO check for function name clashes - maybe replace func name in function string with hash key?

        if (retType != "void") {
            this.addOutput(retType, 'ret');
        }

        for (var p = 0; p < params.length; p++) {
            var inOrOutAndTypeAndName = params[p].split(" ");

            if (inOrOutAndTypeAndName[0] === "") inOrOutAndTypeAndName.shift();

            if (inOrOutAndTypeAndName[0] === "out") {
                this.addOutput(inOrOutAndTypeAndName[1], inOrOutAndTypeAndName[2]);
                // this.defineOuputGetter(this.outputName[this.outputName.length - 1], this.outputName.length - 1);
            }
            if (inOrOutAndTypeAndName[0] === "in") {
                this.addInput(inOrOutAndTypeAndName[1], inOrOutAndTypeAndName[2]);
                // this.defineInputSetter(this.inputName[this.inputName.length - 1], this.inputName.length - 1);
            } else {
                // unsupported parameter !!! TODO add support for more parameter types?
            }
        }
    },

    addSubGraph: function (graph) {
        var ret = this.graphData.subGraphs.length;
        this.graphData.subGraphs.push(graph);
        return ret;
    },

    connect: function (srcIndex, srcVarName, dstIndex, dstVarName) {
        var connection = { srcIndex: srcIndex, srcVarName: srcVarName, dstIndex: dstIndex, dstVarName: dstVarName };

        this.graphData.connections.push(connection);
    },

    _getGraphVarValueString: function (graphVar) {
        var ret;

        if (graphVar.type === 'float') {
            ret = 'float(' + graphVar.valueX + ')';
        } else if (graphVar.type === 'vec2') {
            ret = 'vec2(' + graphVar.valueX + ', ' + graphVar.valueY + ')';
        } else if (graphVar.type === 'vec3') {
            ret = 'vec3(' + graphVar.valueX + ', ' + graphVar.valueY + ', ' + graphVar.valueZ + ')';
        } else if (graphVar.type === 'vec4') {
            ret = 'vec4(' + graphVar.valueX + ', ' + graphVar.valueY + ', ' + graphVar.valueZ + ', ' + graphVar.valueW + ')';
        }

        return ret;
    },

    _generateSubGraphCall: function (inNames, outNames) {
        var i;
        var graphVar;
        var callString = '';

        for (i = 0; i < this.graphData.graphVars.length; i++) {
            graphVar = this.graphData.graphVars[i];
            if (graphVar.name.startsWith('OUT_ret')) {
                if (outNames[graphVar.name] != undefined) {
                    callString += outNames[graphVar.name] + ' = ';
                } else {
                    // I guess this is actually valid (return value not assigned to anything)
                }
            }
        }


        if (this.graphData.customFuncGlsl) {
            callString += this.name + '( ';
        } else {
            callString += this.name + '_' + this.id + '( ';
        }

        for (i = 0; i < this.graphData.graphVars.length; i++) {
            graphVar = this.graphData.graphVars[i];
            if (graphVar.name.startsWith('IN_')) {
                if (inNames && inNames[graphVar.name] != undefined) {
                    callString += inNames[graphVar.name] + ', ';
                } else {
                    // this is tricky - use varname and unique (temp) id
                    callString += graphVar.name + '_' + this.id + ', ';
                }
            }
        }

        for (i = 0; i < this.graphData.graphVars.length; i++) {
            graphVar = this.graphData.graphVars[i];
            if (graphVar.name.startsWith('OUT_') && !graphVar.name.startsWith('OUT_ret')) {
                if (outNames[graphVar.name] != undefined) {
                    callString += outNames[graphVar.name] + ', ';
                } else {
                    // this shouldn't be possible - all outputs from connected subgraphs will have a tmpVar declared.
                    // ERROR!!!!
                }
            }
        }

        if (callString.endsWith(', ')) callString = callString.slice(0, -2);

        callString += ' );\n';

        return callString;
    },

    // this is currently not used - but will be used by the shadergraph script interface
    // TODO: re-enable and optimize using transient name map
    // _getGraphVarByName: function (name) {
        // convienient but not fast - TODO: optimize?
        // return this.graphData.graphVars.filter(function (graphVar) {
        //    return graphVar.name === name;
        // })[0];
    // },

    _generateSubGraphFuncs: function (depGraphFuncs, depGraphVarList) {
        var i;
        if (this.graphData.subGraphs != undefined) {
            for (i = 0; i < this.graphData.subGraphs.length; i++) {
                var subGraph = this.graphData.subGraphs[i];

                var name = subGraph.name;
                if (!subGraph.graphData.customFuncGlsl) {
                    name += '_' + subGraph.id;
                }

                if (depGraphFuncs[name] === undefined) {
                    if (subGraph.graphData.graphVars) {
                        for (var v = 0; v < subGraph.graphData.graphVars.length; v++) {
                            var graphVar = subGraph.graphData.graphVars[v];
                            if (graphVar.name.startsWith('IN_') || (graphVar.name.startsWith('CONST_') && graphVar.type === 'sampler2D') ) {
                                var depGraphVar = 'uniform ' + graphVar.type + ' ' + graphVar.name + '_' + subGraph.id + ';\n';

                                depGraphVarList.push(depGraphVar);
                            }
                        }
                    }

                    depGraphFuncs[name] = subGraph._generateFuncGlsl();
                    subGraph._generateSubGraphFuncs(depGraphFuncs, depGraphVarList);
                }
            }
        }
    },

    generateRootDeclGlsl: function () {
        var i;
        var graphVar;
        var generatedGlsl = '';
        // run through inputs (and const sampler2Ds) to declare uniforms - (default) values are set elsewhere
        for (i = 0; i < this.graphData.graphVars.length; i++) {
            var matId = '_' + this.id;
            graphVar = this.graphData.graphVars[i];
            if (graphVar.name.startsWith('IN_') || (graphVar.name.startsWith('CONST_') && graphVar.type === 'sampler2D')) {
                generatedGlsl += 'uniform ' + graphVar.type + ' ' + graphVar.name + matId + ';\n';
            }
        }
        // run through constants values are set here (except for textures - which have to be uniforms)
        for (i = 0; i < this.graphData.graphVars.length; i++) {
            graphVar = this.graphData.graphVars[i];
            if (graphVar.name.startsWith('CONST_') && (graphVar.type != 'sampler2D' )) {
                generatedGlsl += graphVar.type + ' ' + graphVar.name + ' = ' + this._getGraphVarValueString(graphVar) + ';\n';
            }
        }

        // get all sub graph function definitions (including functions in sub graphs' sub graphs ...)
        // assumes names are unique - maybe should be id or key?
        var depGraphFuncs = {};
        var depGraphVarList = [];

        var depName = this.name;
        if (!this.graphData.customFuncGlsl) {
            depName += '_' + this.id;
        }
        depGraphFuncs[depName] = this._generateFuncGlsl(); // this should prevent infinite recursion?

        this._generateSubGraphFuncs(depGraphFuncs, depGraphVarList);

        // declare all dependancy textures
        for (i = 0; i < depGraphVarList.length; i++) {
            generatedGlsl += depGraphVarList[i];// .declString;
        }

        // add all the graph definitions
        var depGraphList = []; // reverse order
        for (var func in depGraphFuncs) {
            var funcString = '';

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
        }
        var tLen = depGraphList.length; // need this because pop() reduces array length!
        for (i = 0; i < tLen; i++) {
            generatedGlsl += depGraphList.pop();
        }

        return generatedGlsl;
    },

    generateRootCallGlsl: function () {
        var generatedGlsl = '';

        // generate input and output names for function call and run through outputs to declare variables
        var inNames = {};
        var outNames = {};

        for (var i = 0; i < this.graphData.graphVars.length; i++) {
            var matId = '_' + this.id;
            var graphVar = this.graphData.graphVars[i];
            if (graphVar.name.startsWith('IN_')) {
                inNames[graphVar.name] = graphVar.name + matId;
            }
            if (graphVar.name.startsWith('OUT_')) {
                generatedGlsl += graphVar.type + ' ' + graphVar.name + ';\n';
                outNames[graphVar.name] = graphVar.name;
            }
        }

        generatedGlsl += this._generateSubGraphCall(inNames, outNames);

        return generatedGlsl;
        // NB the pass (or layer) will decide which output is used and how
    },

    _generateFuncGlsl: function () {
        var i;
        var graphVar;
        var generatedGlsl;

        if (this.graphData.customFuncGlsl) {
            // custom and built-in
            generatedGlsl = this.graphData.customFuncGlsl.trim();
        } else if (this.graphData.subGraphs) {
            // graph
            // function head
            var retUsed = false;

            for (i = 0; i < this.graphData.graphVars.length; i++) {
                graphVar = this.graphData.graphVars[i];
                if (graphVar.name.startsWith('OUT_ret')) {
                    generatedGlsl = graphVar.type + ' ';
                    retUsed = true;
                }
            }

            if (retUsed === true) {
                generatedGlsl += this.name + '_' + this.id + '( ';
            } else {
                generatedGlsl = 'void ' + this.name + '_' + this.id + '( ';
            }

            for (i = 0; i < this.graphData.graphVars.length; i++) {
                graphVar = this.graphData.graphVars[i];
                if (graphVar.name.startsWith('IN_')) {
                    generatedGlsl += 'in ' + graphVar.type + ' ' + graphVar.name + ', ';
                }
            }

            for (i = 0; i < this.graphData.graphVars.length; i++) {
                graphVar = this.graphData.graphVars[i];
                if (graphVar.name.startsWith('OUT_')) {
                    if (!graphVar.name.startsWith('OUT_ret')) {
                        generatedGlsl += 'out ' + graphVar.type + ' ' + graphVar.name + ', ';
                    }
                }
            }

            if (generatedGlsl.endsWith(', ')) generatedGlsl = generatedGlsl.slice(0, -2);

            generatedGlsl += ' ) {\n';

            // temporary structures - with temp scope only in parsing function
            var tmpVarCounter = 0;
            var srcTmpVarMap = [];
            var dstTmpVarMap = [];
            var graphOutputVarTmpVarMap = {};

            var srcConnectedMap = [];
            var dstConnectedMap = [];

            // create temp vars and graph traversal data
            for (i = 0; i < this.graphData.connections.length; i++) {
                var con = this.graphData.connections[i];
                // if there is a src sub graph assign tmp var to all of it's outputs
                if (con.srcIndex >= 0) {
                    var srcSubGraph = this.graphData.subGraphs[con.srcIndex];
                    if (srcTmpVarMap[con.srcIndex] === undefined) {
                        srcTmpVarMap[con.srcIndex] = {};
                        for (var o = 0; o < srcSubGraph.graphData.graphVars.length; o++) {
                            var outputVar = srcSubGraph.graphData.graphVars[o];
                            if (outputVar.name.startsWith('OUT_')) {
                                generatedGlsl += outputVar.type + ' temp_' + outputVar.type + '_' + tmpVarCounter + ';\n';
                                srcTmpVarMap[con.srcIndex][outputVar.name] = 'temp_' + outputVar.type + '_' + tmpVarCounter;
                                tmpVarCounter++;
                            }
                        }
                    }
                }
                // if there is a dst sub graph hook up with src sub graph output or root graph var
                if (con.dstIndex >= 0) {
                    if (con.srcIndex >= 0) {
                        // src sub graph output
                        if (srcConnectedMap[con.srcIndex] === undefined) srcConnectedMap[con.srcIndex] = [];
                        srcConnectedMap[con.srcIndex].push(con.dstIndex);

                        if (dstConnectedMap[con.dstIndex] === undefined) dstConnectedMap[con.dstIndex] = [];
                        dstConnectedMap[con.dstIndex].push(con.srcIndex);

                        if (dstTmpVarMap[con.dstIndex] === undefined) dstTmpVarMap[con.dstIndex] = {};
                        dstTmpVarMap[con.dstIndex][con.dstVarName] = srcTmpVarMap[con.srcIndex][con.srcVarName];
                    } else {
                        // root graph input/const var
                        if (dstTmpVarMap[con.dstIndex] === undefined) dstTmpVarMap[con.dstIndex] = {};
                        dstTmpVarMap[con.dstIndex][con.dstVarName] = con.srcVarName;
                    }
                } else {
                    if (con.srcIndex >= 0) {
                        // root graph output var
                        graphOutputVarTmpVarMap[con.dstVarName] = srcTmpVarMap[con.srcIndex][con.srcVarName];
                    } else {
                        // this is a direct conection between an input port and an output io port - this happens on all input port editor previews
                        graphOutputVarTmpVarMap[con.dstVarName] = con.srcVarName;
                    }
                }
            }

            // sort sub graphs for correct ordering
            var subGraphOnListFlags = [];
            var subGraphList = [];

            // it should not be possible for the the number of iterations to exceeds the number of connections - unless there is a cyclic dependency
            var whileLoopCount = 0;

            while (subGraphList.length < this.graphData.subGraphs.length || whileLoopCount < this.graphData.connections.length) {
                whileLoopCount++;

                for (i = 0; i < this.graphData.subGraphs.length; i++) {
                    if (subGraphOnListFlags[i] != true) {
                        var allInputsOnList = true;
                        if (dstConnectedMap[i] != undefined) {
                            for (var n = 0; n < dstConnectedMap[i].length; n++) {
                                var connectedSrcIndex = dstConnectedMap[i][n];
                                if (subGraphOnListFlags[connectedSrcIndex] != true) {
                                    allInputsOnList = false;
                                    break;
                                }
                            }
                        }
                        if (allInputsOnList === true) {
                            subGraphList.push(i);
                            subGraphOnListFlags[i] = true;
                        }
                    }
                }
            }

            // sub graph function calls
            for (i = 0; i < subGraphList.length; i++) {
                var subGraphIndex = subGraphList[i];

                // skip if no outputs
                if (srcTmpVarMap[subGraphIndex] != undefined) {
                    var func = this.graphData.subGraphs[subGraphIndex].name;

                    if ( func.endsWith('PS') ) {
                        generatedGlsl += '#ifdef SG_PS\n';
                    } else if ( func.endsWith('VS') ) {
                        generatedGlsl += '#ifdef SG_VS\n';
                    }

                    generatedGlsl += this.graphData.subGraphs[subGraphIndex]._generateSubGraphCall(dstTmpVarMap[subGraphIndex], srcTmpVarMap[subGraphIndex]);

                    if ( func.endsWith('PS')  ) {
                        generatedGlsl += '#endif //SG_PS\n';
                    } else if ( func.endsWith('VS') ) {
                        generatedGlsl += '#endif //SG_VS\n';
                    }
                }
            }

            // output assignment
            for (i = 0; i < this.graphData.graphVars.length; i++) {
                graphVar = this.graphData.graphVars[i];
                if (graphVar.name.startsWith('OUT_') && !graphVar.name.startsWith('OUT_ret')) {
                    generatedGlsl += graphVar.name + ' = ' + graphOutputVarTmpVarMap[graphVar.name] + ';\n';
                }
            }

            generatedGlsl += '}\n';
        }

        return generatedGlsl;
    }

});

var shadergraph = {};

shadergraph.graphCounter = 0;

shadergraph.nodeRegistry = {};

shadergraph._getNode = function (name, funcString, declString) {
    if (!this.nodeRegistry[name]) {
        this.nodeRegistry[name] = new NodeMaterial(funcString, declString);
    }

    return this.nodeRegistry[name];
};

shadergraph._addCoreFunction = function (coreName, coreNode) {

    this[coreName] = function (...args) {
        var sgIndex = this.graph.addSubGraph(this._getNode(coreName));

        var sgInputs = coreNode.graphData.graphVars.filter(function (graphVar) {
            return graphVar.name.startsWith('IN_');
        });

        if (sgInputs.length === args.length) {
            args.forEach((arg, argIndex) => {
                if (typeof(arg) === 'number') {
                    // ret port of a node
                    var argNodeIndex = arg;
                    this.graph.connect(argNodeIndex, 'OUT_ret', sgIndex, sgInputs[argIndex].name);
                } else if (arg.type) {
                    // graphVar (ioPort)
                    this.graph.connect(-1, arg.name, sgIndex, sgInputs[argIndex].name);
                } else {
                    // specific port of a node
                    this.graph.connect(arg.node, arg.port, sgIndex, sgInputs[argIndex].name);
                }
            });
        } else {
            console.log("arguments do not match core node function");
        }
        return sgIndex;
    };

};

shadergraph.start = function (coreNodesJSON) {
    const coreNodeList = JSON.parse(coreNodesJSON);

    Object.keys(coreNodeList).forEach((key) => {
        var coreNode = this._getNode(key, coreNodeList[key].code);

        this._addCoreFunction(key, coreNode);
    });

    // check current graph is null?
    shadergraph.graph = this._getNode('graphRoot_' + shadergraph.graphCounter);
    shadergraph.graph.name = 'graphRoot_' + shadergraph.graphCounter;
};

shadergraph.end = function () {
    var ret = shadergraph.graph;
    shadergraph.graph = null;
    shadergraph.graphCounter++;
    return ret;
};

shadergraph.textureSample2D = function (name, texture, uv) {

    var texSampNode = this.graph.addSubGraph(this._getNode('texSample', 'vec4 texSample(in sampler2D tex, in vec2 uv, out vec3 color, out float alpha) {\n vec4 samp=texture2D(tex, uv);\n color=samp.rgb;\n alpha=samp.a;\n return samp;\n}'));

    // assumes name is unique TODO: verify?
    var graphVar = this.graph.addInput('sampler2D', name, texture);
    this.graph.connect(-1, graphVar.name, texSampNode, 'IN_tex');
    this.graph.connect(uv, 'OUT_ret', texSampNode, 'IN_uv');

    return texSampNode;
};

shadergraph.customNode = function (name, f, d) {
    var nodeIndex = this.graph.addSubGraph(this._getNode(name, f, d));
    return nodeIndex;
};

Object.defineProperty(shadergraph, 'uv0', {
    get: function () {
        var nodeIndex = this.graph.addSubGraph(this._getNode('uv0', 'vec2 uv0() { return vUv0; }'));
        return nodeIndex;
    }
});

Object.defineProperty(shadergraph, 'worldPosPS', {
    get: function () {
        var nodeIndex = this.graph.addSubGraph(this._getNode('worldPosPS', 'vec3 wpPS() { return vPosition; }'));
        return nodeIndex;
    }
});

Object.defineProperty(shadergraph, 'worldNormPS', {
    get: function () {
        var nodeIndex = this.graph.addSubGraph(this._getNode('worldNormPS', 'vec3 wnPS() { return vNormal; }'));
        return nodeIndex;
    }
});

Object.defineProperty(shadergraph, 'worldPosVS', {
    get: function () {
        var nodeIndex = this.graph.addSubGraph(this._getNode('worldPosVS', 'vec3 wpVS() { return getWorldPositionNM(); }'));
        return nodeIndex;
    }
});

Object.defineProperty(shadergraph, 'worldNormVS', {
    get: function () {
        var nodeIndex = this.graph.addSubGraph(this._getNode('worldNormVS', 'vec3 wnVS() { return getWorldNormalNM(); }'));
        return nodeIndex;
    }
});

shadergraph.param = function (type, name, value) {
    // assumes name is unique TODO: verify this
    var graphVar = this.graph.addInput(type, name, value);
    return graphVar;
};

shadergraph.connectFragOut = function (arg) {
    // assumes this is only called once per graph TODO: verify this
    var graphVar = this.graph.addOutput('vec4', 'fragOut', new Vec4(0, 0, 0, 1));

    if (typeof(arg) === 'number') {
        // ret port of a node
        var argNodeIndex = arg;
        this.graph.connect(argNodeIndex, 'OUT_ret', -1, graphVar.name);
    } else if (arg.type) {
        // graphVar (ioPort)
        this.graph.connect(-1, arg.name, -1, graphVar.name);
    } else {
        // specific port of a node
        this.graph.connect(arg.node, arg.port, -1, graphVar.name);
    }

    //this.graph.connect(nodeIndex, (name) ? 'OUT_' + name : 'OUT_ret', -1, graphVar.name);
};

shadergraph.connectVertexOffset = function (arg) {
    // assumes this is only called once per graph TODO: verify this
    var graphVar = this.graph.addOutput('vec3', 'vertOff', new Vec3(0, 0, 0));

    if (typeof(arg) === 'number') {
        // ret port of a node
        var argNodeIndex = arg;
        this.graph.connect(argNodeIndex, 'OUT_ret', -1, graphVar.name);
    } else if (arg.type) {
        // graphVar (ioPort)
        this.graph.connect(-1, arg.name, -1, graphVar.name);
    } else {
        // specific port of a node
        this.graph.connect(arg.node, arg.port, -1, graphVar.name);
    }
//    this.graph.connect(nodeIndex, (name) ? 'OUT_' + name : 'OUT_ret', -1, graphVar.name);
};

shadergraph.connectCustom = function (destNodeIndex, destName, nodeIndex_or_param, name) {
    if (typeof(nodeIndex_or_param) === 'number') {
        var nodeIndex = nodeIndex_or_param;
        this.graph.connect(nodeIndex, (name) ? 'OUT_' + name : 'OUT_ret', destNodeIndex, 'IN_' + destName);
    } else {
        var graphVar = nodeIndex_or_param;
        this.graph.connect(-1, graphVar.name, destNodeIndex, 'IN_' + destName);
    }
};

export { NodeMaterial, shadergraph };
