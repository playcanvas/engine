pc.extend(pc.fw, function () {
    // Private    
    function _onSet(entity, name, oldValue, newValue) {
        var component;
        var functions = {
            "asset": function (entity, name, oldValue, newValue) {
                if (newValue) {
                    this.loadAnimationAsset(entity, newValue);
                }                
            },
            "animation": function (entity, name, oldValue, newValue) {
                var componentData = this._getComponentData(entity);
                if (componentData.animation) {
                    delete componentData.animation;
                    delete componentData.skeleton;
                    componentData.animation = null;
                    componentData.skeleton = null;
                }
                if (newValue) {
                    var numAnimNodes = newValue.getNodes().length;
                    componentData.skeleton = new pc.anim.Skeleton(numAnimNodes);
                    componentData.skeleton.setLooping(componentData.loop);
                    componentData.skeleton.setAnimation(newValue);
                }
            },
            "loop":  function (entity, name, oldValue, newValue) {
                var componentData = this._getComponentData(entity);
                if (componentData.skeleton) {
                    componentData.skeleton.setLooping(newValue);
                }
            }
        };

        if(functions[name]) {
            functions[name].call(this, entity, name, oldValue, newValue);
        }
    };
    
    /**
     * @name pc.fw.AnimationComponentSystem
     * @constructor Create a new AnimationComponentSystem
     * @class Allows an Entity to render a model
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var AnimationComponentSystem = function AnimationComponentSystem (context) {
        context.systems.add("animation", this);

        this.bind("set", pc.callback(this, _onSet));
    };
    AnimationComponentSystem = AnimationComponentSystem.extendsFrom(pc.fw.ComponentSystem);

    AnimationComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.AnimationComponentData();
        var properties = ["asset", "loop"];
        data = data || {asset: []};

        this.addComponent(entity, componentData);

        properties.forEach(function(value, index, arr) {
            this.set(entity, value, data[value]);    
        }, this);

        return componentData;
    };
    
    AnimationComponentSystem.prototype.deleteComponent = function (entity) {
        var componentData = this._getComponentData(entity);

        delete componentData.animation;
        delete componentData.skeleton;
        
        this.removeComponent(entity);
    };
    
    AnimationComponentSystem.prototype.update = function (dt) {
        var components = this._getComponents();

        for (var id in components) {
            if (components.hasOwnProperty(id)) {
                var componentData = components[id].component;
                var skeleton = componentData.skeleton;
                if (skeleton !== null) {
                    var entity = components[id].entity;
                    var model = this.context.systems.model.get(entity, "model");
                    if (model) {
                        if (model !== componentData.model) {
                            skeleton.setGraph(model.getGraph());
                            componentData.model = model;
                        }
                        skeleton.addTime(dt * componentData.speed);
                        skeleton.updateGraph();
                    }
                }
            }
        }
    };
    
    AnimationComponentSystem.prototype.render = function (fn) {
        // Animations are not 'rendered'
    };
	
	AnimationComponentSystem.prototype.loadAnimationAsset = function (entity, guids) {
		var requests = guids.map(function (guid) {
			return new pc.resources.AssetRequest(guid);
		});
		var options = {
    		batch: entity.getRequestBatch()
    	};
    	
		this.context.loader.request(requests, function (resources) {
			var requests = guids.map(function (guid) {
				var asset = resources[guid];
				return new pc.resources.AnimationRequest(asset.getFileUrl());
			});
			this.context.loader.request(requests, function (resources) {
				// TODO: What happens when there is more than one animation?
				var animation = resources[requests[0].identifier];
				this.set(entity, "animation", animation);
			}.bind(this), function (errors) {
				
			}, function (progress) {
				
			}, options);
		}.bind(this), function (errors) {
			
		}, function (progress) {
			
		}, options);		
	}

    AnimationComponentSystem.prototype.getAnimation = function (entity) {
        return this._getComponentData(entity).animation;
    };

    return {
        AnimationComponentSystem: AnimationComponentSystem
    };
}());