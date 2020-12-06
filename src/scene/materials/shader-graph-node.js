import { Texture } from '../../graphics/texture.js';
import { Vec2 } from '../../math/vec2.js';
import { Vec3 } from '../../math/vec3.js';
import { Vec4 } from '../../math/vec4.js';

export var PORT_TYPE_IN = 1;
export var PORT_TYPE_OUT = 2;
export var PORT_TYPE_CONST = 3;
export var PORT_TYPE_RET = 4;

var Port = function ( type, name, value, ptype) {
    this.type = type;
    this.name = name;

    if (value) {
        if (value instanceof Texture) {
            this.valueTex = value;
        } else if (value instanceof Vec4) {
            this.valueX = value.x;
            this.valueY = value.y;
            this.valueZ = value.z;
            this.valueW = value.w;
        } else if (value instanceof Vec3) {
            this.valueX = value.x;
            this.valueY = value.y;
            this.valueZ = value.z;
        } else if (value instanceof Vec2) {
            this.valueX = value.x;
            this.valueY = value.y;
        } else if (typeof(value) === 'number') {
            this.valueX = value.x;
        }
    }

    this.ptype = ptype;
};
Port.prototype.constructor = Port;

var Connection = function (srcIndex, srcName, dstIndex, dstName, swizzle) {
    this.srcIndex = srcIndex;
    this.srcName = srcName;
    this.dstIndex = dstIndex;
    this.dstName = dstName;
    this.swizzle = swizzle;
};
Connection.prototype.constructor = Connection;

var id = 0;
var counter = 0;

/**
 * @private
 * @class
 * @name ShaderGraphNode
 * @classdesc A Shader Graph Node class used by shader graphs
 * @param {string} funcCodeString - shader function used by this node
 * @param {string} declCodeString - shader declarations used by the shader function
 */
var ShaderGraphNode = function (funcCodeString, declCodeString) {
    this.name = "Untitled";
    this.id = id++;

    // storage for asset references
    this._ioPortAssetReferences = [];
    this._codeStringAssetReferences = {};
    this._subGraphAssetReferences = [];

    // port map and cache (optimization)
    this._portMap = {};
    this._portCache = {};

    // static switches
    this._switchMap = {};
    this._switchId2Name = {};

    // graph
    this.graphData = {};

    this.graphData.ioPorts = []; // input, output or constant variables

    if (funcCodeString) {
        this.graphData.funcCodeString = funcCodeString;
        this.graphData.declCodeString = declCodeString;
        this.genFuncCodeIoPorts();
    } else {
        this.graphData.subGraphs = [];
        this.graphData.connections = [];
    }
};

ShaderGraphNode.prototype.constructor = ShaderGraphNode;

