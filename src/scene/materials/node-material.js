import { programlib } from '../../graphics/program-lib/program-lib.js';
import { Shader } from '../../graphics/shader.js';

import { Material } from './material.js';

import {
    SHADER_FORWARD
    //SHADER_DEPTH, SHADER_FORWARD, SHADER_FORWARDHDR, SHADER_PICK, SHADER_SHADOW
 } from '../constants.js';

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
    
    this.shaderVariants = [];

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

    updateShader: function (device, scene, objDefs, staticLightList, pass, sortedLights)
    {
        //update dynamic lighting - for now main light is first directional light in slot 0 of 32 slots
 /*      
        var dynamicLightlist = [];
        var mainLight;

        for (i = 0; i < sortedLights[LIGHTTYPE_DIRECTIONAL].length; i++) 
        {
            var light = sortedLights[LIGHTTYPE_DIRECTIONAL][i];
            if (light.enabled && light. ) {
                if (light.mask & mask) {
                    if (lType !== LIGHTTYPE_DIRECTIONAL) {
                        if (light.isStatic) {
                            continue;
                        }
                    }
                    lightsFiltered.push(light);
                }
            }
        }
*/
        if (this.shaderVariants[pass])
        {
            this.shader = this.shaderVariants[pass];
        }
        else
        {
            //new variant - maybe new layer that this material has a special output for?
            //TODO: 
            this.shader = this.shaderVariants[SHADER_FORWARD];//pass];
        }
    },

    //initShaderVariants: function (device) {
    initShader: function (device) {    
        // this is where we could get a list of pass types in current app render pipeline (layers)
        // and query shader graph to check if there is a special output
        //var passes=[SHADER_DEPTH, SHADER_FORWARD, SHADER_FORWARDHDR, SHADER_PICK, SHADER_SHADOW];
        var passes=[SHADER_FORWARD];

        for (var i=0;i<passes.length; i++)
        {
            if (!this.shaderVariants[passes[i]]) 
            {
                var options = {
                    skin: !!this.meshInstances[0].skinInstance,
                    shaderGraph: this.shaderGraph,
                    pass: passes[i]
                };

                var shaderDefinition = programlib.node.createShaderDefinition(device, options);
                this.shaderVariants[passes[i]] = new Shader(device, shaderDefinition);
            }
        }
    }
});

export { NodeMaterial };
