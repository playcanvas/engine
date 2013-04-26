pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.AudioSourceComponent
     * @class The AudioSource Component controls playback of an audio sample.
     * @constructor Create a new AudioSource Component
     * @param {pc.fw.AudioSourceComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The entity that the Component is attached to
     * @extends pc.fw.Component
     * @property {Array} assets The list of audio assets
     * @property {Boolean} activate If true the audio will begin playing as soon as the Pack is loaded
     * @property {Number} volume The volume modifier to play the audio with. In range 0-1.
     * @property {Boolean} loop If true the audio will restart when it finishes playing
     * @property {Boolean} 3d If true the audio will play back at the location of the Entity in space, so the audio will be affect by the position of the {@link pc.fw.AudioListenerComponent}
     * @property {Number} minDistance The minimum distance from the listener at which audio falloff begins.
     * @property {Number} maxDistance The maximum distance from the listener at which audio falloff stops. Note the volume of the audio is not 0 after this distance, but just doesn't fall off anymore
     * @property {Number} rollOffFactor The factor used in the falloff equation.
     */
    var AudioSourceComponent = function (system, entity) {
        this.on("set_assets", this.onSetAssets, this);
        this.on("set_loop", this.onSetLoop, this);
        this.on("set_volume", this.onSetVolume, this);
        this.on("set_minDistance", this.onSetMinDistance, this);
        this.on("set_maxDistance", this.onSetMaxDistance, this);
        this.on("set_rollOffFactor", this.onSetRollOffFactor, this);
    };
    AudioSourceComponent = pc.inherits(AudioSourceComponent, pc.fw.Component);
        
    pc.extend(AudioSourceComponent.prototype, {
       /**
        * @function
        * @name pc.fw.AudioSourceComponent#play
        * @description Begin playback of an audio asset in the component attached to an entity
        * @param {String} name The name of the Asset to play
        */
        play: function(name) {
            if (this.channel) {
                // If we are currently playing a channel, stop it.
                this.stop();
            }

            var channel;
            var componentData = this.data;            
            if(componentData.sources[name]) {
                if (!componentData['3d']) {
                    channel = this.system.manager.playSound(componentData.sources[name], componentData);
                    componentData.currentSource = name;
                    componentData.channel = channel;
                } else {
                    var pos = this.entity.getPosition();
                    channel = this.system.manager.playSound3d(componentData.sources[name], pos, componentData);
                    componentData.currentSource = name;
                    componentData.channel = channel;
                }
            }
        },
        
        /**
        * @function
        * @name pc.fw.AudioSourceComponent#pause
        * @description Pause playback of the audio that is playing on the Entity. Playback can be resumed by calling {@link pc.fw.AudioSourceComponent#unpause}
        */
        pause: function() {
            if (this.channel) {
                this.channel.pause();    
            }
        },

        /**
        * @function
        * @name pc.fw.AudioSourceComponent#unpause
        * @description Resume playback of the audio if paused. Playback is resumed at the time it was paused.
        */
        unpause: function () {
            if (this.channel && this.channel.paused) {
                this.channel.unpause();
            }
        },

        /**
        * @function
        * @name pc.fw.AudioSourceComponent#stop
        * @description Stop playback on an Entity. Playback can not be resumed after being stopped.
        */
        stop: function() {
            if(this.channel) {
                this.channel.stop();
                this.channel = null;
            }
        },
            
        onSetAssets: function (name, oldValue, newValue) {
            var componentData = this.data;
            var newAssets = [];
            var i, len = newValue.length;
            
            if (len) {
                for(i = 0; i < len; i++) {
                    if (oldValue.indexOf(newValue[i]) < 0) {
                        newAssets.push(newValue[i]);
                    }
                }
            }
            
            if(!this.system._inTools && newAssets.length) { // Only load audio data if we are not in the tools and if changes have been made
                this.loadAudioSourceAssets(newAssets);
            }
        },
        
        onSetLoop: function (name, oldValue, newValue) {
            if (oldValue != newValue) {
                if (this.channel) {
                    this.channel.setLoop(newValue);
                }
            }
        },

        onSetVolume: function (name, oldValue, newValue) {
            if (oldValue != newValue) {
                if (this.channel) {
                    this.channel.setVolume(newValue);
                }
            }
        },

        onSetMaxDistance: function (name, oldValue, newValue) {
            if (oldValue != newValue) {
                if (this.channel instanceof pc.audio.Channel3d) {
                    this.channel.setMaxDistance(newValue);
                }
            }
        },
        
        onSetMinDistance: function (name, oldValue, newValue) {
            if (oldValue != newValue) {
                if (this.channel instanceof pc.audio.Channel3d) {
                    this.channel.setMinDistance(newValue);
                }
            }
        },

        onSetRollOffFactor: function (name, oldValue, newValue) {
            if (oldValue != newValue) {
                if (this.channel instanceof pc.audio.Channel3d) {
                    this.channel.setRollOffFactor(newValue);
                }
            }
        },
         
        loadAudioSourceAssets: function (guids) {
            var options = {
                parent: this.entity.getRequest()
            };
            
            var assets = guids.map(function (guid) {
                return this.system.context.assets.getAsset(guid);
            }, this);

            var requests = [];
            var names = [];
            
            assets.forEach(function (asset) {
                if (!asset) {
                    logERROR(pc.string.format('Trying to load audiosource component before assets {0} are loaded', guids));
                } else {
                    requests.push(new pc.resources.AudioRequest(asset.getFileUrl()));
                    names.push(asset.name);                    
                }
            });

            this.system.context.loader.request(requests, options).then(function (audioResources) {
                var sources = {};
                for (var i = 0; i < requests.length; i++) {
                    sources[names[i]] = audioResources[i];
                }
                // set the current source to the first entry (before calling set, so that it can play if needed)
                if(names.length) {
                    this.data.currentSource = names[0];
                }
                this.data.sources = sources;

                if (!options.parent && this.activate) {
                    this.play(names[0]);
                }
            }.bind(this));
        }
    });

    return {
        AudioSourceComponent: AudioSourceComponent
    };
}());