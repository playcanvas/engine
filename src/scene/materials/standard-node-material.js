import { standard } from '../../graphics/program-lib/programs/standard.js';

import {
    SHADER_FORWARDHDR, SHADER_PICK
} from '../constants.js';

import { StandardMaterial } from './standard-material.js';

/**
 * @private
 * @class
 * @name pc.StandardNodeMaterial
 * @augments pc.StandardMaterial
 * @classdesc StandardNodeMaterial is sub class of the StandardMaterial, and adds shader graph
 * interop functionality.
 * @param {pc.StandardMaterial} mat - Optional material which is cloned.
 * @param {any} chunk - Optional shader graph node chunk to be used.
 */
function StandardNodeMaterial(mat, chunk) {
    StandardMaterial.call(this);

    if (mat) {
        StandardMaterial.prototype._cloneInternal.call(mat, this);
    }

    this.shaderGraphChunk = chunk;

    // shader graph parameter and switch overrides
    this._graphParamOverrides = {};
    this._graphSwitchOverrides = {};
}

StandardNodeMaterial.prototype = Object.create(StandardMaterial.prototype);
StandardNodeMaterial.prototype.constructor = StandardNodeMaterial;

Object.assign(StandardNodeMaterial.prototype, {

    /**
     * @private
     * @function
     * @name pc.StandardNodeMaterial#clone
     * @description Duplicates a Standard Node material. All properties are duplicated except textures
     * and the shader graph chunk where only the references are copied.
     * @returns {pc.StandardNodeMaterial} A cloned Standard Node material.
     */
    clone: function () {
        var clone = new StandardNodeMaterial();
        StandardMaterial.prototype._cloneInternal.call(this, clone);

        clone.shaderGraphChunk = this._shaderGraphChunk;

        clone._graphParamOverrides = Object.assign({}, this._graphParamOverrides);
        clone._graphSwitchOverrides = Object.assign({}, this._graphSwitchOverrides);

        return clone;
    },

    overrideGraphSwitch: function (name, value) {
        if (this.shaderGraphChunk) {
            var currentValue = this._graphSwitchOverrides[name];// this.shaderGraphChunk.getSwitchValue(name);
            if (currentValue !== value) {
                this._graphSwitchOverrides[name] = value;
                // this.shaderGraphChunk.setSwitchValue(name, value);
                this.dirtyShader = true;
            }
        }
    },

    /**
     * @private
     * @function
     * @name pc.StandardNodeMaterial#setParameter
     * @description Sets a shader parameter on a StandardNodeMaterial material.
     * @param {string} name - The name of the parameter to set.
     * @param {number|number[]|pc.Texture} data - The value for the specified parameter.
     */
    setParameter: function (name, data) {
        StandardMaterial.prototype.setParameter.call(this, name, data);
    },

    setParameters: function (device, names, restoreGraphDefaults) {
        StandardMaterial.prototype.setParameters.call(this, device, names);

        // apply / restore graph chunk overrides
        if (this.shaderGraphChunk) {
            if (restoreGraphDefaults === true) {
                // restore
                this.shaderGraphChunk.setParameters(device, Object.keys(this._graphParamOverrides), null);
            } else {
                // override
                this.shaderGraphChunk.setParameters(device, null, this._graphParamOverrides);
            }
        }
    },

    /**
     * @private
     * @function
     * @name pc.StandardNodeMaterial#overrideGraphParameter
     * @description Sets a shader graph parameter on a StandardNodeMaterial.
     * @param {string} name - The name of the parameter to set.
     * @param {number|number[]|pc.Texture} data - The value for the specified parameter.
     */
    overrideGraphParameter: function (name, data) {
        if (this.shaderGraphChunk) {
            var rootShaderGraph = this.shaderGraphChunk;
            var portName = rootShaderGraph.getIoPortUniformName(name);
            if (portName) {
                this._graphParamOverrides[name] = { scopeId: null, data: data };
                // StandardMaterial.prototype.setParameter.call(this, portName, data);
            } else {
                console.warn('not a shaderGraphChunk parameter - did you want to call setParameter()?');
            }
        }
    },

    updateUniforms: function () {
        StandardMaterial.prototype.updateUniforms.call(this);

        if (this.shaderGraphChunk) {
            this.shaderGraphChunk.updateUniforms();
        }
    },

    updateShader: function (device, scene, objDefs, staticLightList, pass, sortedLights) {
        var prefilteredCubeMap128 = StandardMaterial.prototype._updateShaderGlobals.call(this, device, scene);

        // Minimal options for Depth and Shadow passes
        var minimalOptions = pass > SHADER_FORWARDHDR && pass <= SHADER_PICK;
        var options = minimalOptions ? standard.optionsContextMin : standard.optionsContext;

        if (minimalOptions)
            this.shaderOptBuilder.updateMinRef(options, device, scene, this, objDefs, staticLightList, pass, sortedLights, prefilteredCubeMap128);
        else
            this.shaderOptBuilder.updateRef(options, device, scene, this, objDefs, staticLightList, pass, sortedLights, prefilteredCubeMap128);

        // add shader graph chunk to options
        if (this.shaderGraphChunk) {
            options._shaderGraphChunk = this.shaderGraphChunk;

            options._graphSwitchOverrides = this._graphSwitchOverrides;
            options._graphParamOverrides = this._graphParamOverrides;

            // shader graph chunk texture sampling can switch to this
            options.useRgbm = true;
        }

        if (this.onUpdateShader) {
            options = this.onUpdateShader(options);
        }

        var library = device.getProgramLibrary();
        this.shader = library.getProgram('standardnode', options);

        if (!objDefs) {
            this.clearVariants();
            this.variants[0] = this.shader;
        }

        this.dirtyShader = false;
    }
});

Object.defineProperty(StandardNodeMaterial.prototype, 'shaderGraphChunk', {
    get: function () {
        return this._shaderGraphChunk;
    },
    set: function (value) {
        if (!value || this._shaderGraphChunk === value)
            return;

        // remove this material from current chunk's material list
        if (this._shaderGraphChunk) {
            var self = this;
            this._shaderGraphChunk._materials = this._shaderGraphChunk._materials.filter(function (mat) {
                return mat !== self;
            });
        }

        this._shaderGraphChunk = value;
        // add this material
        this._shaderGraphChunk._materials.push(this);

        // mark shader as dirty
        this.dirtyShader = true;
    }
});

export { StandardNodeMaterial };
