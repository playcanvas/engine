pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.PickMaterial
     * @class A Pick material is for rendering a scene into the frame buffer such that different meshes
     * have different colors that can be queried on a frame buffer read at a specific pixel (normally a
     * click coordinate). This implements frame buffer picking.
     * @property {pc.math.vec4} color The flat color to be written to the frame buffer. RGBA, with each
     * component between 0 and 1.
     * @author Will Eastcott
     */
    var PickMaterial = function () {
        this.color = pc.math.vec4.create(1, 1, 1, 1);
        this.colorMap = null;

        this.update();
    };

    PickMaterial = pc.inherits(PickMaterial, pc.scene.Material);

    pc.extend(PickMaterial.prototype, {
        /**
         * @function
         * @name pc.scene.PickMaterial#clone
         * @description Duplicates a Basic material. All properties are duplicated except textures
         * where only the references are copied.
         * @returns {pc.scene.PickMaterial} A cloned Basic material.
         * @author Will Eastcott
         */
        clone: function () {
            var clone = new pc.scene.PickMaterial();

            Material.prototype._cloneInternal.call(this, clone);

            clone.color = pc.math.vec4.clone(this.color);

            clone.update();
            return clone;
        },

        update: function () {
            this.clearParameters();

            this.setParameter('uColor', this.color);
        },

        updateShader: function (device) {
            var options = {
                skin: !!this.meshInstances[0].skinInstance
            };
            var library = device.getProgramLibrary();
            this.shader = library.getProgram('pick', options);
        }
    });
    
    return {
        PickMaterial: PickMaterial
    }; 
}());