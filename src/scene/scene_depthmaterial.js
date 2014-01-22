pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.DepthMaterial
     * @class A Depth material is is for rendering linear depth values to a render target.
     * @author Will Eastcott
     */
    var DepthMaterial = function () {
    };

    DepthMaterial = pc.inherits(DepthMaterial, pc.scene.Material);

    pc.extend(DepthMaterial.prototype, {
        /**
         * @function
         * @name pc.scene.DepthMaterial#clone
         * @description Duplicates a Depth material.
         * @returns {pc.scene.DepthMaterial} A cloned Depth material.
         */
        clone: function () {
            var clone = new pc.scene.DepthMaterial();

            Material.prototype._cloneInternal.call(this, clone);

            clone.update();
            return clone;
        },

        update: function () {
        },

        updateShader: function (device) {
            var options = {
                skin: !!this.meshInstances[0].skinInstance
            };
            var library = device.getProgramLibrary();
            this.shader = library.getProgram('depth', options);
        }
    });
    
    return {
        DepthMaterial: DepthMaterial
    }; 
}());