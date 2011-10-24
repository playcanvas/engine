pc.extend(pc.fw, function () {
    
    var SimpleBodyComponentSystem = function SimpleBodyComponentSystem(context) {
            context.systems.add("simplebody", this);
        };
    SimpleBodyComponentSystem = SimpleBodyComponentSystem.extendsFrom(pc.fw.ComponentSystem);
        
    SimpleBodyComponentSystem.prototype.createComponent = function(entity, data) {
        var componentData = new pc.fw.SimpleBodyComponentData();
        var properties = ["mass", "inertia", "velocity", "force", "angles", "angVelocity", "torque"];
        data = data || {};
        
        this.addComponent(entity, componentData);
        
        properties.forEach(function(value, index, arr) {
            this.set(entity, value, data[value]);
        }, this);
        
        return componentData;
    };
    
    SimpleBodyComponentSystem.prototype.update = function (dt) {
        var components = this._getComponents();
        for (id in components) {
            if (components.hasOwnProperty(id)) {
                entity = components[id].entity;
                component = components[id].component;
                
                var transform = entity.getLocalTransform();
                position = pc.math.mat4.getTranslation(transform),
                rotate = pc.math.mat4.create(),
                translate = pc.math.mat4.create();
                
                // integrate linear
                var acceleration = pc.math.vec3.create(0,0,0);
                var temp = pc.math.vec3.create(0,0,0);
                pc.math.vec3.scale(component.force, 1 / component.mass, acceleration);

                pc.math.vec3.scale(acceleration, dt, temp);
                pc.math.vec3.add(component.velocity, temp, component.velocity);
                
                pc.math.vec3.scale(component.velocity, dt, temp);
                pc.math.vec3.add(position, temp, position);
                
                component.force[0] = 0; component.force[1] = 0; component.force[2] = 0;

                // integrate angular (2D)
                var angAcceleration = pc.math.vec3.create(0,0,0);
                pc.math.vec3.scale(component.torque, 1 / component.inertia, angAcceleration);

                pc.math.vec3.scale(angAcceleration, dt, temp);
                pc.math.vec3.add(component.angVelocity, temp, component.angVelocity);

                pc.math.vec3.scale(component.angVelocity, dt, temp);
                pc.math.vec3.add(component.angles, temp, component.angles);

                component.torque[0] = 0; component.torque[1] = 0; component.torque[2] = 0;
                
                // Re-create transform
                pc.math.mat4.makeRotate(component.angles[1], pc.math.vec3.create(0,1,0), rotate);
                pc.math.mat4.makeTranslate(position[0], position[1], position[2], translate);
                pc.math.mat4.multiply(translate, rotate, transform);
                
                entity.setLocalTransfrom(transform);
            }
        }        
    };
    
    SimpleBodyComponentSystem.prototype.applyForce = function (entity, worldForce, worldOffset) {
        var componentData = this._getComponentData(entity),
        position = pc.math.mat4.getTranslation(entity.getLocalTransform());
        
        pc.math.vec3.add(componentData.force, worldForce, componentData.force);
        
        var temp = pc.math.vec3.create(0,0,0);
        pc.math.vec3.cross(worldOffset, worldForce, temp);
        pc.math.vec3.add(componentData.torque, temp, componentData.torque);
    };
    
    SimpleBodyComponentSystem.prototype.getVelocity = function (entity) {
        return this._getComponentData(entity).velocity;
    };
    
    SimpleBodyComponentSystem.prototype.getAngVelocity = function (entity) {
        return this._getComponentData(entity).angVelocity;
    };
    
    SimpleBodyComponentSystem.prototype.getLinearVelocityAtPoint = function (entity, offset) {
        var componentData = this._getComponentData(entity),
        result = pc.math.vec3.create();
        
        pc.math.vec3.cross(componentData.angVelocity, offset, result);
        pc.math.vec3.add(componentData.velocity, result, result);

        return result;
    };
   
    return {
        SimpleBodyComponentSystem: SimpleBodyComponentSystem
    };
    
}());
