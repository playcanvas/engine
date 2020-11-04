import { ShaderGraphNode } from './shader-graph-node.js';

var id = 0;

/**
 * @private
 * @class
 * @name pc.ShaderGraphBuilder
 * @classdesc A Shader Graph Builder class
 * @param {pc.Application} app - Application with shader graph core nodes registered that will be used to build the shader graph
 */
var ShaderGraphBuilder = function (app) {
    id++;

    this.app = app;
    this._nodes = this.app.shaderNodes._nodes;

    this._graph = new ShaderGraphNode();
    this._graph.name = 'graphRoot_' + id;
};

ShaderGraphBuilder.prototype.constructor = ShaderGraphBuilder;

Object.assign(ShaderGraphBuilder.prototype, {
    /**
     * @private
     * @function
     * @name pc.ShaderGraphBuilder#addParam
     * @description adds a parameter input to graph
     * @param {string} type - type of parameter
     * @param {string} name - name of parameter
     * @param {any} value - optional value of parameter
     * @returns {any} returns the created input port
     */
    addParam: function (type, name, value) {
        var ioPort = this._graph.addInput(type, name, value);
        return ioPort;
    },
    /**
     * @private
     * @function
     * @name pc.ShaderGraphBuilder#addNode
     * @description creates and adds a core node to the shader graph and connects up inputs
     * @param {string} name - name of parameter
     * @param {object} [arguments] - first argument is name string, then 0-N output node ports or params to connect to new core node inputs - number and port type of arguments must match.
     * @returns {number} returns the created node id
     * @example
     * var node0 = pc.shadergraph.addNode('uv0');
     * var node1 = pc.shadergraph.addNode('texSample', param0, node0 );
     * var node2 = pc.shadergraph.addNode('splitVec4', node1 );
     * var node3 = pc.shadergraph.addNode('mul3', param1, node42 );
     */
    addNode: function (name) {
        var args = arguments;
        var coreNode = this._nodes[name];
        var sgIndex = this._graph.addSubGraph(coreNode);

        var sgInputs = coreNode.graphData.ioPorts.filter(function (ioPort) {
            return ioPort.name.startsWith('IN_');
        });

        if (sgInputs.length === (args.length - 1)) {
            for (var argIndex = 0; argIndex < (args.length - 1); argIndex++) {
                var arg = args[argIndex + 1];
                if (typeof(arg) === 'number') {
                    // ret port of a node
                    var argNodeIndex = arg;
                    this._graph.connect(argNodeIndex, 'OUT_ret', sgIndex, sgInputs[argIndex].name);
                } else if (arg.type) {
                    // ioPort (ioPort)
                    this._graph.connect(-1, arg.name, sgIndex, sgInputs[argIndex].name);
                } else {
                    // specific port of a node
                    this._graph.connect(arg.node, 'OUT_' + arg.port, sgIndex, sgInputs[argIndex].name);
                }
            }
        } else {
            console.warn("arguments do not match core node");
        }
        return sgIndex;
    },
    /**
     * @private
     * @function
     * @name pc.ShaderGraphBuilder#addOutput
     * @description connect a node port to graph material output
     * @param {any} arg - node port to output
     * @param {string} type - type of output
     * @param {string} name - name of output
     * @example
     * // valid outputs are:
     * pc.shadergraph.output(arg, 'vec3', 'vertOff');
     * pc.shadergraph.output(arg, 'float', 'dAlpha');
     * pc.shadergraph.output(arg, 'vec3', 'dAlbedo');
     * pc.shadergraph.output(arg, 'vec3', 'dNormalMap');
     * pc.shadergraph.output(arg, 'float', 'dGlossiness');
     * pc.shadergraph.output(arg, 'vec3', 'dSpecularity');
     * pc.shadergraph.output(arg, 'vec3', 'dEmission');
     */
    addOutput: function (arg, type, name) {
        // assumes this is only called once per graph output TODO: verify this
        var ioPort = this._graph.addOutput(type, name);

        if (typeof(arg) === 'number') {
            // ret port of a node
            var argNodeIndex = arg;
            this._graph.connect(argNodeIndex, 'OUT_ret', -1, ioPort.name);
        } else if (arg.type) {
            // ioPort (ioPort)
            this._graph.connect(-1, arg.name, -1, ioPort.name);
        } else {
            // specific port of a node
            this._graph.connect(arg.node, 'OUT_' + arg.port, -1, ioPort.name);
        }
    },
    /**
     * @private
     * @function
     * @name pc.ShaderGraphBuilder#getShaderGraphChunk
     * @description get shader graph chunk
     * @returns {any} shader graph chunk
     */
    getShaderGraphChunk: function () {
        return this._graph;
    }
});

export { ShaderGraphBuilder };
