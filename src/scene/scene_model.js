pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.Model
     * @class A model.
     */
	var Model = function Model() {
	    this._textures   = [];
	    this._materials  = [];
	    this._geometries = [];
	    this._skins      = [];

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

    /**
     * @function
     * @name pc.scene.Model#clone
     * @description Clones a model. The returned model has a newly created hierarchy
     * but actually just references the geometries of the model being cloned. This is
     * a very memory efficient way of generating lots of copies of a model at runtime.
     * The caveat is that modifications to the cloned model's geometries, submeshes,
     * materials or textures will actually also modify the source model (and vice versa).
     * @returns {pc.scene.Model} A cloned Model.
     * @author Will Eastcott
     */
	Model.prototype.clone = function () {
        var clone = new pc.scene.Model();

        clone._textures = this._textures.slice(0);
        clone._materials = this._materials.slice(0);
        clone._geometries = this._geometries.slice(0);

        for (var i = 0; i < this._skins.length; i++) {
        	clone._skins.push(this._skins[i].clone());
        }

        var _duplicate = function (node) {
            var newNode = node.clone();

            if (node instanceof pc.scene.CameraNode)
                clone.getCameras().push(newNode);
            else if (node instanceof pc.scene.LightNode)
                clone.getLights().push(newNode);
            else if (node instanceof pc.scene.MeshNode)
                clone.getMeshes().push(newNode);

            var children = node.getChildren();
            for (var i = 0; i < children.length; i++) {
                newNode.addChild(_duplicate(children[i]));
            }

            return newNode;
        }

        clone.setGraph(_duplicate(this.getGraph()));

        // Resolve bone IDs to actual graph nodes
        clone.resolveBoneNames();

        clone.getGraph().syncHierarchy();
        var meshes = clone.getMeshes();
        for (var i = 0; i < meshes.length; i++) {
  //          meshes[i].syncAabb();
        }

        return clone;
    };

	Model.prototype.resolveBoneNames = function () {
		var i, j;

        var skins = this._skins;
        var graph = this.getGraph();
        for (i = 0; i < skins.length; i++) {
            var skin = skins[i];
            skin.bones = [];
            for (j = 0; j < skin.boneNames.length; j++) {
                var id = skin.boneNames[j];
                var bone = graph.findByName(id);
                skin.bones.push(bone);
            }
        }
    };

	return {
		Model: Model
	};
}());