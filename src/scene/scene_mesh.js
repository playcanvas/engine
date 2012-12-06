pc.extend(pc.scene, function () {

    var Mesh = function () {
        this.vertexBuffer = null;
        this.indexBuffer = [ null ];
        this.primitive = [{
        	type: 0,
        	base: 0,
        	count: 0
        }];
        this.skin = null;
    };

    var MeshInstance = function (mesh, material) {
        this.node = null;
        this.renderStyle = pc.scene.RENDERSTYLE_NORMAL;
        this.mesh = mesh;
        this.material = material;
        this.castShadow = false;
        this.receiveShadow = true;
        this.key = material.id; // 64-bit integer key
        this.skinInstance = null;
    };

    /*
    Object.defineProperty(MeshInstance.prototype, 'renderStyle', {
        get: function () { return this.renderStyle; },
        set: function (style) {
            this.renderStyle = style;
            this.mesh = this.meshes[this.renderStyle];
        }
    });
    */

    var Skin = function (ibp, boneNames) {
        // Constant between clones
        this.inverseBindPose = ibp;
        this.boneNames = boneNames;
    };

    var SkinInstance = function (skin) {
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

    return {
        Mesh: Mesh,
        MeshInstance: MeshInstance,
        Skin: Skin,
        SkinInstance: SkinInstance
    }; 
}());