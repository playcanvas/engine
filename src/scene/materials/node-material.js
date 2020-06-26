import { programlib } from '../../graphics/program-lib/program-lib.js';
import { Shader } from '../../graphics/shader.js';

import { Material } from './material.js';

/**
 *
 *
 * @param {object} shaderGraph - shader graph
 * @class
 * @name NodeMaterial
 * @augments ShaderGraphNode
 * @classdesc A Node material is for rendering geometry with material properties set by a material node graph
 * @example
 * // Create a new Node material
 * var material = new NodeMaterial();
 *
 *
 * // Notify the material that it has been modified
 * material.update();
 */
var NodeMaterial = function (shaderGraph) {
    Material.call(this);

    this.shaderGraph = shaderGraph;

    // this.paramValues=[];
};
NodeMaterial.prototype = Object.create(Material.prototype);
NodeMaterial.prototype.constructor = NodeMaterial;

Object.assign(NodeMaterial.prototype, {
    /**
     * @function
     * @name NodeMaterial#clone
     * @description Duplicates a Node material. All properties are duplicated except textures
     * where only the references are copied.
     * @returns {NodeMaterial} A cloned Node material.
     */
    clone: function () {
        var clone = new NodeMaterial();

        Material.prototype._cloneInternal.call(this, clone);

        clone.shaderGraph = this.shaderGraph;

        // clone.nodeInputs.copy(this.nodeInputs);

        return clone;
    },

    updateUniforms: function () {
        this.clearParameters();

        for (var n = 0; n < this.shaderGraph.params.length; n++) {
            // if (!this.paramValues[n])
            // {
            //     this.paramValues[n] = (this.shaderGraph.params[n].value.clone) ? this.shaderGraph.params[n].value.clone() : this.shaderGraph.params[n].value;
            // }

            switch (this.shaderGraph.params[n].type) {
                case 'sampler2D':
                case 'samplerCube':
                case 'float':
                case 'vec2':
                case 'vec3':
                case 'vec4':
                    this.setParameter(this.shaderGraph.params[n].name, this.shaderGraph.params[n].value);
                    break;
                default:
                    // error
                    break;
            }
        }
    },

    // updateShader: function (device, scene, objDefs, staticLightList, pass, sortedLights) {
    initShader: function (device) {
        if (!this.shader) {
            var options = {
                skin: !!this.meshInstances[0].skinInstance,
                shaderGraph: this.shaderGraph
                // pass: pass
            };
//              var library = device.getProgramLibrary();
//              this.shader = library.getProgram('node', options);

            var shaderDefinition = programlib.node.createShaderDefinition(device, options);
            this.shader = new Shader(device, shaderDefinition);
        }
    }
});

export { NodeMaterial };
