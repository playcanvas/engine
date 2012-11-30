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
};