import { Material } from './material.js';

/**
 * A Depth material is for rendering linear depth values to a render target.
 *
 * @ignore
 */
class DepthMaterial extends Material {
    updateShader(device) {
        const options = {
            skin: !!this.meshInstances[0].skinInstance
        };
        const library = device.getProgramLibrary();
        this.shader = library.getProgram('depth', options);
    }
}

export { DepthMaterial };
