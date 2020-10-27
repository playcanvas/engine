import { standard } from '../../graphics/program-lib/programs/standard.js';

import {
    SHADER_FORWARDHDR, SHADER_PICK
} from '../constants.js';
import { StandardMaterial } from './standard-material.js';

import { ShaderGraphRegistry } from './shader-graph-registry.js';

/**
 * @class
 * @name pc.StandardNodeMaterial
 * @augments pc.StandardMaterial
 * @classdesc Standard node material is sub class of the StandardMaterial, and adds Shadergraph interop functionality
 * @param {pc.StandardMaterial} mat - optional material which is cloned
 * @param {pc.ShaderGraph} chunkId - optional id of shader graph chunk to be used
 */
function StandardNodeMaterial(mat, chunkId) {
    StandardMaterial.call(this);

    if (mat) {
        StandardMaterial.prototype._cloneInternal.call(mat, this);
    }

    if (chunkId) {
        this._shaderGraphChunkId = chunkId;
    }
}

StandardNodeMaterial.prototype = Object.create(StandardMaterial.prototype);
StandardNodeMaterial.prototype.constructor = StandardNodeMaterial;

Object.assign(StandardNodeMaterial.prototype, {

   /**
    * @function
    * @name pc.StandardNodeMaterial#clone
    * @description Duplicates a Standard node material.
    * @returns {pc.StandardNodeMaterial} A cloned Standard material.
    */
    clone: function () {
        var clone = new StandardNodeMaterial();
        StandardMaterial.prototype._cloneInternal.call(this, clone);

        clone._shaderGraphChunkId = this._shaderGraphChunkId;

        return clone;
    },

   /**
    * @function
    * @name pc.StandardNodeMaterial#setShaderGraphParameter
    * @description sets a parameter in the shader graph
    * @param {string} name - name of the parameter
    * @param {any} value - value of the parameter
    */
    setShaderGraphParameter: function (name, value) {
        if (this._shaderGraphChunkId) {
            var rootShaderGraph = ShaderGraphRegistry.getNode(this._shaderGraphChunkId);

            var portName = 'IN_' + name + '_' + rootShaderGraph.id;

            this.setParameter(portName, value);
        }
    },

    updateUniforms: function () {
        StandardMaterial.prototype.updateUniforms.call(this);

        if (this._shaderGraphChunkId) {
            var rootShaderGraph = ShaderGraphRegistry.getNode(this._shaderGraphChunkId);

            rootShaderGraph.updateShaderGraphUniforms(this);
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
        if (this._shaderGraphChunkId) {
            options._shaderGraphChunkId = this._shaderGraphChunkId;
        }

        if (this.onUpdateShader) {
            options = this.onUpdateShader(options);
        }

        var library = device.getProgramLibrary();
        this.shader = library.getProgram('standard_node', options);

        if (!objDefs) {
            this.clearVariants();
            this.variants[0] = this.shader;
        }

        this.dirtyShader = false;
    }
});

export { StandardNodeMaterial };
