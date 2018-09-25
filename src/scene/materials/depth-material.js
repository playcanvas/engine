Object.assign(pc, function () {

    /**
     * @private
     * @constructor
     * @name pc.DepthMaterial
     * @classdesc A Depth material is for rendering linear depth values to a render target.
     */
    var DepthMaterial = function () {
        pc.Material.call(this);
    };
    DepthMaterial.prototype = Object.create(pc.Material.prototype);
    DepthMaterial.prototype.constructor = DepthMaterial;

    Object.assign(DepthMaterial.prototype, {
        /**
         * @private
         * @function
         * @name pc.DepthMaterial#clone
         * @description Duplicates a Depth material.
         * @returns {pc.DepthMaterial} A cloned Depth material.
         */
        clone: function () {
            var clone = new pc.DepthMaterial();

            pc.Material.prototype._cloneInternal.call(this, clone);

            return clone;
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
