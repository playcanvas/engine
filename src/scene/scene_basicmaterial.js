pc.extend(pc, function () {

    /**
     * @name pc.BasicMaterial
     * @class A Basic material is is for rendering unlit geometry, either using a constant color or a
     * color map modulated with a color.
     * @property {pc.Color} color The flat color of the material (RGBA, where each component is 0 to 1).
     * @property {pc.Texture} colorMap The color map of the material. If specified, the color map is
     * modulated by the color property.
     * @author Will Eastcott
     */
    var BasicMaterial = function () {
        this.color = new pc.Color(1, 1, 1, 1);
        this.colorMap = null;
        this.vertexColors = false;

        this.update();
    };

    BasicMaterial = pc.inherits(BasicMaterial, pc.Material);

    pc.extend(BasicMaterial.prototype, {
        /**
         * @function
         * @name pc.BasicMaterial#clone
         * @description Duplicates a Basic material. All properties are duplicated except textures
         * where only the references are copied.
         * @returns {pc.BasicMaterial} A cloned Basic material.
         */
        clone: function () {
            var clone = new pc.BasicMaterial();

            pc.Material.prototype._cloneInternal.call(this, clone);

            clone.color.copy(this.color);
            clone.colorMap = this.colorMap;
            clone.vertexColors = this.vertexColors;

            clone.update();
            return clone;
        },

        update: function () {
            this.clearParameters();

            this.setParameter('uColor', this.color.data);
            if (this.colorMap) {
                this.setParameter('texture_diffuseMap', this.colorMap);
            }
        },

        updateShader: function (device) {
            var options = {
                skin: !!this.meshInstances[0].skinInstance,
                vertexColors: this.vertexColors,
                diffuseMap: this.colorMap
            };
            var library = device.getProgramLibrary();
            this.shader = library.getProgram('basic', options);
        }
    });

    return {
        BasicMaterial: BasicMaterial
    };
}());
