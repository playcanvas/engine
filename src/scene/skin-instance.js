import { Debug } from '../core/debug.js';
import { math } from '../core/math/math.js';
import { Mat4 } from '../core/math/mat4.js';

import { FILTER_NEAREST, PIXELFORMAT_RGBA32F, TEXTURELOCK_READ } from '../platform/graphics/constants.js';
import { Texture } from '../platform/graphics/texture.js';

const _invMatrix = new Mat4();

/**
 * A skin instance is responsible for generating the matrix palette that is used to skin vertices
 * from object space to world space.
 *
 * @category Graphics
 */
class SkinInstance {
    /**
     * An array of nodes representing each bone in this skin instance.
     *
     * @type {import('./graph-node.js').GraphNode[]}
     */
    bones;

    boneTextureSize;

    /**
     * Create a new SkinInstance instance.
     *
     * @param {import('./skin.js').Skin} skin - The skin that will provide the inverse bind pose
     * matrices to generate the final matrix palette.
     */
    constructor(skin) {
        this._dirty = true;

        // optional root bone - used for cache lookup, not used for skinning
        this._rootBone = null;

        // sequential index of when the bone update was performed the last time
        this._skinUpdateIndex = -1;

        // true if bones need to be updated before the frustum culling (bones are needed to update bounds of the MeshInstance)
        this._updateBeforeCull = true;

        if (skin) {
            this.initSkin(skin);
        }
    }

    set rootBone(rootBone) {
        this._rootBone = rootBone;
    }

    get rootBone() {
        return this._rootBone;
    }

    init(device, numBones) {

        // texture size - roughly square that fits all bones, width is multiply of 3 to simplify shader math
        const numPixels = numBones * 3;
        let width = Math.ceil(Math.sqrt(numPixels));
        width = math.roundUp(width, 3);
        const height = Math.ceil(numPixels / width);

        this.boneTexture = new Texture(device, {
            width: width,
            height: height,
            format: PIXELFORMAT_RGBA32F,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            name: 'skin'
        });

        this.boneTextureSize = [width, height, 1.0 / width, 1.0 / height];

        this.matrixPalette = this.boneTexture.lock({ mode: TEXTURELOCK_READ });
        this.boneTexture.unlock();
    }

    destroy() {

        if (this.boneTexture) {
            this.boneTexture.destroy();
            this.boneTexture = null;
        }
    }

    /**
     * Resolves skin bones to a hierarchy with the rootBone at its root.
     *
     * @param {import('../framework/entity.js').Entity} rootBone - A reference to the entity to be used as
     * the root bone.
     * @param {import('../framework/entity.js').Entity} entity - Specifies the entity used if the
     * bone match is not found in the hierarchy - usually the entity the render component is attached to.
     * @ignore
     */
    resolve(rootBone, entity) {

        this.rootBone = rootBone;

        // Resolve bone IDs to actual graph nodes of the hierarchy
        const skin = this.skin;
        const bones = [];
        for (let j = 0; j < skin.boneNames.length; j++) {
            const boneName = skin.boneNames[j];
            /** @type {import('../framework/entity.js').Entity|import('./graph-node.js').GraphNode|null} */
            let bone = rootBone.findByName(boneName);

            if (!bone) {
                Debug.error(`Failed to find bone [${boneName}] in the entity hierarchy, RenderComponent on ${entity.name}, rootBone: ${rootBone.name}`);
                bone = entity;
            }

            bones.push(bone);
        }
        this.bones = bones;
    }

    /**
     * @param {import('./skin.js').Skin} skin - The skin.
     */
    initSkin(skin) {

        this.skin = skin;

        // Unique per clone
        this.bones = [];

        const numBones = skin.inverseBindPose.length;
        this.init(skin.device, numBones);

        this.matrices = [];
        for (let i = 0; i < numBones; i++) {
            this.matrices[i] = new Mat4();
        }
    }

    uploadBones(device) {
        this.boneTexture.upload();
    }

    _updateMatrices(rootNode, skinUpdateIndex) {

        // if not already up to date
        if (this._skinUpdateIndex !== skinUpdateIndex) {
            this._skinUpdateIndex = skinUpdateIndex;

            _invMatrix.copy(rootNode.getWorldTransform()).invert();
            for (let i = this.bones.length - 1; i >= 0; i--) {
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
        const mp = this.matrixPalette;
        const count = this.bones.length;
        for (let i = 0; i < count; i++) {
            const pe = this.matrices[i].data;

            // Copy the matrix into the palette, ready to be sent to the vertex shader, transpose matrix from 4x4 to 4x3 format as well
            const base = i * 12;
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
