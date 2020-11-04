import { ShaderGraphNode } from '../scene/materials/shader-graph-node.js';

/**
 * @private
 * @class
 * @name pc.ShaderNodeRegistry
 * @classdesc Container for all Shader Graph Core Nodes available to this application.
 * @description Create an instance of a pc.ShaderNodeRegistry.
 * @param {pc.Application} app - Application to attach registry to.
 */
function ShaderNodeRegistry(app) {
    this.app = app;
    this._nodes = { };
    this._list = [];
}

ShaderNodeRegistry.prototype.constructor = ShaderNodeRegistry;

ShaderNodeRegistry.prototype.destroy = function () {
    this.app = null;
};

/**
 * @private
 * @function
 * @name pc.ShaderNodeRegistry#register
 * @description Register core nodes with registry.
 * @param {object|string} coreNodeList - core node list object or JSON string
 */
ShaderNodeRegistry.prototype.register = function (coreNodeList) {
    if (coreNodeList) {
        if (typeof coreNodeList === 'string') {
            coreNodeList = JSON.parse(coreNodeList);
        }
        var self = this;
        Object.keys(coreNodeList).forEach(function (key) {
            self._nodes[key] = new ShaderGraphNode(coreNodeList[key].code);
            self._list.push(self._nodes[key]);
        });
    }
};

export { ShaderNodeRegistry };
