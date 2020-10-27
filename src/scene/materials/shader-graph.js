import { ShaderGraphNode } from './shader-graph-node.js';

import { ShaderGraphRegistry } from './shader-graph-registry.js';

/**
 * @interface
 * @name pc.shadergraph
 * @description interface for shader graph building
 */
var shadergraph = {};

shadergraph.graphCounter = 0;

shadergraph._getNode = function (name, funcString, declString) {
    if (!ShaderGraphRegistry.getNode(name)) {
        ShaderGraphRegistry.registerNode(name, new ShaderGraphNode(funcString, declString));
    }
    return ShaderGraphRegistry.getNode(name);
};

shadergraph._registerCoreFunction = function (coreName, coreNode) {

    this[coreName] = function () {
        var args = arguments;

        var sgIndex = this.graph.addSubGraph(this._getNode(coreName));

        var sgInputs = coreNode.graphData.ioPorts.filter(function (ioPort) {
            return ioPort.name.startsWith('IN_');
        });

        if (sgInputs.length === args.length) {
            for (var argIndex = 0; argIndex < args.length; argIndex++) {
                var arg = args[argIndex];
                if (typeof(arg) === 'number') {
                    // ret port of a node
                    var argNodeIndex = arg;
                    this.graph.connect(argNodeIndex, 'OUT_ret', sgIndex, sgInputs[argIndex].name);
                } else if (arg.type) {
                    // ioPort (ioPort)
                    this.graph.connect(-1, arg.name, sgIndex, sgInputs[argIndex].name);
                } else {
                    // specific port of a node
                    this.graph.connect(arg.node, 'OUT_' + arg.port, sgIndex, sgInputs[argIndex].name);
                }
            }
        } else {
            console.warn("arguments do not match core node function");
        }
        return sgIndex;
    };

};

/**
 * @function
 * @name pc.shadergraph#start
 * @description start building a shader graph and (optional) register list of core nodes to use
 * @param {object|string} coreNodeList - (optional) core node list object or JSON string to register
 */
shadergraph.start = function (coreNodeList) {
    if (coreNodeList) {
        if (typeof coreNodeList === 'string') {
            coreNodeList = JSON.parse(coreNodeList);
        }

        var self = this;
        Object.keys(coreNodeList).forEach(function (key) {
            var coreNode = self._getNode(key, coreNodeList[key].code);
            self._registerCoreFunction(key, coreNode);
        });
    }
    // check current graph is null?
    shadergraph.graph = this._getNode('graphRoot_' + shadergraph.graphCounter);
    shadergraph.graph.name = 'graphRoot_' + shadergraph.graphCounter;
};

/**
 * @function
 * @name pc.shadergraph#end
 * @description end building a shader graph
 * @returns {string} built shader graph node id string
 */
shadergraph.end = function () {
    var ret = shadergraph.graph;
    shadergraph.graph = null;
    shadergraph.graphCounter++;
    return ret.name;
};

/**
 * @function
 * @name pc.shadergraph#param
 * @description adds a parameter input to graph
 * @param {string} type - type of parameter
 * @param {string} name - name of parameter
 * @param {any} value - value of parameter
 * @returns {any} returns the created input port
 */
shadergraph.param = function (type, name, value) {
    // assumes name is unique TODO: verify this
    var ioPort = this.graph.addInput(type, name, value);
    return ioPort;
};

/**
 * @function
 * @name pc.shadergraph#output
 * @description connect a node port to graph material output
 * @param {any} arg - node port to output
 * @param {string} type - type of output
 * @param {string} name - name of output
 * @example
 * // valid outputs are:
 * pc.shadergraph.output(arg, 'vec3', 'vertOff');
 * pc.shadergraph.output(arg, 'float', 'dAlpha');
 * pc.shadergraph.output(arg, 'float', 'dMetalness');
 * pc.shadergraph.output(arg, 'float', 'dGlossiness');
 * pc.shadergraph.output(arg, 'vec3', 'dAlbedo');
 * pc.shadergraph.output(arg, 'vec3', 'dEmission');
 */
shadergraph.output = function (arg, type, name) {
    // assumes this is only called once per graph output TODO: verify this
    var ioPort = this.graph.addOutput(type, name);

    if (typeof(arg) === 'number') {
        // ret port of a node
        var argNodeIndex = arg;
        this.graph.connect(argNodeIndex, 'OUT_ret', -1, ioPort.name);
    } else if (arg.type) {
        // ioPort (ioPort)
        this.graph.connect(-1, arg.name, -1, ioPort.name);
    } else {
        // specific port of a node
        this.graph.connect(arg.node, 'OUT_' + arg.port, -1, ioPort.name);
    }
};

export { shadergraph };
