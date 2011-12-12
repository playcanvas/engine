pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.AudioSourceComponentSystem
     * @constructor AudioSourceComponentSystem controls playback of an audio sample 
     * @param {pc.fw.ApplicationContext} context The ApplicationContext
     * @param {pc.audio.AudioContext} audioContext AudioContext object used to create sources and filters
     * @extends pc.fw.ComponentSystem
     */
    var AudioSourceComponentSystem = function (context, audioContext) {
        context.systems.add("audiosource", this);
        
        this.audioContext = audioContext;
        
        this.postGain = audioContext.createGainNode();
        this.postGain.connect(audioContext.destination);
        
        this.bind("set_assets", this.onSetAssets);
        this.bind("set_sources", this.onSetSources);
        this.bind("set_loop", this.onSetLoop);
        this.bind("set_volume", this.onSetVolume);
    };
    AudioSourceComponentSystem = AudioSourceComponentSystem.extendsFrom(pc.fw.ComponentSystem);
        
    AudioSourceComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.AudioSourceComponentData();

        this.initialiseComponent(entity, componentData, data, ['assets', 'volume', 'loop', 'activate']);
    
        if(data['activate']) {
            this.play(entity);
        }
        return componentData;        
    };
    
    AudioSourceComponentSystem.prototype.update = function(dt) {
        
    };

    AudioSourceComponentSystem.prototype.setSource = function (entity, name) {
        this.set(entity, 'currentSource', name);

        var sources = this.get(entity, 'sources');

        // Set current audioNode
        if (sources[name]) {
            var audioNode = this.get(entity, 'audioNode');
            if(audioNode) {
                audioNode.disconnect(0);
            }
            this._connectToOutput(sources[name]);
            this.set(entity, "audioNode", sources[name]);
        }
    };
    
    AudioSourceComponentSystem.prototype.play = function(entity, name) {
        this.set(entity, 'paused', false);
        var sources = this.get(entity, 'sources');
        
        var audioNode = this.audioContext.createBufferSource();
        audioNode.buffer = sources[name];
        audioNode.gain.value = this.get(entity, 'volume');
        audioNode.loop = this.get(entity, 'loop');
        audioNode.noteOn(0);
         
    };
    
    AudioSourceComponentSystem.prototype.pause = function(entity) {
        var audioNode = this.get(entity, 'audioNode');
        this.set(entity, 'paused', true);
        if(audioNode) {
            audioNode.noteOff(0);    
        }
    };
    
    /**
     * @private
     * @name pc.fw.AudioSourceComponentSystem#setVolume()
     * @function
     * @description Set the volume for the entire AudioSource system. All sources will have their volume limited to this value
     * @param {Number} value The value to set the volume to. Valid from 0.0 - 1.0
     */
    AudioSourceComponentSystem.prototype.setVolume = function(value) {
        this.postGain.gain.value = value;
    };
    
    AudioSourceComponentSystem.prototype.onSetAssets = function (entity, name, oldValue, newValue) {
        var componentData = this.getComponentData(entity);
        var newAssets = [];
        var i, len = newValue.length;
        
        if (len) {
            for(i = 0; i < len; i++) {
                if (oldValue.indexOf(newValue[i]) < 0) {
                    newAssets.push(newValue[i]);
                }
            }
        }
        
        if(!this._inTools && newAssets.length) { // Only load audio data if we are not in the tools and if changes have been made
            this._loadAudioSourceAssets(entity, newAssets);   
        }
    };
    
    AudioSourceComponentSystem.prototype.onSetSources = function (entity, name, oldValue, newValue) {
        var currentSource = this.get(entity, 'currentSource');
        
        // If the currentSource was set before the asset was loaded and should be playing, we should start playback 
        if(currentSource && !oldValue[currentSource]) {
            this.setSource(entity, currentSource);
            if (!this.get(entity, 'paused')) {
                this.play(entity, currentSource);    
            }
            
        }
    };

    AudioSourceComponentSystem.prototype.onSetLoop = function (entity, name, oldValue, newValue) {
        if (oldValue != newValue) {
            var node = this.get(entity, 'audioNode');
            if(node) {
                node.loop = newValue;    
            }
        }
    };

    AudioSourceComponentSystem.prototype.onSetVolume = function (entity, name, oldValue, newValue) {
        if (oldValue != newValue) {
            var node = this.get(entity, 'audioNode');
            if(node) {
                node.gain.value = newValue;    
            }
        }
    };
        
    AudioSourceComponentSystem.prototype._connectToOutput = function (node) {
        //this.postGain.disconnect(0);
        node.connect(this.postGain);    
    };
    
    AudioSourceComponentSystem.prototype._loadAudioSourceAssets = function (entity, guids) {
        var requests = guids.map(function (guid) {
            return new pc.resources.AssetRequest(guid);
        });
        var options = {
            batch: entity.getRequestBatch()
        };
        
        this.context.loader.request(requests, function (assetResources) {
            var requests = [];
            var names = [];
            
            guids.forEach(function (guid) {
                var asset = assetResources[guid];
                requests.push(new pc.resources.AudioRequest(asset.getFileUrl()));
                names.push(asset.name);
            });
            
            this.context.loader.request(requests, function (audioResources) {
                var sources = {};
                for (var i = 0; i < requests.length; i++) {
                    sources[names[i]] = audioResources[requests[i].identifier];
                }
                // set the current source the first entry (before calling set, so that it can play if needed)
                if(names.length) {
                    this.setSource(entity, names[0]);
                }

                this.set(entity, 'sources', sources);
            }.bind(this), function (errors) {
                
            }, function (progress) {
                
            }, options);
        }.bind(this), function (errors) {
            
        }, function (progress) {
            
        }, options);                    
    };
    
    return {
        AudioSourceComponentSystem: AudioSourceComponentSystem
    };
}());
