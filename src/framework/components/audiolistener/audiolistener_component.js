pc.extend(pc.fw, function () {
    var AudioListenerComponentSystem = function (context, manager) {
        context.systems.add("audiolistener", this);
        
        this.manager = manager;
        this.current = null;
    };        
    AudioListenerComponentSystem = AudioListenerComponentSystem.extendsFrom(pc.fw.ComponentSystem);
        
    AudioListenerComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.AudioListenerComponentData();

        data = data || {};
        this.initialiseComponent(entity, componentData, data, []);

        this.setCurrentListener(entity);   

        return componentData;
    };

    AudioListenerComponentSystem.prototype.update = function (dt) {
        if (this.current) {
            var wtm = this.current.getWorldTransform();
            var pos = pc.math.mat4.getTranslation(wtm);
            this.manager.listener.setPosition(pos);
            this.manager.listener.setOrientation(wtm);
        }
    };
    
    AudioListenerComponentSystem.prototype.setCurrentListener = function (entity) {
        if (this.hasComponent(entity)) {
            this.current = entity;
            var pos = pc.math.mat4.getTranslation(this.current.getWorldTransform());
            this.manager.listener.setPosition(pos);
        }
    };

    return {
        AudioListenerComponentSystem : AudioListenerComponentSystem 
    };
}());
