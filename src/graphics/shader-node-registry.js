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
    this._nodeDef = { };
    this._nodeCache = { };
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
            self._nodeDef[key] = coreNodeList[key];
            self._nodeCache[key] = {};
        });
    }
};

ShaderNodeRegistry.prototype._genVariantKey = function (argTypes) {
    var key = 'variantKey';

    var argIndex;
    for (argIndex = 0; argIndex < argTypes.length; argIndex++) {
        key += '_' + argTypes[argIndex];
    }

    return key;
};

ShaderNodeRegistry.prototype.get = function (name, argTypes) {
    if (this._nodeCache[name]) {
        if (!this._nodeDef[name].gen) {
            // if no generator, passthrough
            if (!this._nodeCache[name].def) {
                this._nodeCache[name].def = new ShaderGraphNode(this._nodeDef[name].code);
            }
            return this._nodeCache[name].def;
        }

        var variantKey = this._genVariantKey(argTypes);
        if (this._nodeCache[name][variantKey]) {
            // return cached variant
            return this._nodeCache[name][variantKey];
        }

        // generate variant, add to cache and return it
        var variantCode = this._nodeDef[name].gen(argTypes);
        if (variantCode) {
            this._nodeCache[name][variantKey] = new ShaderGraphNode(variantCode);
            return this._nodeCache[name][variantKey];
        }
    }
};

export { ShaderNodeRegistry };
