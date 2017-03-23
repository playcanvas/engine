pc.extend(pc, function () {
    /**
     * @name pc.Skin
     * @class A skin contains data about the bones in a hierarchy that drive a skinned mesh animation.
     * Specifically, the skin stores the bone name and inverse bind matrix and for each bone.
     * Inverse bind matrices are instrumental in the mathematics of vertex skinning.
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device used to manage this skin.
     * @param {pc.Mat4[]} ibp The array of inverse bind matrices.
     * @param {String[]} boneNames The array of bone names for the bones referenced by this skin.
     * @author Will Eastcott
     */

    var Skin = function (graphicsDevice, ibp, boneNames) {
        // Constant between clones
        this.device = graphicsDevice;
        this.inverseBindPose = ibp;
        this.boneNames = boneNames;
    };

    /**
     * @name pc.SkinInstance
     * @class A skin instance is responsible for generating the matrix palette that is used to
     * skin vertices from object space to world space.
     * @param {pc.Skin} skin The skin that will provide the inverse bind pose matrices to
     * generate the final matrix palette.
     * @author Will Eastcott
     */
    var SkinInstance = function (skin, node) {
        this.skin = skin;
        this.rootNode = node;
        this._dirty = true;

        // Unique per clone
        this.bones = [];

        var numBones = skin.inverseBindPose.length;

        var device = skin.device;
        if (device.supportsBoneTextures) {
            // Caculate a square texture dimension to hold bone matrices
            // where a matrix takes up 4 texels:
            //   RGBA (Row 1), RGBA (Row 2), RGBA (Row 3), RGBA (Row 4)
            // So:
            //   8x8   holds: 64 / 4   = Up to 16 bones
            //   16x16 holds: 256 / 4  = Up to 64 bones
            //   32x32 holds: 1024 / 4 = Up to 256 bones
            //   64x64 holds: 4096 / 4 = Up to 1024 bones
            // Let's assume for now noone will create a hierarchy of more
            // than 1024 bones!
            var size;
            if (numBones > 256)
                size = 64;
            else if (numBones > 64)
                size = 32;
            else if (numBones > 16)
                size = 16;
            else
                size = 8;

            this.boneTexture = new pc.Texture(device, {
                width: size,
                height: size,
                format: pc.PIXELFORMAT_RGBA32F,
                mipmaps: false,
                minFilter: pc.FILTER_NEAREST,
                magFilter: pc.FILTER_NEAREST
            });
            this.matrixPalette = this.boneTexture.lock();
        } else {
            this.matrixPalette = new Float32Array(numBones * 16);
        }
        this.matrices = [];
        for(var i=0; i<numBones; i++) {
            this.matrices[i] = new pc.Mat4();
        }
    };

    SkinInstance.prototype = {

        updateMatrices: function () {

            var pos = this.rootNode.getPosition();
            for (var i = this.bones.length - 1; i >= 0; i--) {
                this.matrices[i].mul2(this.bones[i].getWorldTransform(), this.skin.inverseBindPose[i]);
                this.matrices[i].data[12] -= pos.x;
                this.matrices[i].data[13] -= pos.y;
                this.matrices[i].data[14] -= pos.z;
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

            // TODO: this is a bit strange looking. Change the Texture API to do a reupload
            if (this.skin.device.supportsBoneTextures) {
                this.boneTexture.lock();
                this.boneTexture.unlock();
            }
        }
    };

    return {
        Skin: Skin,
        SkinInstance: SkinInstance
    };
}());
