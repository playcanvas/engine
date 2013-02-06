pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.AudioSourceComponent
     * @constructor The AudioSource Component controls playback of an audio sample
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
        * @param {pc.fw.Entity} entity Then entity which has an AudioSource Component
        * @param {String} name The name of the Asset to play
        */
        play: function(name) {
            this.entity.paused = false;

            var componentData = this.data;
            if(componentData['sources'][name]) {
                if (!componentData['3d']) {
                    var channel = this.system.manager.playSound(componentData['sources'][name], componentData);
                    componentData.currentSource = name;
                    componentData.channel = channel;
                } else {
                    var pos = this.entity.getPosition();
                    var channel = this.system.manager.playSound3d(componentData['sources'][name], pos, componentData);
                    componentData.currentSource = name;
                    componentData.channel = channel;
                }
            }
        },
        
        /**
        * @function
        * @name pc.fw.AudioSourceComponent#pause
        * @description Pause playback of the audio that is playing on the Entity. Playback can be resumed by calling play()
        * @param {pc.fw.Entity} entity Then entity which has an AudioSource Component
        */
        pause: function(entity) {
            if (this.channel) {
                this.channel.pause();    
            }
        },

        /**
        * @function
        * @name pc.fw.AudioSourceComponent#stop
        * @description Stop playback on an Entity. Playback can not be resumed after being stopped.
        * @param {pc.fw.Entity} entity Then entity which has an AudioSource Component
        */
        stop: function(entity) {
            if(this.channel) {
                this.channel.stop();    
            }
        },
            
        /**
         * @name pc.fw.AudioSourceComponent#setVolume()
         * @function
         * @description Set the volume for the entire AudioSource system. All sources will have their volume limited to this value
         * @param {Number} value The value to set the volume to. Valid from 0.0 - 1.0
         */
        setVolume: function(value) {
            this.system.manager.setVolume(value);
        },
        
        onSetAssets: function (name, oldValue, newValue) {
            var componentData = this.data
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
                batch: this.entity.getRequestBatch()
            };
            
            var assets = guids.map(function (guid) {
                return this.system.context.assets.getAsset(guid);
            }, this);

            var requests = [];
            var names = [];
            
            assets.forEach(function (asset) {
                requests.push(new pc.resources.AudioRequest(asset.file.url));
                names.push(asset.name);
            });

            this.system.context.loader.request(requests, function (audioResources) {
                var sources = {};
                for (var i = 0; i < requests.length; i++) {
                    sources[names[i]] = audioResources[requests[i].identifier];
                }
                // set the current source to the first entry (before calling set, so that it can play if needed)
                if(names.length) {
                    this.data.currentSource = names[0];
                }
                this.data.sources = sources;

                if (!options.batch && this.activate) {
                    this.play(names[0]);
                }
            }.bind(this), function (errors) {
                
            }, function (progress) {
                
            }, options);
        }
    });

    return {
        AudioSourceComponent: AudioSourceComponent
    };
}());