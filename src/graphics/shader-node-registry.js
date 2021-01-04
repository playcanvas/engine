import { ShaderGraphNode } from '../scene/materials/shader-graph-node.js';
import { hashCode } from '../core/hash.js';
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

ShaderNodeRegistry.prototype._genVariantKey = function (argTypes, options) {
    var variantKey = 'varKey';

    for (var argIndex = 0; argIndex < argTypes.length; argIndex++) {
        variantKey += '_' + argTypes[argIndex];
    }

    if (options) {
        for (var optionName in options) {
            variantKey += '_' + optionName + '_' + options[optionName];
        }
    }

    return hashCode(variantKey);
};

ShaderNodeRegistry.prototype.get = function (name, argTypes, options) {
    var cachedNode = this._nodeCache[name];
    if (cachedNode) {
        var nodeDef = this._nodeDef[name];
        if (!nodeDef.gen) {
            // if no generator, passthrough
            if (!cachedNode.def) {
                cachedNode.def = new ShaderGraphNode(nodeDef.code);
            }
            return cachedNode.def;
        }

        var variantKey = this._genVariantKey(argTypes, options);
        if (cachedNode[variantKey]) {
            // return cached variant
            return cachedNode[variantKey];
        }

        // generate variant, add to cache and return it
        var variantCode = nodeDef.gen(argTypes, options);
        if (variantCode) {
            cachedNode[variantKey] = new ShaderGraphNode(variantCode);

            cachedNode[variantKey]._precision = ((options && options.precision) ? options.precision : '');

            return cachedNode[variantKey];
        }
    }
};

export { ShaderNodeRegistry };
