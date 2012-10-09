pc.extend(pc.fw, function () {
    var AudioListenerComponentSystem = function (context, manager) {
        context.systems.add("audiolistener", this);
        
        this.manager = manager;
        this.current = null;
    };        
    AudioListenerComponentSystem = pc.inherits(AudioListenerComponentSystem, pc.fw.ComponentSystem);
        
    AudioListenerComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.AudioListenerComponentData();

        data = data || {};
        this.initialiseComponent(entity, componentData, data, []);

        this.setCurrentListener(entity);   

        return componentData;
    };

    AudioListenerComponentSystem.prototype.update = function (dt) {
        if (this.current) {
            var position = this.current.getPosition();
            this.manager.listener.setPosition(position);

            var wtm = this.current.getWorldTransform();
            this.manager.listener.setOrientation(wtm);
        }
    };
    
    AudioListenerComponentSystem.prototype.setCurrentListener = function (entity) {
        if (this.hasComponent(entity)) {
            this.current = entity;
            var position = this.current.getPosition();
            this.manager.listener.setPosition(position);
        }
    };

    return {
        AudioListenerComponentSystem : AudioListenerComponentSystem 
    };
}());
