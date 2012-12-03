pc.scene.MeshInstance = function MeshInstance(mesh, material) {
	this.node = null; // or could store the ref to the mesh node's transform...
	this.mesh = mesh;
	this.material = material;
    this.castShadow = false;
    this.receiveShadow = true;
	this.key = material.id; // 64-bit integer key
};

pc.scene.Mesh = function Mesh() {
	this.indexBuffer = null;
	this.vertexBuffer = null;
	this.base = 0;
	this.count = 0;
	this.primType = 0;
	this.indexed = false;
	this.skin = null;
};

pc.scene.Skin = function Skin(ibp, boneNames) {
	// Constant between clones
    this.inverseBindPose = ibp;
    this.boneNames = boneNames;

    // Unique per clone
    this.bones = [];

    this.matrixPalette = new ArrayBuffer(ibp.length * 16 * 4);
    this.matrixPaletteF32 = new Float32Array(this.matrixPalette);
    this.matrixPaletteEntryF32 = [];
    for (var i = 0, len = ibp.length; i < len; i++) {
        this.matrixPaletteEntryF32[i] = new Float32Array(this.matrixPalette, i * 16 * 4, 16);
    }
}

pc.scene.Skin.prototype.clone = function () {
	var ibp = [];
	for (var i = 0; i < this.inverseBindPose.length; i++) {
		ibp.push(pc.math.mat4.clone(this.inverseBindPose[i]));
	}
	var boneNames = this.boneNames.slice(0);
	return new pc.scene.Skin(ibp, boneNames);
}