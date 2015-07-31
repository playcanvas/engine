pc.extend(pc, function () {
    /**
    * @component Animation
    * @name pc.AnimationComponent
    * @constructor Create a new AnimationComponent
    * @class The Animation Component allows an Entity to playback animations on models
    * @param {pc.AnimationComponentSystem} system The {@link pc.ComponentSystem} that created this Component
    * @param {pc.Entity} entity The Entity that this Component is attached to
    * @extends pc.Component
    * @property {Boolean} enabled If false no animation will be played
    * @property {Number} speed Speed multiplier for animation play back speed. 1.0 is playback at normal speed, 0.0 pauses the animation
    * @property {Boolean} loop If true the animation will restart from the beginning when it reaches the end
    * @property {Boolean} activate If true the first animation asset will begin playing when the Pack is loaded
    * @property {[pc.Asset]} assets The array of animation assets - can also be an array of asset ids.
    * @property {Number} currentTime Get or Set the current time position (in seconds) of the animation
    * @property {Number} duration Get the duration in seconds of the current animation.
    */
    var AnimationComponent = function (system, entity) {
        // Handle changes to the 'animations' value
        this.on('set_animations', this.onSetAnimations, this);
        // Handle changes to the 'assets' value
        this.on('set_assets', this.onSetAssets, this);
        // Handle changes to the 'loop' value
        this.on('set_loop', this.onSetLoop, this);
    };
    AnimationComponent = pc.inherits(AnimationComponent, pc.Component);

    pc.extend(AnimationComponent.prototype, {
        /**
         * @function
         * @name pc.AnimationComponent#play
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

            if (!this.enabled || !this.entity.enabled) {
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
        * @name pc.AnimationComponent#getAnimation
        * @description Return an animation
        * @param {String} name The name of the animation asset
        * @returns {pc.Animation} An Animation
        */
        getAnimation: function (name) {
            return this.data.animations[name];
        },

        setModel: function (model) {
            var data = this.data;
            if (model) {
                // Create skeletons
                var graph = model.getGraph();
                data.fromSkel = new pc.Skeleton(graph);
                data.toSkel = new pc.Skeleton(graph);
                data.skeleton = new pc.Skeleton(graph);
                data.skeleton.setLooping(data.loop);
                data.skeleton.setGraph(graph);
            }
            data.model = model;

            // Reset the current animation on the new model
            if (data.animations && data.currAnim && data.animations[data.currAnim]) {
                this.play(data.currAnim);
            }
        },

        loadAnimationAssets: function (ids) {
            if (!ids || !ids.length) {
                return;
            }

            var self = this;
            var assets = this.system.app.assets;
            var i;
            var l = ids.length;

            // var animations = {};
            for(i = 0; i < l; i++) {
                var asset =  assets.get(ids[i]);
                if (asset) {
                    asset.off('change', self.onAssetChanged, self);
                    asset.on('change', self.onAssetChanged, self);

                    asset.off('remove', self.onAssetRemoved, self);
                    asset.on('remove', self.onAssetRemoved, self);

                    asset.ready(function (asset) {
                        self.animations[asset.name] = asset.resource;
                        self.animations = self.animations; // assigning ensures set_animations event is fired
                    });
                    assets.load(asset);
                } else {
                    assets.on("add:" + ids[i], function (asset) {
                        asset.off('change', self.onAssetChanged, self);
                        asset.on('change', self.onAssetChanged, self);

                        asset.off('remove', self.onAssetRemoved, self);
                        asset.on('remove', self.onAssetRemoved, self);

                        asset.ready(function (asset) {
                            self.animations[asset.name] = asset.resource;
                            self.animations = self.animations; // assigning ensures set_animations event is fired
                        });
                        assets.load(asset);
                    });
                }
            }

        },

        // loadAnimationAssets: function (ids) {
        //     if (!ids || !ids.length) {
        //         return;
        //     }

        //     var options = {
        //         parent: this.entity.getRequest()
        //     };

        //     var assets = ids.map(function (id) {
        //         return this.system.app.assets.get(id);
        //     }, this);

        //     var animations = {};

        //     var names = [];
        //     var requests = [];

        //     for (var i=0, len=assets.length; i<len; i++) {
        //         var asset = assets[i];
        //         if (!asset) {
        //             logERROR(pc.string.format('Trying to load animation component before assets {0} are loaded', ids));
        //         } else {

        //             // subscribe to change event so that we reload the animation if necessary
        //             asset.off('change', this.onAssetChanged, this);
        //             asset.on('change', this.onAssetChanged, this);

        //             asset.off('remove', this.onAssetRemoved, this);
        //             asset.on('remove', this.onAssetRemoved, this);

        //             // if the asset is in the cache try to load it synchronously
        //             if (asset.resource) {
        //                 animations[asset.name] = asset.resource;
        //             } else {
        //                 // otherwise create an async request
        //                 names.push(asset.name);
        //                 requests.push(new pc.resources.AnimationRequest(asset.getFileUrl()));
        //             }
        //         }
        //     }

        //     if (requests.length) {
        //         this.system.app.loader.request(requests, options).then(function (animResources) {
        //             for (var i = 0; i < requests.length; i++) {
        //                 animations[names[i]] = animResources[i];
        //             }
        //             this.animations = animations;
        //         }.bind(this));
        //     } else {
        //         this.animations = animations;
        //     }
        // },

        onAssetChanged: function (asset, attribute, newValue, oldValue) {
            if (attribute === 'resource') {
                // replace old animation with new one
                if (newValue) {
                    this.animations[asset.name] = newValue;
                    if (this.data.currAnim === asset.name) {
                        // restart animation
                        if (this.data.playing && this.data.enabled && this.entity.enabled)  {
                            this.play(asset.name, 0);
                        }
                    }
                } else {
                    delete this.animations[asset.name];
                }
            }
        },

        onAssetRemoved: function (asset) {
            asset.off('remove', this.onAssetRemoved, this);

            if (this.animations && this.animations[asset.name]) {
                delete this.animations[asset.name];
                if (this.data.currAnim === asset.name) {
                    this._stopCurrentAnimation();
                }
            }
        },

        _stopCurrentAnimation: function () {
            this.data.currAnim = null;
            this.data.playing = false;
            if (this.data.skeleton) {
                this.data.skeleton.setCurrentTime(0);
                this.data.skeleton.setAnimation(null);
            }
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
                if (data.activate && data.enabled && this.entity.enabled && !this.system._inTools) {
                    this.play(animName, 0);
                }
                break;
            }
        },

        onSetAssets: function (name, oldValue, newValue) {
            if (oldValue && oldValue.length) {
                for (var i = 0; i < oldValue.length; i++) {
                    // unsubscribe from change event for old assets
                    if (oldValue[i]) {
                        var asset = this.system.app.assets.get(oldValue[i]);
                        if (asset) {
                            asset.off('change', this.onAssetChanged, this);
                            asset.off('remove', this.onAssetRemoved, this);

                            if (this.data.currAnim === asset.name) {
                                this._stopCurrentAnimation();
                            }
                        }
                    }
                }
            }

            var ids = newValue.map(function (value) {
                if (value instanceof pc.Asset) {
                    return value.id;
                } else {
                    return value;
                }
            })
            this.loadAnimationAssets(ids);
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
        },

        onEnable: function () {
            AnimationComponent._super.onEnable.call(this);
            if ( this.data.activate &&
                 !this.data.currAnim &&
                 !this.system._inTools) {

                for (var animName in this.data.animations) {
                    this.play(animName, 0);
                    break;
                }
            }
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
