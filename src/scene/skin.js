import { math } from '../math/math.js';
import { Mat4 } from '../math/mat4.js';

import { FILTER_NEAREST, PIXELFORMAT_RGBA32F } from '../graphics/graphics.js';
import { Texture } from '../graphics/texture.js';

/**
 * @class
 * @name pc.Skin
 * @classdesc A skin contains data about the bones in a hierarchy that drive a skinned mesh animation.
 * Specifically, the skin stores the bone name and inverse bind matrix and for each bone.
 * Inverse bind matrices are instrumental in the mathematics of vertex skinning.
 * @param {pc.GraphicsDevice} graphicsDevice - The graphics device used to manage this skin.
 * @param {pc.Mat4[]} ibp - The array of inverse bind matrices.
 * @param {string[]} boneNames - The array of bone names for the bones referenced by this skin.
 */

var _invMatrix = new Mat4();

function Skin(graphicsDevice, ibp, boneNames) {
    // Constant between clones
    this.device = graphicsDevice;
    this.inverseBindPose = ibp;
    this.boneNames = boneNames;
}

/**
 * @class
 * @name pc.SkinInstance
 * @classdesc A skin instance is responsible for generating the matrix palette that is used to
 * skin vertices from object space to world space.
 * @param {pc.Skin} skin - The skin that will provide the inverse bind pose matrices to
 * generate the final matrix palette.
 * @property {pc.GraphNode[]} bones An array of nodes representing each bone in this skin instance.
 */
function SkinInstance(skin) {
    this._dirty = true;

    if (skin) {
        this.initSkin(skin);
    }
}

Object.assign(SkinInstance.prototype, {

    init: function (device, numBones) {

        if (device.supportsBoneTextures) {

            // texture size - square texture with power of two side, large enough to fit 4 pixels per bone
            var size = numBones > 16 ? math.nextPowerOfTwo(Math.ceil(Math.sqrt(numBones * 4))) : 8;

            this.boneTexture = new Texture(device, {
                width: size,
                height: size,
                format: PIXELFORMAT_RGBA32F,
                mipmaps: false,
                minFilter: FILTER_NEAREST,
                magFilter: FILTER_NEAREST
            });

            this.boneTexture.name = 'skin';
            this.matrixPalette = this.boneTexture.lock();

        } else {
            this.matrixPalette = new Float32Array(numBones * 16);
        }
    },

    initSkin: function (skin) {

        this.skin = skin;

        // Unique per clone
        this.bones = [];

        var numBones = skin.inverseBindPose.length;
        this.init(skin.device, numBones);

        this.matrices = [];
        for (var i = 0; i < numBones; i++) {
            this.matrices[i] = new Mat4();
        }
    },

    uploadBones: function (device) {

        // TODO: this is a bit strange looking. Change the Texture API to do a reupload
        if (device.supportsBoneTextures) {
            this.boneTexture.lock();
            this.boneTexture.unlock();
        }
    },

    updateMatrices: function (rootNode) {

        _invMatrix.copy(rootNode.getWorldTransform()).invert();
        for (var i = this.bones.length - 1; i >= 0; i--) {
            this.matrices[i].mul2(_invMatrix, this.bones[i].getWorldTransform()); // world space -> rootNode space
            this.matrices[i].mul2(this.matrices[i], this.skin.inverseBindPose[i]); // rootNode space -> bind space
        }
    },

    updateMatrixPalette: function () {
        var pe;
        var mp = this.matrixPalette;
        var base;

        for (var i = this.bones.length - 1; i >= 0; i--) {
            pe = this.matrices[i].data;

            // Copy the matrix into the palette, ready to be sent to the vertex shader
            base = i * 16;
            mp[base] = pe[0];
            mp[base + 1] = pe[1];
            mp[base + 2] = pe[2];
            mp[base + 3] = pe[3];
            mp[base + 4] = pe[4];
            mp[base + 5] = pe[5];
            mp[base + 6] = pe[6];
            mp[base + 7] = pe[7];
            mp[base + 8] = pe[8];
            mp[base + 9] = pe[9];
            mp[base + 10] = pe[10];
            mp[base + 11] = pe[11];
            mp[base + 12] = pe[12];
            mp[base + 13] = pe[13];
            mp[base + 14] = pe[14];
            mp[base + 15] = pe[15];
        }

        this.uploadBones(this.skin.device);
    }
});

export { Skin, SkinInstance };
