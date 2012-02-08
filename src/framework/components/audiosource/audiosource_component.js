pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.AudioSourceComponentSystem
     * @constructor AudioSourceComponentSystem controls playback of an audio sample 
     * @param {pc.fw.ApplicationContext} context The ApplicationContext
     * @param {pc.audio.AudioContext} audioContext AudioContext object used to create sources and filters
     * @extends pc.fw.ComponentSystem
     */
    var AudioSourceComponentSystem = function (context, manager) {
        context.systems.add("audiosource", this);
        
        this.manager = manager;
        
        this.bind("set_assets", this.onSetAssets);
        this.bind("set_loop", this.onSetLoop);
        this.bind("set_volume", this.onSetVolume);
        this.bind("set_minDistance", this.onSetMinDistance);
        this.bind("set_maxDistance", this.onSetMaxDistance);
        this.bind("set_rollOffFactor", this.onSetRollOffFactor);
    };
    AudioSourceComponentSystem = AudioSourceComponentSystem.extendsFrom(pc.fw.ComponentSystem);
        
    AudioSourceComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.AudioSourceComponentData();

        data = data || {};
        this.initialiseComponent(entity, componentData, data, ['assets', 'volume', 'loop', 'activate', '3d', 'minDistance', 'maxDistance', 'rollOffFactor']);
    
        this.set(entity, 'paused', !data['activate']);
        
        return componentData;
    };

    AudioSourceComponentSystem.prototype.initialize = function(root) {
        var componentData = this.getComponentData(root);
        if (componentData) {
            if (componentData['activate']) {
                this.play(root, componentData['currentSource']);
            }
        }
        
        var children = root.getChildren();
        var i, len = children.length;
        for (i = 0; i < len; i++) {
            if (children[i] instanceof pc.fw.Entity) {
                this.initialize(children[i]);    
            }
        } 
    };
    
    AudioSourceComponentSystem.prototype.update = function(dt) {
        var components = this.getComponents();
        var components = this.getComponents();

        for (var id in components) {
            if (components.hasOwnProperty(id)) {
                var entity = components[id].entity;
                var componentData = this.getComponentData(entity);
                
                // Update channel position if this is a 3d sound
                if (componentData.channel instanceof pc.audio.Channel3d) {
                    var pos = pc.math.mat4.getTranslation(entity.getWorldTransform());
                    componentData.channel.setPosition(pos);
                }
            }
        }
    };
   
    AudioSourceComponentSystem.prototype.play = function(entity, name) {
        if(this.hasComponent(entity)) {
            this.set(entity, 'paused', false);
            var componentData = this.getComponentData(entity);
            if(componentData['sources'][name]) {
                if (!componentData['3d']) {
                    var channel = this.manager.playSound(componentData['sources'][name], componentData);
                    this.set(entity, 'currentSource', name);
                    this.set(entity, 'channel', channel);
                } else {
                    var pos = pc.math.mat4.getTranslation(entity.getWorldTransform());
                    var channel = this.manager.playSound3d(componentData['sources'][name], pos, componentData);
                    this.set(entity, 'currentSource', name);
                    this.set(entity, 'channel', channel);
                }
            }
        }
    };
    
    AudioSourceComponentSystem.prototype.pause = function(entity) {
        if(this.hasComponent(entity)) {
            var channel = this.get(entity, 'channel');
            if (channel) {
                channel.pause();    
            }
        }
    };

    AudioSourceComponentSystem.prototype.stop = function(entity) {
        if(this.hasComponent(entity)) {
            var channel = this.get(entity, 'channel');
            if(channel) {
                channel.stop();    
            }
            
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
        this.manager.setVolume(value);
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
    
    AudioSourceComponentSystem.prototype.onSetLoop = function (entity, name, oldValue, newValue) {
        if (oldValue != newValue) {
            var channel = this.get(entity, 'channel');
            if (channel) {
                channel.setLoop(newValue);
            }
        }
    };

    AudioSourceComponentSystem.prototype.onSetVolume = function (entity, name, oldValue, newValue) {
        if (oldValue != newValue) {
            var channel = this.get(entity, 'channel');
            if (channel) {
                channel.setVolume(newValue);
            }
        }
    };

    AudioSourceComponentSystem.prototype.onSetMaxDistance = function (entity, name, oldValue, newValue) {
        if (oldValue != newValue) {
            var channel = this.get(entity, 'channel');
            if (channel instanceof pc.audio.Channel3d) {
                channel.setMaxDistance(newValue);
            }
        }
    };


    AudioSourceComponentSystem.prototype.onSetMinDistance = function (entity, name, oldValue, newValue) {
        if (oldValue != newValue) {
            var channel = this.get(entity, 'channel');
            if (channel instanceof pc.audio.Channel3d) {
                channel.setMinDistance(newValue);
            }
        }
    };

    AudioSourceComponentSystem.prototype.onSetRollOffFactor = function (entity, name, oldValue, newValue) {
        if (oldValue != newValue) {
            var channel = this.get(entity, 'channel');
            if (channel instanceof pc.audio.Channel3d) {
                channel.setRollOffFactor(newValue);
            }
        }
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
                // set the current source to the first entry (before calling set, so that it can play if needed)
                if(names.length) {
                    this.set(entity, 'currentSource', names[0]);
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
