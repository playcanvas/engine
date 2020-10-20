import { NodeMaterial } from './node-material.js';

import { shadergraph_nodeRegistry } from './shader-graph-registry.js';

var shadergraph = {};

shadergraph.graphCounter = 0;

//shadergraph.nodeRegistry = {};

shadergraph._getNode = function (name, funcString, declString) {
    if (!shadergraph_nodeRegistry.getNode(name)) {
        shadergraph_nodeRegistry.registerNode(name, new NodeMaterial(funcString, declString));
    }
    return shadergraph_nodeRegistry.getNode(name);
};

shadergraph._registerCoreFunction = function (coreName, coreNode) {

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
                    this.graph.connect(arg.node, 'OUT_' + arg.port, sgIndex, sgInputs[argIndex].name);
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

        this._registerCoreFunction(key, coreNode);
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
        var nodeIndex = this.graph.addSubGraph(this._getNode('worldPosVS', 'vec3 wpVS() { return getWorldPosition(); }'));
        return nodeIndex;
    }
});

Object.defineProperty(shadergraph, 'worldNormVS', {
    get: function () {
        var nodeIndex = this.graph.addSubGraph(this._getNode('worldNormVS', 'vec3 wnVS() { return getNormal(); }'));
        return nodeIndex;
    }
});

shadergraph.param = function (type, name, value) {
    // assumes name is unique TODO: verify this
    var graphVar = this.graph.addInput(type, name, value);
    return graphVar;
};

shadergraph.connectOutput = function (arg, type, name) {
    // assumes this is only called once per graph TODO: verify this
    var graphVar = this.graph.addOutput(type, name);

    if (typeof(arg) === 'number') {
        // ret port of a node
        var argNodeIndex = arg;
        this.graph.connect(argNodeIndex, 'OUT_ret', -1, graphVar.name);
    } else if (arg.type) {
        // graphVar (ioPort)
        this.graph.connect(-1, arg.name, -1, graphVar.name);
    } else {
        // specific port of a node
        this.graph.connect(arg.node, 'OUT_' + arg.port, -1, graphVar.name);
    }
    // this.graph.connect(nodeIndex, (name) ? 'OUT_' + name : 'OUT_ret', -1, graphVar.name);
};

shadergraph.connectVertexOffset = function (arg) {
    this.connectOutput(arg, 'vec3', 'vertOff');
};

shadergraph.connectAlphaOut = function (arg) {
    this.connectOutput(arg, 'float', 'dAlpha');
};

shadergraph.connectMetalnessOut = function (arg) {
    //this.connectOutput(arg, 'float', 'dMetalness');
};

shadergraph.connectGlossinessOut = function (arg) {
    this.connectOutput(arg, 'float', 'dGlossiness');
};

shadergraph.connectAlbedoOut = function (arg) {
    this.connectOutput(arg, 'vec3', 'dAlbedo');
};

shadergraph.connectEmissiveOut = function (arg) {
    this.connectOutput(arg, 'vec3', 'dEmission');
};

shadergraph.connectFragOut = function (arg) {
    this.connectOutput(arg, 'vec4', 'fragOut');
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

export { shadergraph };
