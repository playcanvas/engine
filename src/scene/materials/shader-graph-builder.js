import { ShaderGraphNode, PORT_TYPE_IN } from './shader-graph-node.js';

var id = 0;

/**
 * @private
 * @class
 * @name pc.ShaderGraphBuilder
 * @classdesc A Shader Graph Builder class.
 * @param {pc.Application} app - Application with shader graph core nodes registered that will be used to
 * build the shader graph.
 */
var ShaderGraphBuilder = function (app) {
    id++;

    this.app = app;

    this._graph = new ShaderGraphNode();
    this._graph.name = 'graphRoot_' + id;

    // for validation
    this._addedNamedInputs = {};
    this._addedNodes = [];
    this._addedOutputs = {};
};

ShaderGraphBuilder.prototype.constructor = ShaderGraphBuilder;

Object.assign(ShaderGraphBuilder.prototype, {
    /**
     * @private
     * @function
     * @name pc.ShaderGraphBuilder#addParam
     * @description Adds a parameter input to graph.
     * @param {string} type - Type of parameter.
     * @param {string} name - Name of parameter.
     * @param {any} value - Optional value of parameter.
     * @returns {any} Returns the created input port.
     */
    addParam: function (type, name, value) {
        if (this._addedNamedInputs[name]) {
            console.error('pc.ShaderGraphBuilder#addOutput: param ' + name + ' already added!');
            return null;
        }

        var ioPort = this._graph.addInput(type, name, value);

        this._addedNamedInputs[name] = ioPort;

        return ioPort;
    },
    /**
     * @private
     * @function
     * @name pc.ShaderGraphBuilder#addConst
     * @description Adds a constant input to graph.
     * @param {string} type - Type of constant.
     * @param {string} userId - Optional userId of constant.
     * @param {any} value - Value of constant.
     * @returns {any} Returns the created constant port.
     */
    addConst: function (type, userId, value) {
        var name = userId ? 'const_' + type + '_' + userId : '';
        if (userId && this._addedNamedInputs[name]) {
            console.error('pc.ShaderGraphBuilder#addConst: userId ' + userId + ' already used!');
            return null;
        }
        if (!value) {
            console.error('pc.ShaderGraphBuilder#addConst:' + (userId ? '' : type) + ' constant ' + (userId || '') + ' has no value!');
            return null;
        }

        var ioPort = this._graph.addConstant(type, userId, value);

        if (userId) this._addedNamedInputs[name] = ioPort;

        return ioPort;
    },
    _validateArg: function (arg, type, name, node, err) {
        if (arg.type) {
            if (!this._addedNamedInputs[arg.name] && !arg.name.startsWith('const_') ) {
                console.error(err + ": invalid input param: " + arg.name);
                return false;
            }
            if (arg.type !== type) {
                console.error(err + ": input param type mismatch: " + arg.name + "." + type + " != " + node + "." + name + "." + type );
                return false;
            }
        } else {
            if (typeof(arg) === 'number') {
                arg = { node: arg, port: 'ret' };
            }
            var core = this._addedNodes[arg.node];
            if (!core) {
                console.error(err + ": invalid node index: " + arg.node);
                return false;
            }
            var port = core.getIoPortByName(arg.port);
            if (!port) {
                console.error(err + ": invalid output port: " + core.name + "." + arg.port);
                return false;
            }
            if (port.type !== type) {
                console.error(err + ": port type mismatch: " + core.name + "." + port.name + "." + port.type + " != " + node + "." + name + "." + type );
                return false;
            }
        }
        return true;
    },

    _getArgTypes: function (args, err) {
        var argTypes = [];
        var argIndex;
        for (argIndex = 0; argIndex < args.length; argIndex++) {
            var arg = args[argIndex];
            if (arg.type) {
                argTypes[argIndex] = arg.type;
            } else {
                if (typeof(arg) === 'number') {
                    arg = { node: arg, port: 'ret' };
                }
                var core = this._addedNodes[arg.node];
                if (!core) {
                    console.error(err + ": invalid node index: " + arg.node);
                    return false;
                }
                var port = core.getIoPortByName(arg.port);
                if (!port) {
                    console.error(err + ": invalid output port: " + core.name + "." + arg.port);
                    return false;
                }
                argTypes[argIndex] = port.type;
            }
        }
        return argTypes;
    },

    /**
     * @private
     * @function
     * @name pc.ShaderGraphBuilder#addNode
     * @description Creates and adds a core node to the shader graph and connects up inputs.
     * @param {string} name - Name of the core node.
     * @param {*[]} args - Optional array of output node ports or params to connect to new core
     * node inputs - number and port type of arguments must match.
     * @returns {number} Returns the created node id.
     * @example
     * var node0 = builder.addNode('uv0');
     * var node1 = builder.addNode('texSample', param0, node0 );
     * var node2 = builder.addNode('splitVec', node1 );
     * var node3 = builder.addNode('mul', param1, node42 );
     */
    addNode: function (name, args) {
        if (!args) args = [];

        var argTypes = this._getArgTypes(args, "pc.ShaderGraphBuilder#addNode");
        // validate arguments
        if (!argTypes) {
            console.error("pc.ShaderGraphBuilder#addNode: invalid arguments");
            return -1;
        }

        var coreNode = this.app.shaderNodes.get(name, argTypes);
        // validate shader node generated
        if (!coreNode) {
            console.error("pc.ShaderGraphBuilder#addNode: invalid node: " + name);
            return -1;
        }

        var sgInputs = coreNode.graphData.ioPorts.filter(function (ioPort) {
            return ioPort.ptype === PORT_TYPE_IN;
        });

        // validate before adding node
        if (sgInputs.length !== (args.length)) {
            console.error("pc.ShaderGraphBuilder#addNode: number of arguments provided do not match core node: " + name);
            return -1;
        }

        var argIndex;
        for (argIndex = 0; argIndex < args.length; argIndex++) {
            var valid = this._validateArg(args[argIndex], sgInputs[argIndex].type, sgInputs[argIndex].name, coreNode.name, "pc.ShaderGraphBuilder#addNode");
            if (!valid) {
                return -1;
            }
        }

        // add valid node
        var sgIndex = this._graph.addSubGraph(coreNode);
        this._addedNodes[sgIndex] = coreNode;

        for (argIndex = 0; argIndex < args.length; argIndex++) {
            var arg = args[argIndex];
            if (typeof(arg) === 'number') {
                // ret port of a node
                var argNodeIndex = arg;
                this._graph.connect(argNodeIndex, 'ret', sgIndex, sgInputs[argIndex].name);
            } else if (arg.type) {
                // ioPort (ioPort)
                this._graph.connect(-1, arg.name, sgIndex, sgInputs[argIndex].name);
            } else {
                // specific port of a node
                this._graph.connect(arg.node, arg.port, sgIndex, sgInputs[argIndex].name);
            }
        }
        return sgIndex;
    },
    /**
     * @private
     * @function
     * @name pc.ShaderGraphBuilder#addOutput
     * @description Connect a node port to graph material output.
     * @param {any} arg - Node port to output.
     * @param {string} type - Type of output.
     * @param {string} name - Name of output.
     * @example
     * builder.addOutput(arg, 'vec3', 'sgVertOff');
     * builder.addOutput(arg, 'float', 'sgAlpha');
     * builder.addOutput(arg, 'vec3', 'sgAlbedo');
     * builder.addOutput(arg, 'vec4', 'sgCustomPass0');
     */
    addOutput: function (arg, type, name) {
        // validate before adding output
        if (this._addedOutputs[name]) {
            console.error('pc.ShaderGraphBuilder#addOutput: output ' + name + ' already added!');
            return;
        }
        var valid = this._validateArg(arg, type, name, "", "pc.ShaderGraphBuilder#addNode");
        if (!valid) {
            return;
        }

        // add valid output
        var ioPort = this._graph.addOutput(type, name);

        this._addedOutputs[name] = ioPort;

        if (typeof(arg) === 'number') {
            // ret port of a node
            var argNodeIndex = arg;
            this._graph.connect(argNodeIndex, 'ret', -1, ioPort.name);
        } else if (arg.type) {
            // ioPort (ioPort)
            this._graph.connect(-1, arg.name, -1, ioPort.name);
        } else {
            // specific port of a node
            this._graph.connect(arg.node, arg.port, -1, ioPort.name);
        }
    },
    /**
     * @private
     * @function
     * @name pc.ShaderGraphBuilder#getShaderGraphChunk
     * @description Get shader graph chunk.
     * @returns {any} Shader graph chunk.
     */
    getShaderGraphChunk: function () {
        return this._graph;
    }
});

export { ShaderGraphBuilder };
