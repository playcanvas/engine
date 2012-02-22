pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.ModelComponentSystem
     * @constructor Create a new ModelComponentSystem
     * @class Allows an Entity to render a model
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var ModelComponentSystem = function ModelComponentSystem (context) {
        this.context = context;

        context.systems.add("model", this);

        // Handle changes to the 'asset' value
        this.bind("set_asset", this.onSetAsset.bind(this));
        // Handle changes to the 'castShadows' value
        this.bind("set_castShadows", this.onSetCastShadows.bind(this));
        // Handle changes to the 'model' value
        this.bind("set_model", this.onSetModel.bind(this));
        // Handle changes to the 'receiveShadows' value
        this.bind("set_receiveShadows", this.onSetReceiveShadows.bind(this));
    }
    ModelComponentSystem = ModelComponentSystem.extendsFrom(pc.fw.ComponentSystem);
    
    ModelComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.ModelComponentData();

        var attribs = ['asset', 'castShadows', 'receiveShadows'];
        this.initialiseComponent(entity, componentData, data, attribs);

        return componentData;
    };
    
    ModelComponentSystem.prototype.deleteComponent = function (entity) {
        this.set(entity, 'asset', null);
        this.removeComponent(entity);
    };
    
    ModelComponentSystem.prototype.getModel = function (entity) {
        return this.getComponentData(entity).model;
    };

    ModelComponentSystem.prototype.setVisible = function (entity, visible) {
        var model = this.getModel(entity);
        if (model) {
            var inScene = this.context.scene.containsModel(model);
            
            if (visible && !inScene) {
                this.context.scene.addModel(model);
            } else if (!visible && inScene) {
                this.context.scene.removeModel(model);
            }
        }
    };

    ModelComponentSystem.prototype.loadModelAsset = function(entity, guid) {
    	var request = new pc.resources.AssetRequest(guid);
    	var options = {
    		batch: entity.getRequestBatch()
    	};
		
    	this.context.loader.request(request, function (resources) {
            var asset = resources[guid];
            var url = asset.getFileUrl();
            this.context.loader.request(new pc.resources.ModelRequest(url), function (resources) {
                var model = resources[url];
                if (this.context.designer) {
                    var geometries = model.getGeometries();
                    for (var i = 0; i < geometries.length; i++) {
                        geometries[i].generateWireframe();
                    }
                }
                this.set(entity, "model", model);
            }.bind(this), function (errors, resources) {
                Object.keys(errors).forEach(function (key) {
                    logERROR(errors[key]);
                });
            }, function (progress) {
            }, options);
    	}.bind(this), function (errors, resources) {
    	    Object.keys(errors).forEach(function (key) {
    	        logERROR(errors[key]);
    	    });
    	}, function (progress) {
    		
    	}, options);
	};
    
    ModelComponentSystem.prototype.onSetAsset = function (entity, name, oldValue, newValue) {
        if(newValue) {
            this.loadModelAsset(entity, newValue);
        } else {
            this.set(entity, 'model', null);
        }
    }; 

    ModelComponentSystem.prototype.onSetCastShadows = function (entity, name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.getComponentData(entity);
            componentData.model.setCastShadows(newValue);
        }
    };

    ModelComponentSystem.prototype.onSetModel = function (entity, name, oldValue, newValue) {
        if (oldValue) {
            this.context.scene.removeModel(oldValue);
            entity.removeChild(oldValue.getGraph());
        }

        if (newValue) {
            var componentData = this.getComponentData(entity);
            newValue.setCastShadows(componentData.castShadows);
            newValue.setReceiveShadows(componentData.receiveShadows);

            entity.addChild(newValue.getGraph());
            this.context.scene.addModel(newValue);

            // Store the entity that owns this model
            newValue._entity = entity;

            // Update any animation component
            this.context.systems.animation.setModel(entity, newValue);
        }
    };

    ModelComponentSystem.prototype.onSetReceiveShadows = function (entity, name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.getComponentData(entity);
            componentData.model.setReceiveShadows(newValue);
        }
    };

    return {
        ModelComponentSystem: ModelComponentSystem
    }
}());

