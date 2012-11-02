pc.extend(pc.fw, function () {
    var AnimationComponent = function () {
        var schema = [{
            name: "assets",
            displayName: "Asset",
            description: "Animation Asset",
            type: "asset",
            options: {
                max: 100
            },
            defaultValue: null
        }, {
            name: "speed",
            displayName: "Speed Factor",
            description: "Scale the animation playback speed",
            type: "number",
            options: {
                min: 0.0,
                step: 0.1
            },
            defaultValue: 1.0
        }, {
            name: "loop",
            displayName: "Loop",
            description: "Loop the animation back to the start on completion",
            type: "boolean",
            defaultValue: true
        }, {
            name: "activate",
            displayName: "Activate",
            description: "Play the configured animation on load",
            type: "boolean",
            defaultValue: true
        }, {
            name: "animations",
            exposed: false,
        }, {
            name: "skeleton",
            exposed: false,
        }, {
            name: "model",
            exposed: false,
        }, {
            name: "prevAnim",
            exposed: false,
        }, {
            name: "currAnim",
            exposed: false,
        }, {
            name: "fromSkel",
            exposed: false,
        }, {
            name: "toSkel",
            exposed: false,
        }, {
            name: "blending",
            exposed: false,
        }, {
            name: "blendTime",
            exposed: false,
        }, {
            name: "blendTimeRemaining",
            exposed: false,
        }, {
            name: "playing",
            exposed: false,
        }];

        this.assignSchema(schema);

        // Handle changes to the 'animations' value
        this.bind('set_animations', this.onSetAnimations.bind(this));
        // Handle changes to the 'assets' value
        this.bind('set_assets', this.onSetAssets.bind(this));
        // Handle changes to the 'loop' value
        this.bind('set_loop', this.onSetLoop.bind(this));

    };
    AnimationComponent = pc.inherits(AnimationComponent, pc.fw.Component);

    pc.extend(AnimationComponent.prototype, {
        /**
         * @function 
         * @name pc.fw.AnimationComponentSystem#play
         * @description Sets the currently playing animation on the specified entity.
         * @param {pc.fw.Entity} entity An Entity with a camera Component.
         * @param {String} name The name of the animation asset to set.
         * @param {Number} blendTime (Optional) The time in seconds to blend from the current
         * animation state to the start of the animation being set.
         */
        play: function (name, blendTime) {
            var data = this.data;

            data.prevAnim = data.currAnim;
            data.currAnim = name;

            if (data.model) {
                data.blending = blendTime > 0;
                if (data.blending) {
                    // Blend from the current time of the current animation to the start of 
                    // the newly specified animation over the specified blend time period.
                    data.blendTime = blendTime;
                    data.blendTimeRemaining = blendTime;
                    data.fromSkel.setAnimation(data.animations[data.prevAnim]);
                    data.fromSkel.addTime(data.skeleton.getCurrentTime());
                    data.toSkel.setAnimation(data.animations[data.currAnim]);
                    data.toSkel.addTime(0);
                } else {
                    data.skeleton.setAnimation(data.animations[data.currAnim]);
                }
            }

            data.playing = true;
        },
        
        getAnimation: function (name) {
            return this.data.animations[name];
        },
        
        setModel: function (model) {
            var data = this.data;
            if (model) {
                // Create skeletons
                var graph = model.getGraph();
                data.fromSkel = new pc.anim.Skeleton(graph);
                data.toSkel = new pc.anim.Skeleton(graph);
                data.skeleton = new pc.anim.Skeleton(graph);
                data.skeleton.setLooping(data.loop);
                data.skeleton.setGraph(graph);
            }
            data.model = model;

            // Reset the current animation on the new model
            if (data.animations && data.currAnim && data.animations[data.currAnim]) {
                this.play(data.currAnim);
            }
        },

        loadAnimationAssets: function (guids) {
            if (!guids || !guids.length) {
                return;
            }
            
            var requests = guids.map(function (guid) {
                return new pc.resources.AssetRequest(guid);
            });
            var options = {
                batch: this.entity.getRequestBatch()
            };

            this.system.context.loader.request(requests, function (assetResources) {
                var requests = guids.map(function (guid) {
                    var asset = assetResources[guid];
                    return new pc.resources.AnimationRequest(asset.getFileUrl());
                });
                var assetNames = guids.map(function (guid) {
                    return assetResources[guid].name;
                });
                this.system.context.loader.request(requests, function (animResources) {
                    var animations = {};
                    for (var i = 0; i < requests.length; i++) {
                        animations[assetNames[i]] = animResources[requests[i].identifier];
                    }
                    this.animations = animations;
                    //this.set(entity, 'animations', animations);
                }.bind(this), function (errors) {
                    
                }, function (progress) {
                    
                }, options);
            }.bind(this), function (errors) {
                
            }, function (progress) {
                
            }, options);        
        },

        onSetAnimations: function (oldValue, newValue) {
            if (newValue === undefined) {
                var data = this.data;
                var name;
                for (name in data.animations) {
                    // Set the first loaded animation as the current
                    if (data.activate) {
                        this.play(entity, name);
                    }
                    break;
                }
            }
        },
        onSetAssets: function (oldValue, newValue) {
            if (pc.isDefined(newValue)) {
                this.loadAnimationAssets(newValue);
            }
        },
        onSetLoop: function (oldValue, newValue) {
            if (pc.isDefined(newValue)) {
                if (this.data.skeleton) {
                    this.data.skeleton.setLooping(this.data.loop);
                }
            }

        },
        onSetCurrentTime: function (oldValue, newValue) {
            this.data.skeleton.setCurrentTime(newValue);
            this.data.skeleton.addTime(0); // update
            this.data.skeleton.updateGraph();
        }
    });

    return {
        AnimationComponent: AnimationComponent
    };
}());