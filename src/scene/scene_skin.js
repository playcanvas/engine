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
        this.matrixPalette = new ArrayBuffer(numBones * 16 * 4);
        this.matrixPaletteF32 = new Float32Array(this.matrixPalette);
        this.matrixPaletteEntryF32 = [];
        for (var i = 0, len = numBones; i < len; i++) {
            this.matrixPaletteEntryF32[i] = new Float32Array(this.matrixPalette, i * 16 * 4, 16);
        }
    };

    SkinInstance.prototype = {
        updateMatrixPalette: function () {
            for (var i = this.bones.length - 1; i >= 0; i--) {
                this.matrixPaletteEntryF32[i].mul(this.bones[i].worldTransform, this.skin.inverseBindPose[i]);
            }
        }
    };

    return {
        Skin: Skin,
        SkinInstance: SkinInstance
    }; 
}());