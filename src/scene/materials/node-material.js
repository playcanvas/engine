Object.assign(pc, function () {

    /**
     * @class
     * @name pc.NodeMaterial
     * @augments pc.Material
     * @classdesc A Node material is for rendering unlit geometry, either using a constant color or a
     * color map modulated with a color.
     * @property {pc.Color} color The flat color of the material (RGBA, where each component is 0 to 1).
     * @property {pc.Texture|null} colorMap The color map of the material (default is null). If specified, the color map is
     * modulated by the color property.
     * @example
     * // Create a new Node material
     * var material = new pc.NodeMaterial();
     *
     * // Set the material to have a texture map that is multiplied by a red color
     * material.color.set(1, 0, 0);
     * material.colorMap = diffuseMap;
     *
     * // Notify the material that it has been modified
     * material.update();
     */
    var NodeMaterial = function () {
        pc.Material.call(this);

        this.color = new pc.Color(1, 1, 1, 1);
        this.colorUniform = new Float32Array(4);

        this.colorMap = null;
        this.vertexColors = false;
    };
    NodeMaterial.prototype = Object.create(pc.Material.prototype);
    NodeMaterial.prototype.constructor = NodeMaterial;

    Object.assign(NodeMaterial.prototype, {
        /**
         * @function
         * @name pc.NodeMaterial#clone
         * @description Duplicates a Node material. All properties are duplicated except textures
         * where only the references are copied.
         * @returns {pc.NodeMaterial} A cloned Node material.
         */
        clone: function () {
            var clone = new pc.NodeMaterial();

            pc.Material.prototype._cloneInternal.call(this, clone);

            clone.color.copy(this.color);
            clone.colorMap = this.colorMap;
            clone.vertexColors = this.vertexColors;

            return clone;
        },

        updateUniforms: function () {
            this.clearParameters();

            this.colorUniform[0] = this.color.r;
            this.colorUniform[1] = this.color.g;
            this.colorUniform[2] = this.color.b;
            this.colorUniform[3] = this.color.a;
            this.setParameter('uColor', this.colorUniform);
            if (this.colorMap) {
                this.setParameter('texture_diffuseMap', this.colorMap);
            }
        },

        updateShader: function (device, scene, objDefs, staticLightList, pass, sortedLights) {
            var options = {
                skin: !!this.meshInstances[0].skinInstance,
                nodeInputs: this.nodeInputs,
                pass: pass
            };
//            var library = device.getProgramLibrary();
//            this.shader = library.getProgram('node', options);

            var shaderDefinition = pc.programlib.node.createShaderDefinition(gd, options);
            shader = new pc.Shader(gd, shaderDefinition);
        }
    });

    return {
        NodeMaterial: NodeMaterial
    };
}());
