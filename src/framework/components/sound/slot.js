Object.assign(pc, function () {
    'use strict';

    // temporary object for creating
    // instances
    var instanceOptions = {
        volume: 0,
        pitch: 0,
        loop: false,
        startTime: 0,
        duration: 0,
        position: new pc.Vec3(),
        maxDistance: 0,
        refDistance: 0,
        rollOffFactor: 0,
        distanceModel: 0,
        onPlay: null,
        onPause: null,
        onResume: null,
        onStop: null,
        onEnd: null
    };

    /**
     * @constructor
     * @name pc.SoundSlot
     * @classdesc The SoundSlot controls playback of an audio asset.
     * @description Create a new SoundSlot
     * @param {pc.SoundComponent} component The Component that created this slot.
     * @param {String} name The name of the slot.
     * @param {Object} options Settings for the slot
     * @param {Number} [options.volume=1] The playback volume, between 0 and 1.
     * @param {Number} [options.pitch=1] The relative pitch, default of 1, plays at normal pitch.
     * @param {Boolean} [options.loop=false] If true the sound will restart when it reaches the end.
     * @param {Number} [options.startTime=0] The start time from which the sound will start playing.
     * @param {Number} [options.duration=null] The duration of the sound that the slot will play starting from startTime.
     * @param {Boolean} [options.overlap=false] If true then sounds played from slot will be played independently of each other. Otherwise the slot will first stop the current sound before starting the new one.
     * @param {Boolean} [options.autoPlay=false] If true the slot will start playing as soon as its audio asset is loaded.
     * @param {Number} [options.asset=null] The asset id of the audio asset that is going to be played by this slot.
     * @property {String} name The name of the slot
     * @property {String} asset The asset id
     * @property {Boolean} autoPlay If true the slot will begin playing as soon as it is loaded
     * @property {Number} volume The volume modifier to play the sound with. In range 0-1.
     * @property {Number} pitch The pitch modifier to play the sound with. Must be larger than 0.01
     * @property {Number} startTime The start time from which the sound will start playing.
     * @property {Number} duration The duration of the sound that the slot will play starting from startTime.
     * @property {Boolean} loop If true the slot will restart when it finishes playing
     * @property {Boolean} overlap If true then sounds played from slot will be played independently of each other. Otherwise the slot will first stop the current sound before starting the new one.
     * @property {Boolean} isLoaded Returns true if the asset of the slot is loaded.
     * @property {Boolean} isPlaying Returns true if the slot is currently playing.
     * @property {Boolean} isPaused Returns true if the slot is currently paused.
     * @property {Boolean} isStopped Returns true if the slot is currently stopped.
     * @property {pc.SoundInstance[]} instances An array that contains all the {@link pc.SoundInstance}s currently being played by the slot.
     */
    var SoundSlot = function (component, name, options) {
        options = options || {};
        this._component = component;
        this._assets = component.system.app.assets;
        this._manager = component.system.manager;
        this._name = name || 'Untitled';
        this._volume = options.volume !== undefined ? pc.math.clamp(Number(options.volume) || 0, 0, 1) : 1;
        this._pitch = options.pitch !== undefined ? Math.max(0.01, Number(options.pitch) || 0) : 1;
        this._loop = !!(options.loop !== undefined ? options.loop : false);
        this._duration = options.duration > 0 ? options.duration : null;
        this._startTime = Math.max(0, Number(options.startTime) || 0);
        this._overlap = !!(options.overlap);
        this._autoPlay = !!(options.autoPlay);
        this._firstNode = null;
        this._lastNode = null;

        this._asset = options.asset;
        if (this._asset instanceof pc.Asset) {
            this._asset = this._asset.id;
        }

        this._onInstancePlayHandler = this._onInstancePlay.bind(this);
        this._onInstancePauseHandler = this._onInstancePause.bind(this);
        this._onInstanceResumeHandler = this._onInstanceResume.bind(this);
        this._onInstanceStopHandler = this._onInstanceStop.bind(this);
        this._onInstanceEndHandler = this._onInstanceEnd.bind(this);

        this.instances = [];

        pc.events.attach(this);
    };

    Object.assign(SoundSlot.prototype, {
        /**
         * @function pc.SoundSlot#play
         * @description Plays a sound. If {@link pc.SoundSlot#overlap} is true the new sound
         * instance will be played independently of any other instances already playing.
         * Otherwise existing sound instances will stop before playing the new sound.
         * @returns {pc.SoundInstance} The new sound instance
         */
        play: function () {
            // stop if overlap is false
            if (!this.overlap && (this.isPlaying || this.isPaused)) {
                this.stop();
            }

            var instance = this._createInstance();
            this.instances.push(instance);

            // if not loaded then load first
            // and then set sound resource on the created instance
            if (!this.isLoaded) {
                var onLoad = function (sound) {
                    var playWhenLoaded = instance._playWhenLoaded;
                    instance.sound = sound;
                    if (playWhenLoaded) {
                        instance.play();
                    }
                };

                this.off('load', onLoad);
                this.once('load', onLoad);
                this.load();
            } else {
                instance.play();
            }

            return instance;
        },

        /**
         * @function
         * @name pc.SoundSlot#pause
         * @description Pauses all sound instances. To continue playback call {@link pc.SoundSlot#resume}.
         * @returns {Boolean} true if the sound instances paused successfully, false otherwise.
         */
        pause: function () {
            var paused = false;

            var instances = this.instances;
            for (var i = 0, len = instances.length; i < len; i++) {
                if (instances[i].pause()) {
                    paused = true;
                }
            }

            return paused;
        },

        /**
         * @function
         * @name pc.SoundSlot#resume
         * @description Resumes playback of all paused sound instances.
         * @returns {Boolean} True if any instances were resumed.
         */
        resume: function () {
            var resumed = false;
            var instances = this.instances;
            for (var i = 0, len = instances.length; i < len; i++) {
                if (instances[i].resume())
                    resumed = true;
            }

            return resumed;
        },

        /**
         * @function
         * @name pc.SoundSlot#stop
         * @description Stops playback of all sound instances.
         * @returns {Boolean} True if any instances were stopped.
         */
        stop: function () {
            var stopped = false;
            var instances = this.instances;
            for (var i = 0, len = instances.length; i < len; i++) {
                if (instances[i].stop())
                    stopped = true;
            }

            instances.length = 0;

            return stopped;
        },

        /**
         * @function
         * @name pc.SoundSlot#load
         * @description Loads the asset assigned to this slot.
         */
        load: function () {
            if (!this._hasAsset())
                return;

            var asset = this._assets.get(this._asset);
            if (!asset) {
                this._assets.off('add:' + this._asset, this._onAssetAdd, this);
                this._assets.once('add:' + this._asset, this._onAssetAdd, this);
                return;
            }

            asset.off('remove', this._onAssetRemoved, this);
            asset.on('remove', this._onAssetRemoved, this);

            if (!asset.resource) {
                asset.off('load', this._onAssetLoad, this);
                asset.once('load', this._onAssetLoad, this);

                this._assets.load(asset);

                return;
            }

            this.fire('load', asset.resource);
        },

        /**
         * @function
         * @name pc.SoundSlot#setExternalNodes
         * @description Connect external Web Audio API nodes. Any sound played by this slot will
         * automatically attach the specified nodes to the source that plays the sound. You need to pass
         * the first node of the node graph that you created externally and the last node of that graph. The first
         * node will be connected to the audio source and the last node will be connected to the destination of the AudioContext (e.g. speakers).
         * @param {AudioNode} firstNode The first node that will be connected to the audio source of sound instances.
         * @param {AudioNode} [lastNode] The last node that will be connected to the destination of the AudioContext.
         * If unspecified then the firstNode will be connected to the destination instead.
         * @example
         * var context = app.systems.sound.context;
         * var analyzer = context.createAnalyzer();
         * var distortion = context.createWaveShaper();
         * var filter = context.createBiquadFilter();
         * analyzer.connect(distortion);
         * distortion.connect(filter);
         * slot.setExternalNodes(analyzer, filter);
         */
        setExternalNodes: function (firstNode, lastNode) {
            if (!(firstNode)) {
                console.error('The firstNode must have a valid AudioNode');
                return;
            }

            if (!lastNode) {
                lastNode = firstNode;
            }

            this._firstNode = firstNode;
            this._lastNode = lastNode;

            // update instances if not overlapping
            if (!this._overlap) {
                var instances = this.instances;
                for (var i = 0, len = instances.length; i < len; i++) {
                    instances[i].setExternalNodes(firstNode, lastNode);
                }
            }
        },

        /**
         * @function
         * @name pc.SoundSlot#clearExternalNodes
         * @description Clears any external nodes set by {@link pc.SoundSlot#setExternalNodes}.
         */
        clearExternalNodes: function () {
            this._firstNode = null;
            this._lastNode = null;

            // update instances if not overlapping
            if (!this._overlap) {
                var instances = this.instances;
                for (var i = 0, len = instances.length; i < len; i++) {
                    instances[i].clearExternalNodes();
                }
            }
        },

        /**
         * @function
         * @name pc.SoundSlot#getExternalNodes
         * @description Gets an array that contains the two external nodes set by {@link pc.SoundSlot#setExternalNodes}.
         * @returns {AudioNode[]} An array of 2 elements that contains the first and last nodes set by {@link pc.SoundSlot#setExternalNodes}.
         */
        getExternalNodes: function () {
            return [this._firstNode, this._lastNode];
        },

        /**
         * @function
         * @private
         * @name pc.SoundSlot#_hasAsset
         * @returns {Boolean} Returns true if the slot has an asset assigned.
         */
        _hasAsset: function () {
            // != intentional
            return this._asset != null;
        },

        /**
         * @function
         * @private
         * @name pc.SoundSlot#_createInstance
         * @description Creates a new pc.SoundInstance with the properties of the slot.
         * @returns {pc.SoundInstance} The new instance
         */
        _createInstance: function () {
            var instance = null;

            var component = this._component;

            var sound = null;

            // get sound resource
            if (this._hasAsset()) {
                var asset = this._assets.get(this._asset);
                if (asset) {
                    sound = asset.resource;
                }
            }

            // initialize instance options
            var data = instanceOptions;
            data.volume = this._volume * component.volume;
            data.pitch = this._pitch * component.pitch;
            data.loop = this._loop;
            data.startTime = this._startTime;
            data.duration = this._duration;

            data.onPlay = this._onInstancePlayHandler;
            data.onPause = this._onInstancePauseHandler;
            data.onResume = this._onInstanceResumeHandler;
            data.onStop = this._onInstanceStopHandler;
            data.onEnd = this._onInstanceEndHandler;

            if (component.positional) {
                data.position.copy(component.entity.getPosition());
                data.maxDistance = component.maxDistance;
                data.refDistance = component.refDistance;
                data.rollOffFactor = component.rollOffFactor;
                data.distanceModel = component.distanceModel;

                instance = new pc.SoundInstance3d(this._manager, sound, data);
            } else {
                instance = new pc.SoundInstance(this._manager, sound, data);
            }

            // hook external audio nodes
            if (this._firstNode) {
                instance.setExternalNodes(this._firstNode, this._lastNode);
            }

            return instance;
        },

        _onInstancePlay: function (instance) {
            // propagate event to slot
            this.fire('play', instance);

            // propagate event to component
            this._component.fire('play', this, instance);
        },

        _onInstancePause: function (instance) {
            // propagate event to slot
            this.fire('pause', instance);

            // propagate event to component
            this._component.fire('pause', this, instance);
        },

        _onInstanceResume: function (instance) {
            // propagate event to slot
            this.fire('resume', instance);

            // propagate event to component
            this._component.fire('resume', this, instance);
        },

        _onInstanceStop: function (instance) {
            // propagate event to slot
            this.fire('stop', instance);

            // propagate event to component
            this._component.fire('stop', this, instance);
        },

        _onInstanceEnd: function (instance) {
            // remove instance that ended
            var idx = this.instances.indexOf(instance);
            if (idx !== -1) {
                this.instances.splice(idx, 1);
            }

            // propagate event to slot
            this.fire('end', instance);

            // propagate event to component
            this._component.fire('end', this, instance);
        },

        _onAssetAdd: function (asset) {
            this.load();
        },

        _onAssetLoad: function (asset) {
            this.load();
        },

        _onAssetRemoved: function (asset) {
            asset.off('remove', this._onAssetRemoved, this);
            this._assets.off('add:' + asset.id, this._onAssetAdd, this);
            this.stop();
        },

        updatePosition: function (position) {
            var instances = this.instances;
            for (var i = 0, len = instances.length; i < len; i++) {
                instances[i].position = position;
            }
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'name', {
        get: function () {
            return this._name;
        },
        set: function (value) {
            this._name = value;
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'volume', {
        get: function () {
            return this._volume;
        },
        set: function (value) {
            this._volume = pc.math.clamp(Number(value) || 0, 0, 1);

            // update instances if non overlapping
            if (!this._overlap) {
                var instances = this.instances;
                for (var i = 0, len = instances.length; i < len; i++) {
                    instances[i].volume = this._volume * this._component.volume;
                }
            }
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'pitch', {
        get: function () {
            return this._pitch;
        },
        set: function (value) {
            this._pitch = Math.max(Number(value) || 0, 0.01);

            // update instances if non overlapping
            if (!this._overlap) {
                var instances = this.instances;
                for (var i = 0, len = instances.length; i < len; i++) {
                    instances[i].pitch = this.pitch * this._component.pitch;
                }
            }
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'loop', {
        get: function () {
            return this._loop;
        },
        set: function (value) {
            this._loop = !!value;

            // update instances if non overlapping
            var instances = this.instances;
            for (var i = 0, len = instances.length; i < len; i++) {
                instances[i].loop = this._loop;
            }
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'autoPlay', {
        get: function () {
            return this._autoPlay;
        },
        set: function (value) {
            this._autoPlay = !!value;
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'overlap', {
        get: function () {
            return this._overlap;
        },
        set: function (value) {
            this._overlap = !!value;
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'startTime', {
        get: function () {
            return this._startTime;
        },
        set: function (value) {
            this._startTime = Math.max(0, Number(value) || 0);

            // update instances if non overlapping
            if (!this._overlap) {
                var instances = this.instances;
                for (var i = 0, len = instances.length; i < len; i++) {
                    instances[i].startTime = this._startTime;
                }
            }
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'duration', {
        get: function () {
            var assetDuration = 0;
            if (this._hasAsset()) {
                var asset = this._assets.get(this._asset);
                assetDuration = asset.resource ? asset.resource.duration : 0;
            }

            // != intentional
            if (this._duration != null) {
                return this._duration % (assetDuration || 1);
            }
            return assetDuration;
        },
        set: function (value) {
            this._duration = Math.max(0, Number(value) || 0) || null;

            // update instances if non overlapping
            if (!this._overlap) {
                var instances = this.instances;
                for (var i = 0, len = instances.length; i < len; i++) {
                    instances[i].duration = this._duration;
                }
            }
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'asset', {
        get: function () {
            return this._asset;
        },
        set: function (value) {
            var old = this._asset;

            if (old) {
                this._assets.off('add:' + old, this._onAssetAdd, this);
                var oldAsset = this._assets.get(old);
                if (oldAsset) {
                    oldAsset.off('remove', this._onAssetRemoved, this);
                }
            }

            this._asset = value;
            if (this._asset instanceof pc.Asset) {
                this._asset = this._asset.id;
            }

            // load asset if component and entity are enabled
            if (this._hasAsset() && this._component.enabled && this._component.entity.enabled) {
                this.load();
            }
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'isLoaded', {
        get: function () {
            if (this._hasAsset()) {
                var asset = this._assets.get(this._asset);
                if (asset) {
                    return !!asset.resource;
                }
            }

            return false;
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'isPlaying', {
        get: function () {
            var instances = this.instances;
            for (var i = 0, len = instances.length; i < len; i++) {
                if (instances[i].isPlaying)
                    return true;
            }

            return false;
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'isPaused', {
        get: function () {
            var instances = this.instances;
            var len = instances.length;
            if (len === 0)
                return false;

            for (var i = 0; i < len; i++) {
                if (!instances[i].isPaused)
                    return false;
            }

            return true;
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'isStopped', {
        get: function () {
            var instances = this.instances;
            for (var i = 0, len = instances.length; i < len; i++) {
                if (!instances[i].isStopped)
                    return false;
            }

            return true;
        }
    });

    return {
        SoundSlot: SoundSlot
    };

}());


// Events Documentation

/**
 * @event
 * @name pc.SoundSlot#play
 * @description Fired when a sound instance starts playing
 * @param {pc.SoundInstance} instance The instance that started playing
 */

/**
 * @event
 * @name pc.SoundSlot#pause
 * @description Fired when a sound instance is paused.
 * @param {pc.SoundInstance} instance The instance that was paused created to play the sound
 */

/**
 * @event
 * @name pc.SoundSlot#resume
 * @description Fired when a sound instance is resumed..
 * @param {pc.SoundInstance} instance The instance that was resumed
 */

/**
 * @event
 * @name pc.SoundSlot#stop
 * @description Fired when a sound instance is stopped.
 * @param {pc.SoundInstance} instance The instance that was stopped
 */

/**
 * @event
 * @name pc.SoundSlot#load
 * @description Fired when the asset assigned to the slot is loaded
 * @param {pc.Sound} sound The sound resource that was loaded
 */
