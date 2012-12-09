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

    var MeshInstance = function (node, mesh, material) {
        this.node = node;           // The node that defines the transform of the mesh instance
        this.mesh = mesh;           // The mesh that this instance renders
        this.material = material;   // The material with which to render this instance

        // Render options
        this.renderStyle = pc.scene.RENDERSTYLE_SOLID;
        this.castShadow = false;
        this.receiveShadow = true;

        // 64-bit integer key that defines render order of this mesh instance
        this.key = material.id; 

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
                pc.math.mat4.multiply(this.bones[i].worldTransform,
                                      this.skin.inverseBindPose[i],
                                      this.matrixPaletteEntryF32[i]);
            }
        }
    }


    return {
        Mesh: Mesh,
        MeshInstance: MeshInstance,
        Skin: Skin,
        SkinInstance: SkinInstance
    }; 
}());