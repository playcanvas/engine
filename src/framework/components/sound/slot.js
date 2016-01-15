pc.extend(pc, function () {
    'use strict';

    /**
     * @component
     * @name pc.SoundSlot
     * @class The SoundSlot controls playback of an audio sample.
     * @description Create a new SoundSlot
     * @param {pc.AudioSourceComponent} component The Component that created this SoundSlot
     * @param {String} name The name of the SoundSlot
     * @param {Object} options Contains SoundSlot parameters
     * @property {String} asset The asset id
     * @property {Boolean} autoPlay If true the source will begin playing as soon as it is loaded
     * @property {Number} volume The volume modifier to play the audio with. In range 0-1.
     * @property {Number} pitch The pitch modifier to play the audio with. Must be larger than 0.01
     * @property {Boolean} loop If true the source will restart when it finishes playing
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

        this.instances = [];

        pc.events.attach(this);
    };

    SoundSlot.prototype = {
        play: function () {
            if (! this.isLoaded) {
                this.off('load', this.play, this);
                this.once('load', this.play, this);
                this.load();
                return;
            }

            // stop if overlap is false
            if (!this.overlap && (this.isPlaying || this.isPaused)) {
                this.stop();
            }

            var instance = this._createInstance();
            this.instances.push(instance);
            instance.play();

            this.fire('play', this, instance);
            this._component.fire('play', this, instance);

            return instance;
        },

        pause: function () {
            var paused = false;

            var instances = this.instances;
            for (var i = 0, len = instances.length; i < len; i++) {
                if (instances[i].pause())
                    paused = true;
            }

            this.off('load', this.play, this);
            this.off('load', this.resume, this);

            if (paused) {
                this.fire('pause', this);
            }

            return paused;
        },

        resume: function () {
            if (! this.isLoaded) {
                // if the asset is not loaded then load it
                // and play instead of resuming
                this.off('load', this.play, this);
                this.once('load', this.play, this);
                this.load();
                return;
            }

            var resumed = false;
            var instances = this.instances;
            for (var i = 0, len = instances.length; i < len; i++) {
                if (instances[i].resume())
                    resumed = true;
            }

            if (resumed) {
                this.fire('resume', this);
                this._component.fire('resume', this);
            }

            return resumed;
        },

        stop: function () {
            var stopped = false;
            var instances = this.instances;
            for (var i = 0, len = instances.length; i < len; i++) {
                if (instances[i].stop())
                    stopped = true;
            }

            instances.length = 0;

            this.off('load', this.play, this);
            this.off('load', this.resume, this);

            if (stopped) {
                this.fire('stop', this);
            }

            return stopped;
        },

        load: function () {
            if (! this._hasAsset())
                return;

            var asset = this._assets.get(this._asset);
            if (! asset) {
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

            this.fire('load', this);
        },

        setExternalNodes: function (firstNode, lastNode) {
            if (! (firstNode)) {
                logError('The firstNode must have a valid AudioNode');
                return;
            }

            if (! lastNode) {
                lastNode = firstNode;
            }

            this._firstNode = firstNode;
            this._lastNode = lastNode;

            if (! this._overlap) {
                var instances = this.instances;
                for (var i = 0, len = instances.length; i < len; i++) {
                    instances[i].setExternalNodes(firstNode, lastNode);
                }
            }
        },

        clearExternalNodes: function () {
            this._firstNode = null;
            this._lastNode = null;

            if (! this._overlap) {
                var instances = this.instances;
                for (var i = 0, len = instances.length; i < len; i++) {
                    instances[i].clearExternalNodes();
                }
            }
        },


        getExternalNodes: function () {
            return [this._firstNode, this._lastNode];
        },

        _hasAsset: function () {
            return this._asset !== null && this._asset !== undefined;
        },

        _createInstance: function () {
            var instance = null;

            var component = this._component;
            var resource = this._assets.get(this._asset).resource;

            var data = {
                volume: this._volume * component.volume,
                pitch: this._pitch * component.pitch,
                loop: this._loop,
                startTime: this._startTime,
                duration: this._duration
            };

            if (component.positional) {
                data.position = component.entity.getPosition();
                data.maxDistance = component.maxDistance;
                data.refDistance = component.refDistance;
                data.rollOffFactor = component.rollOffFactor;
                data.distanceModel = component.distanceModel;

                instance = new pc.SoundInstance3d(this._manager, resource, data);
            } else {
                instance = new pc.SoundInstance(this._manager, resource, data);
            }

            instance.once('end', this._onInstanceEnd, this);

            if (this._firstNode) {
                instance.setExternalNodes(this._firstNode, this._lastNode);
            }

            return instance;
        },

        _onInstanceEnd: function (instance) {
            var idx = this.instances.indexOf(instance);
            if (idx !== -1) {
                this.instances.splice(idx, 1);
            }
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
        },
    };

    Object.defineProperty(SoundSlot.prototype, 'name', {
        get: function () {
            return this._name;
        },
        set: function (value) {
            var old = this._name;
            this._name = value;
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'volume', {
        get: function () {
            return this._volume;
        },
        set: function (value) {
            var old = this._volume;
            this._volume = pc.math.clamp(Number(value) || 0, 0, 1);

            if (! this._overlap) {
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
            var old = this._pitch;
            this._pitch = Math.max(Number(value) || 0, 0.01);

            if (! this._overlap) {
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
            var old = this._loop;
            this._loop = !!value;

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
            var old = this._autoPlay;
            this._autoPlay = !!value;
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'overlap', {
        get: function () {
            return this._overlap;
        },
        set: function (value) {
            var old = this._overlap;
            this._overlap = !!value;
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'startTime', {
        get: function () {
            return this._startTime;
        },
        set: function (value) {
            var old = this._startTime;
            this._startTime = Math.max(0, Number(value) || 0);

            var instances = this.instances;
            for (var i = 0, len = instances.length; i < len; i++) {
                instances[i].startTime = this._startTime;
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
            } else  {
                return assetDuration;
            }
        },
        set: function (value) {
            var old = this._duration;
            this._duration = Math.max(0, Number(value) || 0) || null;
            var endTime = this._duration ? this._startTime + this._duration : null;

            var instances = this.instances;
            for (var i = 0, len = instances.length; i < len; i++) {
                instances[i].endTime = endTime;
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
                if (! instances[i].isPaused)
                    return false;
            }

            return true;
        }
    });

    Object.defineProperty(SoundSlot.prototype, 'isStopped', {
        get: function () {
            var instances = this.instances;
            for (var i = 0, len = instances.length; i < len; i++) {
                if (! instances[i].isStopped)
                    return false;
            }

            return true;
        }
    });

    return {
        SoundSlot: SoundSlot
    };

}());
