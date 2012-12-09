pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.Model
     * @class A model.
     */
    var Model = function Model() {
        this.textures   = [];
        this.materials  = [];
        this.geometries = [];
        this.skins      = [];

        this.skinInstances = [];
        this.meshInstances = [];

        this.cameras    = [];
        this.lights     = [];
        this.meshes     = [];
        this.graph      = null;
	}

	Model.prototype.getGraph = function () {
	    return this.graph;
	};
	
	Model.prototype.setGraph = function (graph) {
	    this.graph = graph;
	};
	
	Model.prototype.getCameras = function () {
	    return this.cameras;
	};
	
	Model.prototype.setCameras = function (cameras) {
	    this.cameras = cameras;
	};
	
	Model.prototype.getLights = function () {
	    return this.lights;
	};
	
	Model.prototype.setLights = function (lights) {
	    this.lights = lights;
	};
	
	Model.prototype.getMeshes = function () {
	    return this.meshes;
	};
	
	Model.prototype.setMeshes = function (meshes) {
	    this.meshes = meshes;
	};
	
	Model.prototype.getTextures = function () {
	    return this.textures;
	};
	
	Model.prototype.setTextures = function (textures) {
	    this.textures = textures;
	};
	
	Model.prototype.getMaterials = function () {
	    return this.materials;
	};
	
	Model.prototype.setMaterials = function (materials) {
	    this.materials = materials;
	};
	
	Model.prototype.getGeometries = function () {
	    return this.geometries;
	};
	
	Model.prototype.setGeometries = function (geometries) {
	    this.geometries = geometries;
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

        clone.textures = this.textures.slice(0);
        clone.materials = this.materials.slice(0);
        clone.geometries = this.geometries.slice(0);
        clone.skins = this.skins.slice(0);

        for (var i = 0; i < this.skins.length; i++) {
        	clone.skinInstances.push(new pc.scene.SkinInstance(clone.skins[i]));
        }

        var self = this;

        var _duplicate = function (node) {
            var newNode = node.clone();

            if (node instanceof pc.scene.CameraNode)
                clone.getCameras().push(newNode);
            else if (node instanceof pc.scene.LightNode)
                clone.getLights().push(newNode);
            else if (node instanceof pc.scene.MeshNode) {
                clone.getMeshes().push(newNode);
                for (var i = 0; i < node.meshInstances.length; i++) {
                	if (node.meshInstances[i].skinInstance) {
	                	newNode.meshInstances[i].skinInstance = clone.skinInstances[self.skinInstances.indexOf(node.meshInstances[i].skinInstance)];
                	}
                }
            }

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

        var skins = this.skins;
        var skinInstances = this.skinInstances;
        var graph = this.getGraph();
        for (i = 0; i < skins.length; i++) {
            var skin = skins[i];
            var skinInstance = skinInstances[i];
            skinInstance.bones = [];
            for (j = 0; j < skin.boneNames.length; j++) {
                var boneName = skin.boneNames[j];
                var bone = graph.findByName(boneName);
                skinInstance.bones.push(bone);
            }
        }
    };

	return {
		Model: Model
	};
}());