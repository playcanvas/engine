import { Material } from './material.js';

/**
 * @private
 * @class
 * @name pc.DepthMaterial
 * @classdesc A Depth material is for rendering linear depth values to a render target.
 */
class DepthMaterial extends Material {
    constructor() {
        super();
    }

    /**
     * @private
     * @function
     * @name pc.DepthMaterial#clone
     * @description Duplicates a Depth material.
     * @returns {pc.DepthMaterial} A cloned Depth material.
     */
    clone() {
        var clone = new DepthMaterial();

        Material.prototype._cloneInternal.call(this, clone);

        return clone;
    }

    updateShader(device) {
        var options = {
            skin: !!this.meshInstances[0].skinInstance
        };
        var library = device.getProgramLibrary();
        this.shader = library.getProgram('depth', options);
    }
}

export { DepthMaterial };
