pc.extend(pc.scene, function () {
	var Model = function Model() {
	    this._textures   = [];
	    this._materials  = [];
	    this._geometries = [];
	
	    this._cameras    = [];
	    this._lights     = [];
	    this._meshes     = [];
	    this._graph      = null;
	}

	Model.prototype.getGraph = function () {
	    return this._graph;
	};
	
	Model.prototype.setGraph = function (graph) {
	    this._graph = graph;
	};
	
	Model.prototype.getCameras = function () {
	    return this._cameras;
	};
	
	Model.prototype.setCameras = function (cameras) {
	    this._cameras = cameras;
	};
	
	Model.prototype.getLights = function () {
	    return this._lights;
	};
	
	Model.prototype.setLights = function (lights) {
	    this._lights = lights;
	};
	
	Model.prototype.getMeshes = function () {
	    return this._meshes;
	};
	
	Model.prototype.setMeshes = function (meshes) {
	    this._meshes = meshes;
	};
	
	Model.prototype.getTextures = function () {
	    return this._textures;
	};
	
	Model.prototype.setTextures = function (textures) {
	    this._textures = textures;
	};
	
	Model.prototype.getMaterials = function () {
	    return this._materials;
	};
	
	Model.prototype.setMaterials = function (materials) {
	    this._materials = materials;
	};
	
	Model.prototype.getGeometries = function () {
	    return this._geometries;
	};
	
	Model.prototype.setGeometries = function (geometries) {
	    this._geometries = geometries;
	};
	
	Model.prototype.dispatch = function () {
	    var i, len;
	    for (i = 0, len = this._meshes.length; i < len; i++) {
	        this._meshes[i].dispatch();
	    }
	};
	
	return {
		Model: Model
	};
}());


