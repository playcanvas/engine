import { ShaderGraphNode, PORT_TYPE_IN, PORT_TYPE_SWITCH, comp2Type } from './shader-graph-node.js';

import { Texture } from '../../graphics/texture.js';

import { PIXELFORMAT_R8_G8_B8_A8, TEXTURETYPE_RGBM } from '../../graphics/graphics.js';

var id = 0;

var _placeholderTex;

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
    this._validationData = { _namedInputs: {}, _opNodes: [], _outputs: {} };

    if (!_placeholderTex) {
        // create texture
        _placeholderTex = new Texture(this.app.graphicsDevice, {
            width: 2,
            height: 2,
            format: PIXELFORMAT_R8_G8_B8_A8
        });
        _placeholderTex.name = 'placeholder';

        // fill pixels with 128
        var pixels = _placeholderTex.lock();

        pixels.fill(128);

        _placeholderTex.unlock();
    }
};

Object.assign(ShaderGraphBuilder.prototype, {

    _addParam: function (type, name, value, isSwitch) {
        if (this._validationData._namedInputs[name]) {
            console.error('pc.ShaderGraphBuilder#addOutput: param ' + name + ' already added!');
            return null;
        }

        var ioPort = isSwitch ? this._graph.addSwitch(type, name, value) : this._graph.addInput(type, name, value);

        this._validationData._namedInputs[name] = ioPort;

        return ioPort;
    },

    /**
     * @private
     * @function
     * @name pc.ShaderGraphBuilder#addTextureParam
     * @description Adds a parameter input to graph.
     * @param {string} type - Type of parameter.
     * @param {string} name - Name of parameter.
     * @param {pc.Texture} value - Optional texture value parameter.
     * @returns {any} Returns the created input port.
     */
    addTextureParam: function (type, name, value) {
        if (value && !(value instanceof Texture)) {
            console.error('pc.ShaderGraphBuilder#addTextureParam: if parameter value specified, the value must be a valid pc.Texture');
            return null;
        }

        return this._addParam(type, name, value || _placeholderTex, false);
    },

    /**
     * @private
     * @function
     * @name pc.ShaderGraphBuilder#addParam
     * @description Adds a parameter input to graph.
     * @param {string} type - Type of parameter.
     * @param {string} name - Name of parameter.
     * @param {number|pc.Vec2|pc.Vec3|pc.Vec4} value - Optional value of parameter.
     * @returns {any} Returns the created input port.
     */
    addParam: function (type, name, value) {
        return this._addParam(type, name, value, false);
    },

    /**
     * @private
     * @function
     * @name pc.ShaderGraphBuilder#addConst
     * @description Adds a constant input to graph.
     * @param {string} type - Type of constant.
     * @param {string} userId - Optional userId of constant.
     * @param {number|pc.Vec2|pc.Vec3|pc.Vec4} value - Value of constant.
     * @returns {any} Returns the created constant port.
     */
    addConst: function (type, userId, value) {
        var name = userId ? 'const_' + type + '_' + userId : '';
        if (userId && this._validationData._namedInputs[name]) {
            console.error('pc.ShaderGraphBuilder#addConst: userId ' + userId + ' already used!');
            return null;
        }
        if (!value) {
            console.error('pc.ShaderGraphBuilder#addConst:' + (userId ? '' : type) + ' constant ' + (userId || '') + ' has no value!');
            return null;
        }

        var ioPort = this._graph.addConstant(type, userId, value);

        if (userId) this._validationData._namedInputs[name] = ioPort;

        return ioPort;
    },
    _validateArg: function (arg, err) {
        if (arg.type) {
            // convert ioPort to port node
            arg = { node: arg };
        }
        if ((arg.node && arg.node.type)) {
            // port node
            if (!this._validationData._namedInputs[arg.node.name] && !arg.node.name.startsWith('const_') ) {
                console.error(err + ": invalid input param: " + arg.node.name);
                return false;
            }
        } else {
            if (typeof(arg) === 'number') {
                arg = { node: arg, port: 'ret' };
            }

            if (!arg.port) {
                arg = { node: arg.node, port: 'ret' };
            }

            var core = this._validationData._opNodes[arg.node];
            if (!core) {
                console.error(err + ": invalid node index: " + arg.node);
                return false;
            }
            var port = core.getIoPortByName(arg.port);
            if (!port) {
                console.error(err + ": invalid output port: " + core.name + "." + arg.port);
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
                // direct ioPort - no swizzle
                arg = { node: arg }; // node is a port node
            }
            if (typeof(arg) === 'number') {
                // node id - no swizzle - set ret port
                arg = { node: arg, port: 'ret' };
            }

            var unswizzledType;
            if (arg.node && arg.node.type) {
                // port node - probably with swizzle
                unswizzledType = arg.node.type;
            } else {
                if (!arg.port) {
                    arg = { node: arg.node, port: 'ret', swizzle: arg.swizzle };
                }

                // node and port - maybe with swizzle
                var core = this._validationData._opNodes[arg.node];
                if (!core) {
                    console.error(err + ": invalid node index: " + arg.node);
                    return null;
                }
                var port = core.getIoPortByName(arg.port);
                if (!port) {
                    console.error(err + ": invalid output port: " + core.name + "." + arg.port);
                    return null;
                }

                unswizzledType = port.type;
            }

            if (arg.swizzle) {
                var swizzleLen = arg.swizzle.length;
                // TODO: check if unswizzledType can be swizzled with specified swizzle
                if (swizzleLen < 1 || swizzleLen > 4) {
                    console.error(err + ": invalid swizzle: " + arg.swizzle);
                    return null;
                }

                argTypes[argIndex] = comp2Type[swizzleLen];
            } else {
                argTypes[argIndex] = unswizzledType;
            }
        }
        return argTypes;
    },

    addTextureSample: function (texParam, uv, options) {
        var texArgs = [texParam, uv];
        var texNode = this.addNode('texSample', texArgs, options);

        var switchName = 'switch_' + texNode;
        var switchValue = 'linear';
        if (texParam.valueTex.type === TEXTURETYPE_RGBM) {
            switchValue = 'RGBM';
        }

        var switchArgs = [{ node: texNode, port: 'rgba', switchLabel: 'linear' }, { node: texNode, port: 'srgba', switchLabel: 'sRGB' }, { node: texNode, port: 'rgbm', switchLabel: 'RGBM' }];
        var switchNodeId = this.addStaticSwitch(switchName, switchArgs, switchValue);

        return switchNodeId;
    },

    addStaticSwitch: function (name, args, value, options) {
        // add a uniform - which is used for dynamic path
        var switchParam = this._addParam('float', name, value, true);
        if (!switchParam) {
            console.error("pc.ShaderGraphBuilder#addStaticSwitch: failed to add switch param:" + name);
            return undefined;
        }
        // prepend switch param
        var switchArgs = args.slice();
        switchArgs.unshift(switchParam);
        var switchNodeId = this.addNode('select', switchArgs, options);
        if (!switchNodeId) {
            console.error("pc.ShaderGraphBuilder#addStaticSwitch: failed to add static switch:" + name);
            return undefined;
        }
        this._graph.addStaticSwitch(name, switchNodeId, args, value);

        return switchNodeId;
    },

    /**
     * @private
     * @function
     * @name pc.ShaderGraphBuilder#addNode
     * @description Creates and adds a core node to the shader graph and connects up inputs.
     * @param {string} name - Name of the core node.
     * @param {number[]|object[]} [args] - Optional array of output node ports or params to connect to new core
     * node inputs - number and port type of arguments must match.
     * @param {object} options - Optional options object.
     * @returns {number} Returns the created node id.
     * @example
     * var node0 = builder.addNode('uv0');
     * var node1 = builder.addNode('texSample', param0, node0 );
     * var node2 = builder.addNode('splitVec', node1 );
     * var node3 = builder.addNode('mul', param1, node42 );
     */
    addNode: function (name, args, options) {
        if (!args) args = [];

        var argTypes = this._getArgTypes(args, "pc.ShaderGraphBuilder#addNode");
        // validate arguments
        if (!argTypes) {
            console.error("pc.ShaderGraphBuilder#addNode: invalid arguments");
            return -1;
        }

        var coreNode = this.app.shaderNodes.get(name, argTypes, options);
        // validate shader node generated
        if (!coreNode) {
            console.error("pc.ShaderGraphBuilder#addNode: invalid node: " + name);
            return -1;
        }

        var sgInputs = coreNode.graphData.ioPorts.filter(function (ioPort) {
            return (ioPort.ptype === PORT_TYPE_IN || ioPort.ptype === PORT_TYPE_SWITCH);
        });

        // validate before adding node
        if (sgInputs.length !== (args.length)) {
            console.error("pc.ShaderGraphBuilder#addNode: number of arguments provided do not match core node: " + name);
            return -1;
        }

        var argIndex;
        for (argIndex = 0; argIndex < args.length; argIndex++) {
            var valid = this._validateArg(args[argIndex], "pc.ShaderGraphBuilder#addNode");
            if (!valid) {
                return -1;
            }
        }

        // add valid node
        var sgIndex = this._graph.addSubGraph(coreNode);
        this._validationData._opNodes[sgIndex] = coreNode;

        for (argIndex = 0; argIndex < args.length; argIndex++) {
            var arg = args[argIndex];
            if (typeof(arg) === 'number') {
                // ret port of a node - no swizzle
                var argNodeIndex = arg;
                this._graph.connect(argNodeIndex, 'ret', sgIndex, sgInputs[argIndex].name);
            } else if (arg.type) {
                // ioPort - no swizzle
                this._graph.connect(-1, arg.name, sgIndex, sgInputs[argIndex].name);
            } else if (arg.node && arg.node.type) {
                // port node - probably with swizzle
                this._graph.connect(-1, arg.node.name, sgIndex, sgInputs[argIndex].name, arg.swizzle);
            } else {
                if (!arg.port) {
                    arg = { node: arg.node, port: 'ret', swizzle: arg.swizzle };
                }
                // specific port of a node - maybe with swizzle
                this._graph.connect(arg.node, arg.port, sgIndex, sgInputs[argIndex].name, arg.swizzle);
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
        if (this._validationData._outputs[name]) {
            console.error('pc.ShaderGraphBuilder#addOutput: output ' + name + ' already added!');
            return;
        }
        var valid = this._validateArg(arg, "pc.ShaderGraphBuilder#addNode");
        if (!valid) {
            return;
        }

        // add valid output
        var ioPort = this._graph.addOutput(type, name);

        this._validationData._outputs[name] = ioPort;

        if (typeof(arg) === 'number') {
            // ret port of a node - no swizzle
            var argNodeIndex = arg;
            this._graph.connect(argNodeIndex, 'ret', -1, ioPort.name);
        } else if (arg.type) {
            // ioPort - no swizzle
            this._graph.connect(-1, arg.name, -1, ioPort.name);
        } else if (arg.node && arg.node.type) {
            // port node - probably with swizzle
            this._graph.connect(-1, arg.node.name, -1, ioPort.name, arg.swizzle);
        } else {
            if (!arg.port) {
                arg = { node: arg.node, port: 'ret', swizzle: arg.swizzle };
            }
            // specific port of a node - maybe with swizzle
            this._graph.connect(arg.node, arg.port, -1, ioPort.name, arg.swizzle);
        }
    },
    /**
     * @private
     * @function
     * @name pc.ShaderGraphBuilder#getShaderGraphChunk
     * @description Get shader graph chunk.
     * @returns {ShaderGraphNode} Shader graph chunk.
     */
    getShaderGraphChunk: function () {
        return this._graph;
    }
});

export { ShaderGraphBuilder };
