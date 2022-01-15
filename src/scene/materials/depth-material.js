import { Material } from './material.js';

/**
 * A Depth material is for rendering linear depth values to a render target.
 *
 * @private
 */
class DepthMaterial extends Material {
    /**
     * Clone a `DepthMaterial`.
     *
     * @returns {DepthMaterial} The cloned material.
     */
    clone() {
        const clone = new DepthMaterial();
        return clone.copy(this);
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
