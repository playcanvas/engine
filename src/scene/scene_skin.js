pc.extend(pc.scene, function () {

    var Skin = function (ibp, boneNames) {
        // Constant between clones
        this.inverseBindPose = ibp;
        this.boneNames = boneNames;
    };

    var SkinInstance = function (skin) {
        this.skin = skin;

        // Unique per clone
        this.bones = [];

        var numBones = skin.inverseBindPose.length;
        this.matrixPalette = new Float32Array(numBones * 16);
    };

    SkinInstance.prototype = {
        updateMatrixPalette: (function () {
            var paletteEntry = new pc.Mat4();

            return function () {
                var pe = paletteEntry.data;
                var mp = this.matrixPalette;
                var base;

                for (var i = this.bones.length - 1; i >= 0; i--) {
                    // Calculate object to world to skin matrix
                    paletteEntry.mul2(this.bones[i].worldTransform, this.skin.inverseBindPose[i]);

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
            }
        }())
    };

    return {
        Skin: Skin,
        SkinInstance: SkinInstance
    }; 
}());