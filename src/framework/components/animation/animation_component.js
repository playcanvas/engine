pc.extend(pc.fw, function () {
    /**
    * @component Animation
    * @name pc.fw.AnimationComponent
    * @constructor Create a new AnimationComponent
    * @class The Animation Component allows an Entity to playback animations on models
    * @param {pc.fw.AnimationComponentSystem} system The {@link pc.fw.ComponentSystem} that created this Component
    * @param {pc.fw.Entity} entity The Entity that this Component is attached to
    * @extends pc.fw.Component
    * @property {Number} speed Speed multiplier for animation play back speed. 1.0 is playback at normal speed, 0.0 pauses the animation
    * @property {Boolean} loop If true the animation will restart from the beginning when it reaches the end
    * @property {Boolean} activate If true the first animation asset will begin playing when the Pack is loaded
    * @property {Array} assets The array of animation assets
    */
    var AnimationComponent = function (system, entity) {
        // Handle changes to the 'animations' value
        this.on('set_animations', this.onSetAnimations, this);
        // Handle changes to the 'assets' value
        this.on('set_assets', this.onSetAssets, this);
        // Handle changes to the 'loop' value
        this.on('set_loop', this.onSetLoop, this);
    };
    AnimationComponent = pc.inherits(AnimationComponent, pc.fw.Component);

    pc.extend(AnimationComponent.prototype, {
        /**
         * @function 
         * @name pc.fw.AnimationComponent#play
         * @description Start playing an animation
         * @param {String} name The name of the animation asset to begin playing.
         * @param {Number} [blendTime] The time in seconds to blend from the current 
         * animation state to the start of the animation being set.
         */
        play: function (name, blendTime) {
            if (!this.data.animations[name]) {
                console.error(pc.string.format("Trying to play animation '{0}' which doesn't exist", name));
                return;
            }

            blendTime = blendTime || 0;
            
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
                } else {
                    data.skeleton.setAnimation(data.animations[data.currAnim]);
                }
            }

            data.playing = true;
        },

        /**
        * @function
        * @name pc.fw.AnimationComponent#getAnimation
        * @description Return an animation
        * @param {String} name The name of the animation asset
        * @returns {pc.anim.Animation} An Animation
        */
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
            
            var options = {
                parent: this.entity.getRequest()
            };

            var assets = guids.map(function (guid) {
                return this.system.context.assets.getAsset(guid);
            }, this);

            var names = [];
            var requests = assets.map(function (asset) {
                if (!asset) {
                    logERROR(pc.string.format('Trying to load animation component before assets {0} are loaded', guids));
                } else {
                    names.push(asset.name);
                    return new pc.resources.AnimationRequest(asset.getFileUrl());    
                }
            });

            this.system.context.loader.request(requests, options).then(function (animResources) {
                var animations = {};
                for (var i = 0; i < requests.length; i++) {
                    animations[names[i]] = animResources[i];
                }
                this.animations = animations;
            }.bind(this));
        },

        onSetAnimations: function (name, oldValue, newValue) {
            var data = this.data;

            // If we have animations _and_ a model, we can create the skeletons
            var modelComponent = this.entity.model;
            if (modelComponent) {
                var m = modelComponent.model;
                if (m) {
                    this.entity.animation.setModel(m);
                }
            }

            for (var animName in data.animations) {
                // Set the first loaded animation as the current
                if (data.activate) {
                    this.play(animName, 0);
                }
                break;
            }
        },
        onSetAssets: function (name, oldValue, newValue) {
            this.loadAnimationAssets(newValue);
        },
        
        onSetLoop: function (name, oldValue, newValue) {
            if (this.data.skeleton) {
                this.data.skeleton.setLooping(this.data.loop);
            }
        },

        onSetCurrentTime: function (name, oldValue, newValue) {
            this.data.skeleton.setCurrentTime(newValue);
            this.data.skeleton.addTime(0); // update
            this.data.skeleton.updateGraph();
        }
    });

    Object.defineProperties(AnimationComponent.prototype, {
        currentTime: {
            get: function () {
                return this.data.skeleton.getCurrentTime();
            },
            set: function (currentTime) {
                this.data.skeleton.setCurrentTime(currentTime);
                this.data.skeleton.addTime(0);
                this.data.skeleton.updateGraph();                
            }
        },
        duration: {
            get: function () {
                return this.data.animations[this.data.currAnim].getDuration();
            }
        }
    });

    return {
        AnimationComponent: AnimationComponent
    };
}());