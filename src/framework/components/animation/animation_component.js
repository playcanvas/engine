pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.AnimationComponentSystem
     * @constructor Create a new AnimationComponentSystem
     * @class Allows an Entity to render a model
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var AnimationComponentSystem = function AnimationComponentSystem (context) {
        context.systems.add("animation", this);

        // Handle changes to the 'animations' value
        this.bind("set_animations", this.onSetAnimations.bind(this));
        // Handle changes to the 'assets' value
        this.bind("set_assets", this.onSetAssets.bind(this));
        // Handle changes to the 'loop' value
        this.bind("set_loop", this.onSetLoop.bind(this));
    };
    AnimationComponentSystem = AnimationComponentSystem.extendsFrom(pc.fw.ComponentSystem);

    AnimationComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.AnimationComponentData();

        this.initialiseComponent(entity, componentData, data, ['activate', 'loop', 'speed', 'assets']);

        return componentData;
    };

    AnimationComponentSystem.prototype.deleteComponent = function (entity) {
        var componentData = this.getComponentData(entity);

        delete componentData.animation;
        delete componentData.skeleton;
        delete componentData.fromSkel;
        delete componentData.toSkel;

        this.removeComponent(entity);
    };

    AnimationComponentSystem.prototype.onSetAnimations = function (entity, name, oldValue, newValue) {
        if (typeof newValue !== 'undefined') {
            var componentData = this.getComponentData(entity);
            for (var animName in componentData.animations) {
                // Create skeletons
                var animation = componentData.animations[animName];
                var numNodes = animation.getNodes().length;
                componentData.skeleton = new pc.anim.Skeleton(numNodes);
                componentData.fromSkel = new pc.anim.Skeleton(numNodes);
                componentData.toSkel = new pc.anim.Skeleton(numNodes);

                componentData.skeleton.setLooping(componentData.loop);

                // Set the first loaded animation as the current
                if (componentData.activate) {
                    this.setAnimation(entity, animName);
                }
                break;
            }
        }
    };

    AnimationComponentSystem.prototype.onSetAssets = function (entity, name, oldValue, newValue) {
        if (typeof newValue !== 'undefined') {
            this.loadAnimationAssets(entity, newValue);
        }
    };

    AnimationComponentSystem.prototype.onSetLoop = function (entity, name, oldValue, newValue) {
        if (typeof newValue !== 'undefined') {
            var componentData = this.getComponentData(entity);

            if (componentData.skeleton) {
                componentData.skeleton.setLooping(componentData.loop);
            }
        }
    };
    
    AnimationComponentSystem.prototype.update = function (dt) {
        var components = this._getComponents();

        for (var id in components) {
            if (components.hasOwnProperty(id)) {
                var componentData = components[id].component;
                if (componentData.playing) {
                    var skeleton = componentData.skeleton;
                    if (skeleton !== null) {
                        var entity = components[id].entity;
                        var model = this.context.systems.model.get(entity, 'model');
                        if (model) {
                            // If the model changes, retarget the skeleton to drive the new
                            // model hierarchy
                            if (model !== componentData.model) {
                                skeleton.setGraph(model.getGraph());
                                componentData.model = model;
                            }

                            if (componentData.blending) {
                                componentData.blendTimeRemaining -= dt;
                                if (componentData.blendTimeRemaining < 0.0) {
                                    componentData.blendTimeRemaining = 0.0;
                                }
                                var alpha = 1.0 - (componentData.blendTimeRemaining / componentData.blendTime);
                                skeleton.blend(componentData.fromSkel, componentData.toSkel, alpha);
                            } else {
                                // Advance the animation, interpolating keyframes at each animated node in
                                // skeleton
                                var delta = dt * componentData.speed;
                                skeleton.addTime(delta);
                                if ((skeleton.getCurrentTime() === skeleton.getAnimation().getDuration()) && !componentData.loop) {
                                    componentData.playing = false;
                                }
                            }

                            if (componentData.blending && (componentData.blendTimeRemaining === 0.0)) {
                                componentData.blending = false;
                                skeleton.setAnimation(componentData.toSkel.getAnimation());
                            }

                            skeleton.updateGraph();
                        }
                    }
                }
            }
        }
    };
	
	AnimationComponentSystem.prototype.loadAnimationAssets = function (entity, guids) {
	    if (!guids || !guids.length) {
	        return;
	    }
	    
		var requests = guids.map(function (guid) {
			return new pc.resources.AssetRequest(guid);
		});
		var options = {
    		batch: entity.getRequestBatch()
    	};

		this.context.loader.request(requests, function (assetResources) {
			var requests = guids.map(function (guid) {
				var asset = assetResources[guid];
				return new pc.resources.AnimationRequest(asset.getFileUrl());
			});
			var assetNames = guids.map(function (guid) {
				return assetResources[guid].name;
			});
			this.context.loader.request(requests, function (animResources) {
                var animations = {};
                for (var i = 0; i < requests.length; i++) {
                    animations[assetNames[i]] = animResources[requests[i].identifier];
                }
                this.set(entity, "animations", animations);
			}.bind(this), function (errors) {
				
			}, function (progress) {
				
			}, options);
		}.bind(this), function (errors) {
			
		}, function (progress) {
			
		}, options);		
	}

    /**
     * @function 
     * @name pc.fw.AnimationComponentSystem#setAnimation
     * @description Sets the currently playing animation on the specified entity.
     * @param {pc.fw.Entity} entity An Entity with a camera Component.
     * @param {String} name The name of the animation asset to set.
     * @param {Number} blendTime (Optional) The time in seconds to blend from the current
     * animation state to the start of the animation being set.
     */
    AnimationComponentSystem.prototype.setAnimation = function (entity, name, blendTime) {
        var componentData = this.getComponentData(entity);

        componentData.prevAnim = componentData.currAnim;
        componentData.currAnim = name;

        componentData.blending = blendTime > 0;
        if (componentData.blending) {
            // Blend from the current time of the current animation to the start of 
            // the newly specified animation over the specified blend time period.
            componentData.blendTime = blendTime;
            componentData.blendTimeRemaining = blendTime;
            componentData.fromSkel.setAnimation(componentData.animations[componentData.prevAnim]);
            componentData.fromSkel.addTime(componentData.skeleton.getCurrentTime());
            componentData.toSkel.setAnimation(componentData.animations[componentData.currAnim]);
            componentData.toSkel.addTime(0);
        } else {
            var animation = componentData.animations[componentData.currAnim];
            componentData.skeleton.setAnimation(animation);
        }

        if (componentData.model) {
            componentData.skeleton.setGraph(componentData.model.getGraph());
        }

        componentData.playing = true;
    };

    return {
        AnimationComponentSystem: AnimationComponentSystem
    };
}());