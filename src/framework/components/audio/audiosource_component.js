pc.extend(pc.fw, function () {
    function _onSet(entity, name, oldValue, newValue) {
        var functions = {
            // When the 'uri' value is changed we need to create a new Audio object
            "uri" : function (entity, name, oldValue, newValue) {
                var componentData = this._getComponentData(entity);
                componentData.audio.setSource(newValue);
                if(componentData.activate) {
                    this.play(entity);
                }
            },
            // When the 'ambient' value is changed we need to create a new Audio object
            "ambient": function (entity, name, oldValue, newValue) {
                var componentData = this._getComponentData(entity);
                var uri = componentData.uri;
                if(componentData.ambient) {
                    componentData.audio = new pc.audio.AmbientAudio();
                } else {
                    componentData.audio = new pc.audio.PointAudio();
                }
                componentData.audio.setSource(uri);                
            }, 
            "radius": function (entity, name, oldValue, newValue) {
                var componentData = this._getComponentData(entity);
                if(componentData.audio.setRadius) {
                    componentData.audio.setRadius(newValue);
                }
            }        
        };
        
        if(functions[name]) {
            functions[name].call(this, entity, name, oldValue, newValue);
        }
    }
    
    /**
     * @name pc.fw.AudioSourceComponent
     * @constructor AudioSourceComponent controls playback of an audio sample 
     * @param {pc.fw.ApplicationContext} context The ApplicationContext
     * @extends pc.fw.ComponentSystem
     */
    var AudioSourceComponentSystem = function (context) {
        context.systems.add("audiosource", this);
        
        this._loop = function (component, value) {
            if(value) {
                component.audio.setLooping(value);
            } else {
                return component.audio.getLooping();
            }
        };
        
        this._volume = function (component, value) {
            if(value) {
                component.audio.setVolume(value);
            } else {
                return component.audio.getVolume();
            }
        }
        
        this.bind("set", _onSet);
    };
    AudioSourceComponentSystem = AudioSourceComponentSystem.extendsFrom(pc.fw.ComponentSystem);
        
    AudioSourceComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.AudioSourceComponentData();
        var properties = ["ambient", "uri", "volume", "loop", "radius", "activate"];
        this.addComponent(entity, componentData);

        if(data) {
            properties.forEach(function (value, index, arr) {
                this.set(entity, value, data[value]);                
            }, this);            
        }
        
        return componentData;        
    };
    
    AudioSourceComponentSystem.prototype.update = function(dt) {
        var listenerEntity = this.context.systems.audiolistener.getListener();
        var listenerPosition;
        var position;
        var offset = pc.math.vec3.create();
        var id;
        var entity;
        var component;
        var components = this._getComponents();
        var volume;
        var gradient = 1/ 10;
        
        if(listenerEntity) {
            listenerPosition = pc.math.mat4.getTranslation(listenerEntity.getLocalTransform());
            
            for(id in components) {
                if(components.hasOwnProperty(id)) {
                    entity = components[id].entity;
                    component = components[id].component;
    
                    position = pc.math.mat4.getTranslation(entity.getLocalTransform());

                    if(component.audio.setListenerPosition) {
                        component.audio.setListenerPosition(listenerPosition);
                    }
                    if(component.audio.setPosition) {
                        component.audio.setPosition(position);
                    }
                }
            }            
        }
    };
    
    AudioSourceComponentSystem.prototype.play = function(entity) {
        var componentData = this._getComponentData(entity);
        componentData.audio.play();
    };
    
    AudioSourceComponentSystem.prototype.pause = function(entity) {
        var componentData = this._getComponentData(entity);
        componentData.audio.pause();
    };
    
    AudioSourceComponentSystem.prototype.isPaused = function(entity) {
        var componentData = this._getComponentData(entity);
        return componentData.audio.isPaused();
    }
    
    return {
        AudioSourceComponentSystem: AudioSourceComponentSystem
    };
}());
