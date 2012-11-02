pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.ModelComponentSystem
     * @constructor Create a new ModelComponentSystem
     * @class Allows an Entity to render a model
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var ModelComponentSystem = function ModelComponentSystem (context) {
        this.context = context;
        this.id = 'model';

        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.ModelComponent;
        this.DataType = pc.fw.ModelComponentData;
        
    }
    ModelComponentSystem = pc.inherits(ModelComponentSystem, pc.fw.ComponentSystem);
    
    pc.extend(ModelComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            properties = ['asset', 'castShadows', 'receiveShadows'];            
            ModelComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        removeComponent: function (entity, data) {
            // TODO: I'm sure this will fail
            entity.model.asset = null;
            // this.set(entity, 'asset', null);
            // this.removeComponent(entity);
        }
    });

    return {
        ModelComponentSystem: ModelComponentSystem
    }
}());

