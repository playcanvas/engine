pc.extend(pc.fw, function () {
    var AudioListenerComponentSystem = function (context, audioContext) {
        context.systems.add("audiolistener", this);
        
        this.audioContext = audioContext;

    };        
    AudioListenerComponentSystem = AudioListenerComponentSystem.extendsFrom(pc.fw.ComponentSystem);
        
    AudioListenerComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.AudioDestinationComponentData();

        data = data || {};
        this.initialiseComponent(entity, componentData, data, []);

        if (data['activate']) {
            this.setCurrentDestination(entity);   
        }

        return componentData;
    };

    AudioListenerComponentSystem.prototype.update = function (dt) {
    };

    AudioListenerComponentSystem.prototype.getCurrentDestination = function () {
        return this._currentEntity;
    };
    
    AudioListenerComponentSystem.prototype.setCurrentDestination = function (entity) {
        this._currentEntity = entity;
        this.set(entity, 'audioNode', this.audioContext.destination);
    };
    
    return {
        AudioListenerComponentSystem : AudioListenerComponentSystem 
    };
}());
