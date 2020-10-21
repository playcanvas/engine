import { standard } from '../../graphics/program-lib/programs/standard.js';

import {
    SHADER_FORWARDHDR, SHADER_PICK
} from '../constants.js';
import { StandardMaterial } from './standard-material.js';

import { shadergraph_nodeRegistry } from './shader-graph-registry.js';

/**
 * @class
 * @name pc.StandardNodeMaterial
 * @augments pc.StandardMaterial
 * @classdesc Standard node material is sub class of the StandardMaterial, and adds Shadergraph interop functionality
 * @param {pc.StandardMaterial} mat
 * @param {pc.ShaderGraph} chunk
 */
function StandardNodeMaterial(mat, chunk) {
    StandardMaterial.call(this);

    if (mat)
    {
        StandardMaterial.prototype._cloneInternal.call(mat, this);
    }

    if (chunk)
    {
        this._shaderGraphChunk = chunk.name;
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

        clone._shaderGraphChunk = this._shaderGraphChunk;

        //clone._shaderGraphChunk = [];
        //this._shaderGraphChunks.forEach(function (chunk, index) {
        //    clone._shaderGraphChunks[index] = chunk;
        //});

        return clone;
    },

    updateUniforms: function () {
        StandardMaterial.prototype.updateUniforms.call(this);

        if (this._shaderGraphChunk)
        {
            var rootShaderGraph = shadergraph_nodeRegistry.getNode(this._shaderGraphChunk);

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
        if (this._shaderGraphChunk) {
            options._shaderGraphChunk = this._shaderGraphChunk;
        }

        if (this.onUpdateShader) {
            options = this.onUpdateShader(options);
        }

        var library = device.getProgramLibrary();
        this.shader = library.getProgram('standard', options);

        if (!objDefs) {
            this.clearVariants();
            this.variants[0] = this.shader;
        }

        this.dirtyShader = false;
    }
});

export { StandardNodeMaterial };
