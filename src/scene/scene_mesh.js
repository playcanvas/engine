pc.scene.Mesh = function Mesh() {
	this.indexBuffer = null;
	this.vertexBuffer = null;
	this.base = 0;
	this.count = 0;
	this.primType = 0;
	this.skin = null;
};

pc.scene.MeshInstance = function MeshInstance(mesh, material) {
	this.node = null; // or could store the ref to the mesh node's transform...
	this.mesh = mesh;
	this.material = material;
    this.castShadow = false;
    this.receiveShadow = true;
	this.key = material.id; // 64-bit integer key
	this.skinInstance = null;
};

pc.scene.Skin = function Skin(ibp, boneNames) {
	// Constant between clones
    this.inverseBindPose = ibp;
    this.boneNames = boneNames;
};

pc.scene.SkinInstance = function SkinInstance(skin) {
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
