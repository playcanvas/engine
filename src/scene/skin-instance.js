import { math } from '../math/math.js';
import { Mat4 } from '../math/mat4.js';

import { FILTER_NEAREST, PIXELFORMAT_RGBA32F } from '../graphics/constants.js';
import { Texture } from '../graphics/texture.js';

var _invMatrix = new Mat4();

/**
 * @class
 * @name SkinInstance
 * @classdesc A skin instance is responsible for generating the matrix palette that is used to
 * skin vertices from object space to world space.
 * @param {Skin} skin - The skin that will provide the inverse bind pose matrices to
 * generate the final matrix palette.
 * @property {GraphNode[]} bones An array of nodes representing each bone in this skin instance.
 */
class SkinInstance {
    constructor(skin) {
        this._dirty = true;

        // optional root bone - used for cache lookup, not used for skinning
        this._rootBone = null;

        // sequencial index of when the bone update was performed the last time
        this._skinUpdateIndex = -1;

        // true if bones need to be updated before the frustum culling (bones are needed to update bounds of the MeshInstance)
        this._updateBeforeCull = true;

        if (skin) {
            this.initSkin(skin);
        }
    }

    init(device, numBones) {

        if (device.supportsBoneTextures) {

            // texture size - roughly square that fits all bones, width is multiply of 3 to simplify shader math
            var numPixels = numBones * 3;
            var width = Math.ceil(Math.sqrt(numPixels));
            width = math.roundUp(width, 3);
            var height = Math.ceil(numPixels / width);

            this.boneTexture = new Texture(device, {
                width: width,
                height: height,
                format: PIXELFORMAT_RGBA32F,
                mipmaps: false,
                minFilter: FILTER_NEAREST,
                magFilter: FILTER_NEAREST
            });

            this.boneTexture.name = 'skin';
            this.matrixPalette = this.boneTexture.lock();

        } else {
            this.matrixPalette = new Float32Array(numBones * 12);
        }
    }

    destroy() {

        if (this.boneTexture) {
            this.boneTexture.destroy();
            this.boneTexture = null;
        }
    }

    get rootBone() {
        return this._rootBone;
    }

    set rootBone(rootBone) {
        this._rootBone = rootBone;
    }

    // resolved skin bones to a hierarchy with the rootBone at its root.
    // entity parameter specifies the entity used if the bone match is not found in the hierarchy - usually the entity the render component is attached to
    resolve(rootBone, entity) {

        this.rootBone = rootBone;

        // Resolve bone IDs to actual graph nodes of the hierarchy
        const skin = this.skin;
        const  bones = [];
        for (let j = 0; j < skin.boneNames.length; j++) {
            var boneName = skin.boneNames[j];
            var bone = rootBone.findByName(boneName);

            if (!bone) {
                // #if _DEBUG
                console.error(`Failed to find bone [${boneName}] in the entity hierarchy, RenderComponent on ${entity.name}, rootBone: ${rootBone.entity.name}`);
                // #endif
                bone = entity;
            }

            bones.push(bone);
        }
        this.bones = bones;
    }

    initSkin(skin) {

        this.skin = skin;

        // Unique per clone
        this.bones = [];

        var numBones = skin.inverseBindPose.length;
        this.init(skin.device, numBones);

        this.matrices = [];
        for (var i = 0; i < numBones; i++) {
            this.matrices[i] = new Mat4();
        }
    }

    uploadBones(device) {

        // TODO: this is a bit strange looking. Change the Texture API to do a reupload
        if (device.supportsBoneTextures) {
            this.boneTexture.lock();
            this.boneTexture.unlock();
        }
    }

    _updateMatrices(rootNode, skinUpdateIndex) {

        // if not already up to date
        if (this._skinUpdateIndex !== skinUpdateIndex) {
            this._skinUpdateIndex = skinUpdateIndex;

            _invMatrix.copy(rootNode.getWorldTransform()).invert();
            for (var i = this.bones.length - 1; i >= 0; i--) {
                this.matrices[i].mulAffine2(_invMatrix, this.bones[i].getWorldTransform()); // world space -> rootNode space
                this.matrices[i].mulAffine2(this.matrices[i], this.skin.inverseBindPose[i]); // rootNode space -> bind space
            }
        }
    }

    updateMatrices(rootNode, skinUpdateIndex) {

        if (this._updateBeforeCull) {
            this._updateMatrices(rootNode, skinUpdateIndex);
        }
    }

    updateMatrixPalette(rootNode, skinUpdateIndex) {

        // make sure matrices are up to date
        this._updateMatrices(rootNode, skinUpdateIndex);

        // copy matrices to palette
        var pe;
        var mp = this.matrixPalette;
        var base;

        var count = this.bones.length;
        for (var i = 0; i < count; i++) {
            pe = this.matrices[i].data;

            // Copy the matrix into the palette, ready to be sent to the vertex shader, transpose matrix from 4x4 to 4x3 format as well
            base = i * 12;
            mp[base] = pe[0];
            mp[base + 1] = pe[4];
            mp[base + 2] = pe[8];
            mp[base + 3] = pe[12];
            mp[base + 4] = pe[1];
            mp[base + 5] = pe[5];
            mp[base + 6] = pe[9];
            mp[base + 7] = pe[13];
            mp[base + 8] = pe[2];
            mp[base + 9] = pe[6];
            mp[base + 10] = pe[10];
            mp[base + 11] = pe[14];
        }

        this.uploadBones(this.skin.device);
    }
}

export { SkinInstance };
