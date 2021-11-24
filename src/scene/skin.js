/* eslint-disable no-unused-vars */
import { GraphicsDevice } from '../graphics/graphics-device.js';
import { Mat4 } from '../math/mat4.js';
/* eslint-enable no-unused-vars */

/**
 * A skin contains data about the bones in a hierarchy that drive a skinned mesh animation.
 * Specifically, the skin stores the bone name and inverse bind matrix and for each bone. Inverse
 * bind matrices are instrumental in the mathematics of vertex skinning.
 */
class Skin {
    /**
     * Create a new Skin instance.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device used to manage this skin.
     * @param {Mat4[]} ibp - The array of inverse bind matrices.
     * @param {string[]} boneNames - The array of bone names for the bones referenced by this skin.
     */
    constructor(graphicsDevice, ibp, boneNames) {
        // Constant between clones
        this.device = graphicsDevice;
        this.inverseBindPose = ibp;
        this.boneNames = boneNames;
    }
}

export { Skin };
