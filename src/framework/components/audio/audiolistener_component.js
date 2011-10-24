pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.AudioListenerComponent
     * @constructor Represents location of listener in the world. All audio sources are played back as if the user is at the AudioListener's position
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var AudioListenerComponentSystem = function (context) {
        context.systems.add("audiolistener", this);
        
        this._listener = null;
        
    };        
    AudioListenerComponentSystem = AudioListenerComponentSystem.extendsFrom(pc.fw.ComponentSystem);
        
    AudioListenerComponentSystem.prototype.createComponent = function (entity, data) {
        if(this._listener) {
            throw new Error("Only one Audio Listener allowed")
        }
        
        var componentData = new pc.fw.AudioListenerComponentData();
        
        for (attribute in data) {
            if (data.hasOwnProperty(attribute)) {
                componentData[attribute] = data[attribute];
            }
        }
        
        this._listener = entity;
        this.addComponent(entity, componentData);
    };
    
    AudioListenerComponentSystem.prototype.update = function(dt) {
    };
    
    AudioListenerComponentSystem.prototype.getListener = function () {
        return this._listener;
    };
    
    return {
        AudioListenerComponentSystem: AudioListenerComponentSystem
    };
}());
