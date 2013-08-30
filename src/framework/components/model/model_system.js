pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.ModelComponentSystem
     * @constructor Create a new ModelComponentSystem
     * @class Allows an Entity to render a model
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var ModelComponentSystem = function ModelComponentSystem (context) {
        this.id = 'model';
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.ModelComponent;
        this.DataType = pc.fw.ModelComponentData;

        this.schema = [{
            name: "asset",
            displayName: "Asset",
            description: "Model Asset to render",
            type: "asset",
            options: {
                max: 1,
                type: 'model'
            },
            defaultValue: null
        }, {
            name: "castShadows",
            displayName: "Cast shadows",
            description: "Occlude light from shadow casting lights",
            type: "boolean",
            defaultValue: false
        }, {
            name: "receiveShadows",
            displayName: "Receive shadows",
            description: "Receive shadows cast from occluders",
            type: "boolean",
            defaultValue: true
        }, {
            name: "model",
            exposed: false
        }];

        this.exposeProperties();
    };
    ModelComponentSystem = pc.inherits(ModelComponentSystem, pc.fw.ComponentSystem);
    
    pc.extend(ModelComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            properties = ['asset', 'castShadows', 'receiveShadows'];            
            ModelComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        removeComponent: function (entity, data) {
            entity.model.asset = null;
        },

        cloneComponent: function (entity, clone) {
            var component = this.addComponent(clone, {});
            
            clone.model.data.asset = entity.model.asset;
            clone.model.data.castShadows = entity.model.castShadows;
            clone.model.data.receiveShadows = entity.model.receiveShadows;
            if (entity.model.model) {
                clone.model.model = entity.model.model.clone();    
            }
        }
    });

    return {
        ModelComponentSystem: ModelComponentSystem
    };
}());