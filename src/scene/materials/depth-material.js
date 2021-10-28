import { Material } from './material.js';

/**
 * @private
 * @class
 * @name DepthMaterial
 * @classdesc A Depth material is for rendering linear depth values to a render target.
 */
class DepthMaterial extends Material {
    /**
     * @private
     * @function
     * @name DepthMaterial#clone
     * @description Duplicates a Depth material.
     * @returns {DepthMaterial} A cloned Depth material.
     */
    clone() {
        const clone = new DepthMaterial();

        Material.prototype._cloneInternal.call(this, clone);

        return clone;
    }

    updateShader(device) {
        const options = {
            skin: !!this.meshInstances[0].skinInstance
        };
        const library = device.getProgramLibrary();
        this.shader = library.getProgram('depth', options);
    }
}

export { DepthMaterial };
