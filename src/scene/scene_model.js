pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.Model
     * @class A model.
     */
    var Model = function Model() {
        this.textures   = [];
        this.materials  = [];
        this.skins      = [];

        this.skinInstances = [];
        this.meshInstances = [];

        this.cameras    = [];
        this.lights     = [];
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
        clone.skins = this.skins.slice(0);
/*
            else if (node instanceof pc.scene.MeshNode) {
                clone.getMeshes().push(newNode);
                for (var i = 0; i < node.meshInstances.length; i++) {
                    if (node.meshInstances[i].skinInstance) {
                        newNode.meshInstances[i].skinInstance = clone.skinInstances[self.skinInstances.indexOf(node.meshInstances[i].skinInstance)];
                    }
                }
            }
*/
        // Duplicate the node hierarchy
        var srcNodes = [];
        var cloneNodes = [];

        var _duplicate = function (node) {
            var newNode = node.clone();

            srcNodes.push(node);
            cloneNodes.push(newNode);

            if (node instanceof pc.scene.CameraNode)
                clone.cameras.push(newNode);
            else if (node instanceof pc.scene.LightNode)
                clone.lights.push(newNode);

            var children = node.getChildren();
            for (var i = 0; i < children.length; i++) {
                newNode.addChild(_duplicate(children[i]));
            }

            return newNode;
        }
        clone.graph = _duplicate(this.graph);

        // Clone the mesh instances
        for (var i = 0; i < this.meshInstances.length; i++) {
            var meshInstance = this.meshInstances[i];
            var nodeIndex = srcNodes.indexOf(meshInstance.node);
            var cloneInstance = new pc.scene.MeshInstance(cloneNodes[nodeIndex], meshInstance.mesh, meshInstance.material);
            clone.meshInstances.push(cloneInstance);
        }

        // Resolve bone IDs to actual graph nodes
        clone.resolveBoneNames();

        clone.getGraph().syncHierarchy();

        var meshInstances = clone.meshInstances;
        for (i = 0; i < meshInstances.length; i++) {
            meshInstances[i].syncAabb();
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