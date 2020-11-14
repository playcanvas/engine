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
 * @classdesc StandardNodeMaterial is sub class of the StandardMaterial, and adds shader graph interop functionality
 * @param {pc.StandardMaterial} mat - Optional material which is cloned.
 * @param {any} chunk - Optional shader graph node chunk to be used.
 */
function StandardNodeMaterial(mat, chunk) {
    StandardMaterial.call(this);

    if (mat) {
        StandardMaterial.prototype._cloneInternal.call(mat, this);
    }

    this._shaderGraphChunk = chunk;
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

        clone._shaderGraphChunk = this._shaderGraphChunk;

        return clone;
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

        if (this._shaderGraphChunk) {
            var rootShaderGraph = this._shaderGraphChunk;

            if (!rootShaderGraph._portNameCache) rootShaderGraph._portNameCache = {};
            if (!rootShaderGraph._portNameCache[name]) rootShaderGraph._portNameCache[name] = name + '_' + rootShaderGraph.id;

            var portName = rootShaderGraph._portNameCache[name];

            StandardMaterial.prototype.setParameter.call(this, portName, data);
        }
    },

    updateUniforms: function () {
        StandardMaterial.prototype.updateUniforms.call(this);

        if (this._shaderGraphChunk) {
            var rootShaderGraph = this._shaderGraphChunk;

            rootShaderGraph.updateUniforms(this);
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
        if (this._shaderGraphChunk) {
            options._shaderGraphChunk = this._shaderGraphChunk;
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

export { StandardNodeMaterial };
