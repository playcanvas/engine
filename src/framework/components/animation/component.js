Object.assign(pc, function () {
    /**
     * @component Animation
     * @class
     * @name pc.AnimationComponent
     * @augments pc.Component
     * @classdesc The Animation Component allows an Entity to playback animations on models.
     * @description Create a new AnimationComponent.
     * @param {pc.AnimationComponentSystem} system - The {@link pc.ComponentSystem} that created this Component.
     * @param {pc.Entity} entity - The Entity that this Component is attached to.
     * @property {number} speed Speed multiplier for animation play back speed. 1.0 is playback at normal speed, 0.0 pauses the animation.
     * @property {boolean} loop If true the animation will restart from the beginning when it reaches the end.
     * @property {boolean} activate If true the first animation asset will begin playing when the scene is loaded.
     * @property {pc.Asset[]|number[]} assets The array of animation assets - can also be an array of asset ids.
     * @property {number} currentTime Get or Set the current time position (in seconds) of the animation.
     * @property {number} duration Get the duration in seconds of the current animation.
     */
    var AnimationComponent = function (system, entity) {
        pc.Component.call(this, system, entity);

        this.animationsIndex = { };

        // Handle changes to the 'animations' value
        this.on('set_animations', this.onSetAnimations, this);
        // Handle changes to the 'assets' value
        this.on('set_assets', this.onSetAssets, this);
        // Handle changes to the 'loop' value
        this.on('set_loop', this.onSetLoop, this);
    };
    AnimationComponent.prototype = Object.create(pc.Component.prototype);
    AnimationComponent.prototype.constructor = AnimationComponent;

    Object.assign(AnimationComponent.prototype, {
        /**
         * @function
         * @name pc.AnimationComponent#play
         * @description Start playing an animation.
         * @param {string} name - The name of the animation asset to begin playing.
         * @param {number} [blendTime] - The time in seconds to blend from the current
         * animation state to the start of the animation being set.
         */
        play: function (name, blendTime) {

            if (!this.enabled || !this.entity.enabled) {
                return;
            }

            var data = this.data;

            if (!data.animations[name]) {
                // #ifdef DEBUG
                console.error(pc.string.format("Trying to play animation '{0}' which doesn't exist", name));
                // #endif
                return;
            }

            blendTime = blendTime || 0;

            data.prevAnim = data.currAnim;
            data.currAnim = name;

            if (data.model) {

                if (!data.skeleton && !data.animController) {
                    this._createAnimationController();
                }

                var prevAnim = data.animations[data.prevAnim];
                var currAnim = data.animations[data.currAnim];

                data.blending = blendTime > 0 && data.prevAnim;
                if (data.blending) {
                    data.blend = 0;
                    data.blendSpeed = 1.0 / blendTime;
                }

                if (data.skeleton) {
                    if (data.blending) {
                        // Blend from the current time of the current animation to the start of
                        // the newly specified animation over the specified blend time period.
                        data.fromSkel.animation = prevAnim;
                        data.fromSkel.addTime(data.skeleton._time);
                        data.toSkel.animation = currAnim;
                    } else {
                        data.skeleton.animation = currAnim;
                    }
                }

                if (data.animController) {
                    var animController = data.animController;

                    if (data.blending) {
                        // remove all but the last clip
                        while (animController.numClips > 1) {
                            animController.removeClip(0);
                        }
                    } else {
                        data.animController.removeClips();
                    }

                    var clip = new pc.AnimClip(data.animations[data.currAnim], 0, 1.0, true, data.loop);
                    clip.name = data.currAnim;
                    clip.blendWeight = data.blending ? 0 : 1;
                    clip.reset();
                    data.animController.addClip(clip);
                }
            }

            data.playing = true;
        },

        /**
         * @function
         * @name pc.AnimationComponent#getAnimation
         * @description Return an animation.
         * @param {string} name - The name of the animation asset.
         * @returns {pc.Animation} An Animation.
         */
        getAnimation: function (name) {
            return this.data.animations[name];
        },

        setModel: function (model) {
            var data = this.data;

            if (model !== data.model) {
                // reset animation controller
                this._resetAnimationController();

                // set the model
                data.model = model;

                // Reset the current animation on the new model
                if (data.animations && data.currAnim && data.animations[data.currAnim]) {
                    this.play(data.currAnim);
                }
            }
        },

        _resetAnimationController: function () {
            var data = this.data;
            data.skeleton = null;
            data.fromSkel = null;
            data.toSkel = null;
            data.animBinder = null;
            data.animController = null;
        },

        _createAnimationController: function () {
            var data = this.data;
            var model = data.model;
            var animations = data.animations;

            // check which type of animations are loaded
            var hasJson = false;
            var hasGlb = false;
            for (var animation in animations) {
                if (animations.hasOwnProperty(animation)) {
                    var anim = animations[animation];
                    if (anim.constructor === pc.AnimTrack) {
                        hasGlb = true;
                    } else {
                        hasJson = true;
                    }
                }
            }

            var graph = model.getGraph();
            if (hasJson) {
                data.fromSkel = new pc.Skeleton(graph);
                data.toSkel = new pc.Skeleton(graph);
                data.skeleton = new pc.Skeleton(graph);
                data.skeleton.looping = data.loop;
                data.skeleton.setGraph(graph);
            } else if (hasGlb) {
                data.animBinder = new pc.DefaultAnimBinder(graph);
                data.animController = new pc.AnimController(data.animBinder);
            }
        },

        loadAnimationAssets: function (ids) {
            if (!ids || !ids.length)
                return;

            var self = this;
            var assets = this.system.app.assets;
            var i, l = ids.length;

            var onAssetReady = function (asset) {
                if (asset.resources.length > 1) {
                    for (var i = 0; i < asset.resources.length; i++) {
                        self.animations[asset.resources[i].name] = asset.resources[i];
                        self.animationsIndex[asset.id] = asset.resources[i].name;
                    }
                } else {
                    self.animations[asset.name] = asset.resource;
                    self.animationsIndex[asset.id] = asset.name;
                }
                /* eslint-disable no-self-assign */
                self.animations = self.animations; // assigning ensures set_animations event is fired
                /* eslint-enable no-self-assign */
            };

            var onAssetAdd = function (asset) {
                asset.off('change', self.onAssetChanged, self);
                asset.on('change', self.onAssetChanged, self);

                asset.off('remove', self.onAssetRemoved, self);
                asset.on('remove', self.onAssetRemoved, self);

                if (asset.resource) {
                    onAssetReady(asset);
                } else {
                    asset.once('load', onAssetReady, self);
                    if (self.enabled && self.entity.enabled)
                        assets.load(asset);
                }
            };

            for (i = 0; i < l; i++) {
                var asset = assets.get(ids[i]);
                if (asset) {
                    onAssetAdd(asset);
                } else {
                    assets.on('add:' + ids[i], onAssetAdd);
                }
            }
        },

        onAssetChanged: function (asset, attribute, newValue, oldValue) {
            var i;
            if (attribute === 'resource' || attribute === 'resources') {
                // replace old animation with new one
                if (newValue) {
                    var restarted = false;
                    if (newValue.length > 1) {
                        if (oldValue && oldValue.length > 1) {
                            for (i = 0; i < oldValue.length; i++) {
                                delete this.animations[oldValue[i].name];
                            }
                        } else {
                            delete this.animations[asset.name];
                        }
                        restarted = false;
                        for (i = 0; i < newValue.length; i++) {
                            this.animations[newValue[i].name] = newValue[i];

                            if (!restarted && this.data.currAnim === newValue[i].name) {
                                // restart animation
                                if (this.data.playing && this.data.enabled && this.entity.enabled) {
                                    restarted = true;
                                    this.play(newValue[i].name, 0);
                                }
                            }
                        }
                        if (!restarted) {
                            this._stopCurrentAnimation();
                            this.onSetAnimations();
                        }
                    } else {
                        if (oldValue && oldValue.length > 1) {
                            for (i = 0; i < oldValue.length; i++) {
                                delete this.animations[oldValue[i].name];
                            }
                        }
                        this.animations[asset.name] = newValue[0] || newValue;
                        restarted = false;
                        if (this.data.currAnim === asset.name) {
                            // restart animation
                            if (this.data.playing && this.data.enabled && this.entity.enabled) {
                                restarted = true;
                                this.play(asset.name, 0);
                            }
                        }
                        if (!restarted) {
                            this._stopCurrentAnimation();
                            this.onSetAnimations();
                        }
                    }
                    this.animationsIndex[asset.id] = asset.name;
                } else {
                    if (oldValue.length > 1) {
                        for (i = 0; i < oldValue.length; i++) {
                            delete this.animations[oldValue[i].name];
                        }
                    } else {
                        delete this.animations[asset.name];
                    }
                    delete this.animationsIndex[asset.id];
                }
            }
        },

        onAssetRemoved: function (asset) {
            asset.off('remove', this.onAssetRemoved, this);

            if (this.animations) {
                if (asset.resources.length > 1) {
                    for (var i = 0; i < asset.resources.length; i++) {
                        delete this.animations[asset.resources[i].name];
                        if (this.data.currAnim === asset.resources[i].name)
                            this._stopCurrentAnimation();
                    }
                } else {
                    delete this.animations[asset.name];
                    if (this.data.currAnim === asset.name)
                        this._stopCurrentAnimation();
                }
                delete this.animationsIndex[asset.id];
            }
        },

        _stopCurrentAnimation: function () {
            var data = this.data;
            data.currAnim = null;
            data.playing = false;
            if (data.skeleton) {
                data.skeleton.currentTime = 0;
                data.skeleton.animation = null;
            }
            if (data.animController) {
                for (var i = 0; i < data.animController.numClips; ++i) {
                    data.animController.removeClips();
                }
            }
        },

        onSetAnimations: function (name, oldValue, newValue) {
            var data = this.data;

            // If we have animations _and_ a model, we can create the skeletons
            var modelComponent = this.entity.model;
            if (modelComponent) {
                var m = modelComponent.model;
                if (m && m !== data.model) {
                    this.setModel(m);
                }
            }

            if (!data.currAnim && data.activate && data.enabled && this.entity.enabled) {
                for (var animName in data.animations) {
                    // Set the first loaded animation as the current
                    this.play(animName, 0);
                    break;
                }
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

                            var animName = this.animationsIndex[asset.id];

                            if (this.data.currAnim === animName)
                                this._stopCurrentAnimation();

                            delete this.animations[animName];
                            delete this.animationsIndex[asset.id];
                        }
                    }
                }
            }

            var ids = newValue.map(function (value) {
                return (value instanceof pc.Asset) ? value.id : value;
            });

            this.loadAnimationAssets(ids);
        },

        onSetLoop: function (name, oldValue, newValue) {
            var data = this.data;

            if (data.skeleton) {
                data.skeleton.looping = data.loop;
            }

            if (data.animController) {
                for (var i = 0; i < data.animController.numClips; ++i) {
                    data.animController.getClip(i).loop = data.loop;
                }
            }
        },

        onSetCurrentTime: function (name, oldValue, newValue) {
            var data = this.data;

            if (data.skeleton) {
                var skeleton = data.skeleton;
                skeleton.currentTime = newValue;
                skeleton.addTime(0); // update
                skeleton.updateGraph();
            }

            if (data.animController) {
                var animController = data.animController;
                for (var i = 0; i < animController.numClips; ++i) {
                    animController.getClip(i).time = newValue;
                }
            }
        },

        onEnable: function () {
            pc.Component.prototype.onEnable.call(this);

            var data = this.data;

            // load assets if they're not loaded
            var assets = data.assets;
            var registry = this.system.app.assets;
            if (assets) {
                for (var i = 0, len = assets.length; i < len; i++) {
                    var asset = assets[i];
                    if (!(asset instanceof pc.Asset))
                        asset = registry.get(asset);

                    if (asset && !asset.resource)
                        registry.load(asset);
                }
            }

            if (data.activate && !data.currAnim) {
                for (var animName in data.animations) {
                    this.play(animName, 0);
                    break;
                }
            }
        },

        onBeforeRemove: function () {
            for (var i = 0; i < this.assets.length; i++) {
                var asset = this.system.app.assets.get(this.assets[i]);
                if (!asset) continue;

                asset.off('change', this.onAssetChanged, this);
                asset.off('remove', this.onAssetRemoved, this);
            }

            var data = this.data;

            delete data.animation;
            delete data.skeleton;
            delete data.fromSkel;
            delete data.toSkel;

            delete data.animController;
        }
    });

    Object.defineProperties(AnimationComponent.prototype, {
        currentTime: {
            get: function () {
                return this.data.skeleton._time;
            },
            set: function (currentTime) {
                var data = this.data;
                if (data.skeleton) {
                    var skeleton = data.skeleton;
                    skeleton.currentTime = currentTime;
                    skeleton.addTime(0);
                    skeleton.updateGraph();
                }

                if (data.animController) {
                    var animController = data.animController;
                    for (var i = 0; i < animController.numClips; ++i) {
                        animController.getClip(i).time = currentTime;
                    }
                }
            }
        },

        duration: {
            get: function () {
                return this.data.animations[this.data.currAnim].duration;
            }
        }
    });

    return {
        AnimationComponent: AnimationComponent
    };
}());
