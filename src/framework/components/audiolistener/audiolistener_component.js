pc.extend(pc.fw, function () {
    var AudioListenerComponentSystem = function (context, manager) {
        context.systems.add("audiolistener", this);
        
        this.manager = manager;
        this.current = null;
        this.worldPos = pc.math.vec3.create();
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
            var wtm = this.current.getWorldTransform();
            this.current.getWorldPosition(this.worldPos);
            this.manager.listener.setPosition(this.worldPos);
            this.manager.listener.setOrientation(wtm);
        }
    };
    
    AudioListenerComponentSystem.prototype.setCurrentListener = function (entity) {
        if (this.hasComponent(entity)) {
            this.current = entity;
            this.current.getWorldPosition(this.worldPos);
            this.manager.listener.setPosition(this.worldPos);
        }
    };

    return {
        AudioListenerComponentSystem : AudioListenerComponentSystem 
    };
}());