Object.assign(ShaderGraphNode.prototype, {

    clone: function () {
        var clone = new ShaderGraphNode();

        clone.graphData = {};

        clone.graphData.ioPorts = this.graphData.ioPorts.slice(0);
        clone.graphData.subGraphs = this.graphData.subGraphs.slice(0);
        clone.graphData.connections = this.graphData.connections.slice(0);

        clone.graphData.declCodeString = this.graphData.declCodeString;
        clone.graphData.funcCodeString = this.graphData.funcCodeString;

        return clone;
    },

    _flushCachedPorts: function () {
        this._portCache = {};
    },

    _getCachedPort: function (i) {
        var ioPort = this.graphData.ioPorts[i];
        if (!this._portCache[ioPort.name]) this._portCache[ioPort.name] = { isUniform: (ioPort.ptype === PORT_TYPE_IN || (ioPort.ptype === PORT_TYPE_CONST && ioPort.type === 'sampler2D')), nameId: ioPort.name + '_' + this.id, port: ioPort, index: i };
        return this._portCache[ioPort.name];
    },

    updateUniforms: function (mat) {
        for (var n = 0; n < this.graphData.ioPorts.length; n++) {
            var ioPort = this.graphData.ioPorts[n];
            var ioPortCached = this._getCachedPort(n); // use port cache

            if (ioPortCached.isUniform) {
                switch (ioPort.type) {
                    case 'sampler2D':
                        mat.setParameter(ioPortCached.nameId, ioPort.valueTex);
                        break;
                    case 'float':
                        mat.setParameter(ioPortCached.nameId, ioPort.valueX);
                        break;
                    case 'vec2':
                        mat.setParameter(ioPortCached.nameId, [ioPort.valueX, ioPort.valueY]);
                        break;
                    case 'vec3':
                        mat.setParameter(ioPortCached.nameId, [ioPort.valueX, ioPort.valueY, ioPort.valueZ]);
                        break;
                    case 'vec4':
                        mat.setParameter(ioPortCached.nameId, [ioPort.valueX, ioPort.valueY, ioPort.valueZ, ioPort.valueW]);
                        break;
                    case 'samplerCube':
                    default:
                        // error
                        break;
                }
            }
        }
    },

    hasValidGraphData: function (graphRootCounter) {
        var i;
        if (this.graphData.ioPorts && this.graphData.ioPorts.length > 0 && (this.graphData.funcCodeString || ( this.graphData.subGraphs && this.graphData.subGraphs.length > 0 && this.graphData.connections))) {
            // check ioPorts
            for (i = 0; i < this.graphData.ioPorts.length; i++) {
                var ioPort = this.graphData.ioPorts[i];
                if (ioPort && ioPort.name && ioPort.type) {
                    // input and constant ports must have a valid value
                    if (ioPort.ptype === PORT_TYPE_IN || ioPort.ptype === PORT_TYPE_CONST) {
                        if (ioPort.type === 'sampler2D' ) {
                            if (!(ioPort.valueTex && ioPort.valueTex instanceof Texture)) {
                                return false;
                            }
                        } else if (ioPort.type === 'float' ) {
                            if (!(ioPort.valueX !== undefined && typeof(ioPort.valueX) === 'number')) {
                                return false;
                            }
                        } else if (ioPort.type === 'vec2' ) {
                            if (!(ioPort.valueX !== undefined && typeof(ioPort.valueX) === 'number' &&
                                ioPort.valueY !== undefined && typeof(ioPort.valueY) === 'number' )) {
                                return false;
                            }
                        } else if (ioPort.type === 'vec3' ) {
                            if (!(ioPort.valueX !== undefined && typeof(ioPort.valueX) === 'number' &&
                                ioPort.valueY !== undefined && typeof(ioPort.valueY) === 'number' &&
                                ioPort.valueZ !== undefined && typeof(ioPort.valueZ) === 'number' )) {
                                return false;
                            }
                        } else if (ioPort.type === 'vec4') {
                            if (!(ioPort.valueX !== undefined && typeof(ioPort.valueX) === 'number' &&
                                ioPort.valueY !== undefined && typeof(ioPort.valueY) === 'number' &&
                                ioPort.valueZ !== undefined && typeof(ioPort.valueZ) === 'number' &&
                                ioPort.valueW !== undefined && typeof(ioPort.valueW) === 'number' )) {
                                return false;
                            }
                        }
                    }
                } else {
                    return false;
                }
            }

            // check function code string or graph
            if (this.graphData.funcCodeString) {
                if (typeof(this.graphData.funcCodeString) === 'number') {
                    return false;
                }
            } else {
                // check graph connections
                for (i = 0; i < this.graphData.connections.length; i++) {
                    if (this.graphData.connections[i]) {
                        if (!(this.graphData.connections[i].srcIndex && this.graphData.connections[i].srcName && this.graphData.connections[i].dstIndex && this.graphData.connections[i].dstName)) {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }

                // check sub graphs recursively and check for infinite recursion
                if (!graphRootCounter) {
                    // if no graphRootCounter set, set it to counter, and increment counter
                    graphRootCounter = counter++;
                    this._tmpRootCounter = graphRootCounter;
                }
                for (i = 0; i < this.graphData.subGraphs.length; i++) {
                    if (this.graphData.subGraphs[i] && this.graphData.subGraphs[i] instanceof ShaderGraphNode && this.graphData.subGraphs[i].name) {
                        if (this.graphData.subGraphs[i]._tmpRootCounter === graphRootCounter) {
                            // recursion detected!
                            return false;
                        }

                        this._tmpRootCounter = graphRootCounter;

                        if (!(this.graphData.subGraphs[i].hasValidGraphData(graphRootCounter))) {
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

    _addIoPort: function (type, name, value, ptype) {
        var ioPort = new Port(type, name, value, ptype);

        this._portMap[name] = this.graphData.ioPorts.length;
        this.graphData.ioPorts.push(ioPort);

        return ioPort;
    },

    addInput: function (type, name, value) {
        return this._addIoPort(type, name, value, PORT_TYPE_IN);
    },

    addOutput: function (type, name, value) {
        return this._addIoPort(type, name, value, (name === 'ret') ? PORT_TYPE_RET : PORT_TYPE_OUT);
    },

    addConstant: function (type, userId, value) {
        var name = 'const_' + type + '_' + (userId ? userId : this.graphData.ioPorts.length);
        return this._addIoPort(type, name, value, PORT_TYPE_CONST);
    },

    // generates ioPorts from function code string
    genFuncCodeIoPorts: function () {
        var functionString = this.graphData.funcCodeString.trim();

        var head = functionString.split(")")[0];
        var retTypeAndFuncName = head.split("(")[0];
        var retType = retTypeAndFuncName.split(" ")[0];
        var params = head.split("(")[1].split(",");

        this.name = retTypeAndFuncName.split(" ")[1];

        if (retType !== "void") {
            this.addOutput(retType, 'ret');
        }

        for (var p = 0; p < params.length; p++) {
            if (params[p]) {
                var inOrOutAndTypeAndName = params[p].split(" ");

                if (inOrOutAndTypeAndName[0] === "") inOrOutAndTypeAndName.shift();

                if (inOrOutAndTypeAndName[0] === "out") {
                    this.addOutput(inOrOutAndTypeAndName[1], inOrOutAndTypeAndName[2]);
                } else if (inOrOutAndTypeAndName[0] === "in") {
                    this.addInput(inOrOutAndTypeAndName[1], inOrOutAndTypeAndName[2]);
                } else {
                    console.warn('unsupported parameter please check code is correct format');
                }
            }
        }
    },

    addSubGraph: function (graph) {
        var ret = this.graphData.subGraphs.length;
        this.graphData.subGraphs.push(graph);
        return ret;
    },

    connect: function (srcIndex, srcName, dstIndex, dstName, swizzle) {
        var connection = new Connection(srcIndex, srcName, dstIndex, dstName, swizzle);
        this.graphData.connections.push(connection);
    },

    _getIoPortValueString: function (ioPort) {
        var ret;
        if (ioPort.type === 'float') {
            ret = 'float(' + ioPort.valueX + ')';
        } else if (ioPort.type === 'vec2') {
            ret = 'vec2(' + ioPort.valueX + ', ' + ioPort.valueY + ')';
        } else if (ioPort.type === 'vec3') {
            ret = 'vec3(' + ioPort.valueX + ', ' + ioPort.valueY + ', ' + ioPort.valueZ + ')';
        } else if (ioPort.type === 'vec4') {
            ret = 'vec4(' + ioPort.valueX + ', ' + ioPort.valueY + ', ' + ioPort.valueZ + ', ' + ioPort.valueW + ')';
        }
        return ret;
    },

    _generateStaticSwitch: function (switchValue, inNames, outNames) {
        // useful LUTs - consider making these global somewhere?
        var type2Comp = { float: 1, vec2: 2, vec3: 3, vec4: 4 };
        var comp2Type = ['', 'float', 'vec2', 'vec3', 'vec4'];

        var callString = '';

        // assign selected input tmp var directly to ret tmp var
        var retPort = this.graphData.ioPorts[0];
        callString += outNames[retPort.name] + ' = ' + retPort.type + '(';

        // NB case ports start at port index 2
        var argPort = this.graphData.ioPorts[switchValue + 2];
        callString += inNames[argPort.name];

        // deal with casting - flexOp style
        var argComp = type2Comp[argPort.type];
        var expand = type2Comp[retPort.type] - argComp;
        callString += (expand > 0 && argComp !== 1) ? ', ' + comp2Type[expand] + '(0));' : ');';

        callString += ' // ' + this._generateSubGraphCall(inNames, outNames);

        return callString;
    },

    _generateSubGraphCall: function (inNames, outNames) {
        var i;
        var ioPort;
        var callString = '';

        // deal with return value
        for (i = 0; i < this.graphData.ioPorts.length; i++) {
            ioPort = this.graphData.ioPorts[i];
            if (ioPort.ptype === PORT_TYPE_RET) {
                if (outNames[ioPort.name] !== undefined) {
                    callString += outNames[ioPort.name] + ' = ';
                } else {
                    // I guess this is actually valid (return value not assigned to anything)
                }
            }
        }

        if (this.graphData.funcCodeString) {
            callString += this.name + '( ';
        } else {
            callString += this.name + '_' + this.id + '( ';
        }

        // input params
        for (i = 0; i < this.graphData.ioPorts.length; i++) {
            ioPort = this.graphData.ioPorts[i];
            if (ioPort.ptype === PORT_TYPE_IN) {
                if (inNames && inNames[ioPort.name] !== undefined) {
                    callString += inNames[ioPort.name] + ', ';
                } else {
                    var ioPortCached = this._getCachedPort(i); // use port cache
                    callString += ioPortCached.nameId + ', ';
                }
            }
        }

        // output params
        for (i = 0; i < this.graphData.ioPorts.length; i++) {
            ioPort = this.graphData.ioPorts[i];
            if (ioPort.ptype === PORT_TYPE_OUT && ioPort.ptype !== PORT_TYPE_RET) {
                if (outNames[ioPort.name] !== undefined) {
                    callString += outNames[ioPort.name] + ', ';
                } else {
                    // this shouldn't be possible - because all outputs from connected subgraphs will have a tmpVar declared.
                }
            }
        }

        if (callString.endsWith(', ')) callString = callString.slice(0, -2);

        callString += ' );\n';

        return callString;
    },

    addStaticSwitch: function (name, id, maxValue, value) {
        if (this._switchMap[name]) {
            console.error('switch ' + name + ' already added!');
        } else {
            this._switchMap[name] = { id: id, maxValue: maxValue, value: value };
            this._switchId2Name[id] = name;
        }
    },

    getSwitchValue: function (name) {
        if (this._switchMap[name]) {
            return this._switchMap[name].value;
        }
    },

    setSwitchValue: function (name, value) {
        if (this._switchMap[name]) {
            if (value >= 0 && value <= this._switchMap[name].maxValue) {
                this._switchMap[name].value = value;
            }
        }
    },

    getSwitchKey: function () {
        var switchKeys = Object.keys(this._switchMap);

        var key = this.id;

        for (var k = 0; k < switchKeys.length; k++) {
            key += this._switchMap[switchKeys[k]].id;
            key += this._switchMap[switchKeys[k]].value;
        }

        return key;
    },

    getIoPortByName: function (name) {
        return (this._portMap[name] === undefined) ? undefined : this.graphData.ioPorts[this._portMap[name]];
    },

    getIoPortUniformName: function (name) {
        return (this._portMap[name] === undefined) ? undefined : this._getCachedPort(this._portMap[name]).nameId;
    },

    _generateSubGraphFuncs: function (depGraphFuncs, depIoPortList) {
        var i;
        if (this.graphData.subGraphs !== undefined) {
            for (i = 0; i < this.graphData.subGraphs.length; i++) {
                var subGraph = this.graphData.subGraphs[i];

                var key = subGraph.id + '_' + subGraph.name;

                if (depGraphFuncs[key] === undefined) {
                    if (subGraph.graphData.ioPorts) {
                        for (var v = 0; v < subGraph.graphData.ioPorts.length; v++) {
                            var ioPort = subGraph.graphData.ioPorts[v];
                            var ioPortCached = subGraph._getCachedPort(v); // use port cache
                            if (ioPortCached.isUniform) {
                                var depIoPort = 'uniform ' + ioPort.type + ' ' + ioPortCached.nameId + ';\n';
                                depIoPortList.push(depIoPort);
                            }
                        }
                    }

                    depGraphFuncs[key] = subGraph._generateFuncCodeString();
                    subGraph._generateSubGraphFuncs(depGraphFuncs, depIoPortList);
                }
            }
        }
    },

    generateRootDeclCodeString: function () {
        var i;
        var ioPort;
        var ioPortCached;
        var generatedCodeString = '';

        // run through inputs (and const sampler2Ds) to declare uniforms - (default) values are set elsewhere
        for (i = 0; i < this.graphData.ioPorts.length; i++) {
            ioPort = this.graphData.ioPorts[i];
            ioPortCached = this._getCachedPort(i); // use port cache

            if (ioPortCached.isUniform) {
                generatedCodeString += 'uniform ' + ioPort.type + ' ' + ioPortCached.nameId + ';\n';
            }
        }

        // get all sub graph function definitions (including functions in sub graphs' sub graphs ...)
        // assumes names are unique - maybe should be id or key?
        var depGraphFuncs = {};
        var depIoPortList = [];

        var depKey = this.id + '_' + this.name;
        depGraphFuncs[depKey] = this._generateFuncCodeString(); // this should prevent infinite recursion?

        this._generateSubGraphFuncs(depGraphFuncs, depIoPortList);

        // declare all dependancy textures
        for (i = 0; i < depIoPortList.length; i++) {
            generatedCodeString += depIoPortList[i];// .declString;
        }

        // add all the graph definitions
        var depGraphList = []; // reverse order
        for (var funcKey in depGraphFuncs) {
            var funcString = '';

            if ( funcKey.endsWith('PS') ) {
                funcString += '#ifdef SHADERGRAPH_PS\n';
            } else if ( funcKey.endsWith('VS') ) {
                funcString += '#ifdef SHADERGRAPH_VS\n';
            }

            funcString += depGraphFuncs[funcKey] + '\n';

            if ( funcKey.endsWith('PS') ) {
                funcString += '#endif //SHADERGRAPH_PS\n';
            } else if ( funcKey.endsWith('VS') ) {
                funcString += '#endif //SHADERGRAPH_VS\n';
            }

            depGraphList.push(funcString);
        }

        while (depGraphList.length) {
            generatedCodeString += depGraphList.pop();
        }

        return generatedCodeString;
    },

    generateRootCallCodeString: function () {
        var generatedCodeString = '';

        // generate input and output names for function call and run through outputs to declare variables
        var inNames = {};
        var outNames = {};

        for (var i = 0; i < this.graphData.ioPorts.length; i++) {
            var ioPort = this.graphData.ioPorts[i];
            var ioPortCached = this._getCachedPort(i); // use port cache
            if (ioPort.ptype === PORT_TYPE_IN) {
                inNames[ioPort.name] = ioPortCached.nameId;
            }
            if (ioPort.ptype === PORT_TYPE_OUT || ioPort.ptype === PORT_TYPE_RET ) {
                generatedCodeString += ioPort.type + ' ' + ioPort.name + ';\n';
                outNames[ioPort.name] = ioPort.name;
            }
        }

        generatedCodeString += this._generateSubGraphCall(inNames, outNames);

        return generatedCodeString;
    },

    _generateFuncCodeString: function () {
        var i;
        var ioPort;
        var generatedCodeString;

        if (this.graphData.funcCodeString) {
            generatedCodeString = this.graphData.funcCodeString.trim();
        } else if (this.graphData.subGraphs) {
            // function head
            // deal with return value
            var retUsed = false;
            for (i = 0; i < this.graphData.ioPorts.length; i++) {
                ioPort = this.graphData.ioPorts[i];
                if (ioPort.ptype === PORT_TYPE_RET) {
                    generatedCodeString = ioPort.type + ' ';
                    retUsed = true;
                }
            }
            if (retUsed === true) {
                generatedCodeString += this.name + '_' + this.id + '( ';
            } else {
                generatedCodeString = 'void ' + this.name + '_' + this.id + '( ';
            }

            // input params
            for (i = 0; i < this.graphData.ioPorts.length; i++) {
                ioPort = this.graphData.ioPorts[i];
                if (ioPort.ptype === PORT_TYPE_IN) {
                    generatedCodeString += 'in ' + ioPort.type + ' ' + ioPort.name + ', ';
                }
            }

            // output params
            for (i = 0; i < this.graphData.ioPorts.length; i++) {
                ioPort = this.graphData.ioPorts[i];
                if (ioPort.ptype === PORT_TYPE_OUT && ioPort.ptype !== PORT_TYPE_RET) {
                    generatedCodeString += 'out ' + ioPort.type + ' ' + ioPort.name + ', ';
                }
            }

            if (generatedCodeString.endsWith(', ')) generatedCodeString = generatedCodeString.slice(0, -2);

            generatedCodeString += ' ) {\n';

            // input constants (not including samplers)
            for (i = 0; i < this.graphData.ioPorts.length; i++) {
                ioPort = this.graphData.ioPorts[i];
                if (ioPort.ptype === PORT_TYPE_CONST && (ioPort.type !== 'sampler2D' )) {
                    generatedCodeString += ioPort.type + ' ' + ioPort.name + ' = ' + this._getIoPortValueString(ioPort) + ';\n';
                }
            }

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
                        for (var o = 0; o < srcSubGraph.graphData.ioPorts.length; o++) {
                            var outputVar = srcSubGraph.graphData.ioPorts[o];
                            if (outputVar.ptype === PORT_TYPE_OUT || outputVar.ptype === PORT_TYPE_RET) {
                                generatedCodeString += outputVar.type + ' temp_' + outputVar.type + '_' + tmpVarCounter + ';\n';
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
                        dstTmpVarMap[con.dstIndex][con.dstName] = srcTmpVarMap[con.srcIndex][con.srcName] + ((con.swizzle) ? '.' + con.swizzle : '');
                    } else {
                        // root graph input/const var
                        if (dstTmpVarMap[con.dstIndex] === undefined) dstTmpVarMap[con.dstIndex] = {};
                        dstTmpVarMap[con.dstIndex][con.dstName] = con.srcName + ((con.swizzle) ? '.' + con.swizzle : '');
                    }
                } else {
                    if (con.srcIndex >= 0) {
                        // root graph output var
                        graphOutputVarTmpVarMap[con.dstName] = srcTmpVarMap[con.srcIndex][con.srcName];
                    } else {
                        // this is a direct conection between an input port and an output io port - this happens on all input port editor previews
                        graphOutputVarTmpVarMap[con.dstName] = con.srcName;
                    }
                }
            }

            // sort sub graphs for correct ordering
            var subGraphOnListFlags = [];
            var subGraphList = [];

            // it should not be possible for the the number of iterations to exceeds the number of connections - unless there is a cyclic dependency
            var whileLoopCount = 0;

            while (subGraphList.length < this.graphData.subGraphs.length && whileLoopCount < this.graphData.connections.length) {
                whileLoopCount++;

                for (i = 0; i < this.graphData.subGraphs.length; i++) {
                    if (subGraphOnListFlags[i] !== true) {
                        var allInputsOnList = true;
                        if (dstConnectedMap[i] !== undefined) {
                            for (var n = 0; n < dstConnectedMap[i].length; n++) {
                                var connectedSrcIndex = dstConnectedMap[i][n];
                                if (subGraphOnListFlags[connectedSrcIndex] !== true) {
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
                if (srcTmpVarMap[subGraphIndex] !== undefined) {
                    var func = this.graphData.subGraphs[subGraphIndex].name;

                    if ( func.endsWith('PS') ) {
                        generatedCodeString += '#ifdef SHADERGRAPH_PS\n';
                    } else if ( func.endsWith('VS') ) {
                        generatedCodeString += '#ifdef SHADERGRAPH_VS\n';
                    }

                    if (this._switchId2Name[subGraphIndex]) {
                        // static switch
                        generatedCodeString += this.graphData.subGraphs[subGraphIndex]._generateStaticSwitch(this._switchMap[this._switchId2Name[subGraphIndex]].value, dstTmpVarMap[subGraphIndex], srcTmpVarMap[subGraphIndex]);
                    } else {
                        generatedCodeString += this.graphData.subGraphs[subGraphIndex]._generateSubGraphCall(dstTmpVarMap[subGraphIndex], srcTmpVarMap[subGraphIndex]);
                    }

                    if ( func.endsWith('PS')  ) {
                        generatedCodeString += '#endif //SHADERGRAPH_PS\n';
                    } else if ( func.endsWith('VS') ) {
                        generatedCodeString += '#endif //SHADERGRAPH_VS\n';
                    }
                }
            }

            // output assignment
            for (i = 0; i < this.graphData.ioPorts.length; i++) {
                ioPort = this.graphData.ioPorts[i];
                if (ioPort.ptype === PORT_TYPE_OUT && ioPort.ptype !== PORT_TYPE_RET) {
                    generatedCodeString += ioPort.name + ' = ' + graphOutputVarTmpVarMap[ioPort.name] + ';\n';
                }
            }

            generatedCodeString += '}\n';
        }

        return generatedCodeString;
    }

});

export { ShaderGraphNode };
