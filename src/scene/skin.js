/**
 * @class
 * @name Skin
 * @classdesc A skin contains data about the bones in a hierarchy that drive a skinned mesh animation.
 * Specifically, the skin stores the bone name and inverse bind matrix and for each bone.
 * Inverse bind matrices are instrumental in the mathematics of vertex skinning.
 * @param {pc.GraphicsDevice} graphicsDevice - The graphics device used to manage this skin.
 * @param {pc.Mat4[]} ibp - The array of inverse bind matrices.
 * @param {string[]} boneNames - The array of bone names for the bones referenced by this skin.
 */

class Skin {
    constructor(graphicsDevice, ibp, boneNames) {
        // Constant between clones
        this.device = graphicsDevice;
        this.inverseBindPose = ibp;
        this.boneNames = boneNames;
    }
}

export { Skin };
