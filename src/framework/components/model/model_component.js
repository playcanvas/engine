pc.extend(pc.fw, function () {
    // Private    
    function _onSet(entity, name, oldValue, newValue) {
        var component;
        var functions = {
            "asset": function (entity, name, oldValue, newValue) {
                var componentData = this._getComponentData(entity);
                if(componentData.model) {
                    this.context.scene.removeModel(componentData.model);
                    entity.removeChild(componentData.model.getGraph());
                    delete componentData.model;
                    componentData.model = null;
                }
                if(newValue) {
                    this.loadModelAsset(entity, newValue);
                }
            },
            "model": function(entity, name, oldValue, newValue) {
                if(newValue) {
                    entity.addChild(newValue.getGraph());
                    this.context.scene.addModel(newValue);
                }
            }
        };
        
        if(functions[name]) {
            functions[name].call(this, entity, name, oldValue, newValue);
        }
    }
    
    /**
     * @name pc.fw.ModelComponentSystem
     * @constructor Create a new ModelComponentSystem
     * @class Allows an Entity to render a model
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var ModelComponentSystem = function ModelComponentSystem (context) {
        context.systems.add("model", this);
        this.bind("set", pc.callback(this, _onSet));
    }
    ModelComponentSystem = ModelComponentSystem.extendsFrom(pc.fw.ComponentSystem);
    
    ModelComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.ModelComponentData();
        var properties = ["asset"];
        data = data || {asset: null};

        this.addComponent(entity, componentData);

        properties.forEach(function(value, index, arr) {
            this.set(entity, value, data[value]);
        }, this);

        return componentData;
    };
    
    ModelComponentSystem.prototype.deleteComponent = function (entity) {
        var component = this._getComponentData(entity);
        this.context.scene.removeModel(component.model);
        //pc.fw.loader.json.close(component.model.getGraph().getUniqueID(), entity, this.context.components)
    
        if(component.model) {
            entity.removeChild(component.model.getGraph());
            component.model = null;
        }
    
        this.removeComponent(entity);
    };
    
    ModelComponentSystem.prototype.render = function (fn) {
        var id;
        var entity;
        var component;
        var position;
        var components = this._getComponents();
        var transform;
        
        for (id in components) {
            if (components.hasOwnProperty(id)) {
                entity = components[id].entity;
                component = components[id].component;
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
    				this.set(entity, "model", resources[url]);
    			}.bind(this), function (errors) {
		    		logERROR(errors);
    			}, function (progress) {
    			}, options);
    			
    	}.bind(this), function (errors) {
    		logERROR(errors);
    	}, function (progress) {
    		
    	}, options);
	};

    ModelComponentSystem.prototype.getModel = function (entity) {
        return this._getComponentData(entity).model;
    };
    
    
    return {
        ModelComponentSystem: ModelComponentSystem
    }
}());

