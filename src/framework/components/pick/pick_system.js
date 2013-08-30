pc.extend(pc.fw, function () {
    
    /**
     * @name pc.fw.PickComponentSystem
     * @constructor Create a new PickComponentSystem
     * @class Allows an Entity to be picked from the scene using a pc.fw.picking.Picker Object
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var PickComponentSystem = function PickComponentSystem(context) {
        this.id = "pick";
        context.systems.add(this.id, this);    

        this.ComponentType = pc.fw.PickComponent;
        this.DataType = pc.fw.PickComponentData;
        this.description = 'pc.fw.PickComponent';

        this.schema = [{
            name: 'layer',
            exposed: false
        }, {
            name: 'shapes',
            exposed: false
        }, {
            name: 'material',
            exposed: false
        }];

        // TODO: Fix pick component in Designer
        // this.exposeProperties();
    
        // Dictionary of layers: name -> array of models
        this.layers = {
            'default': []
        };
        this.display = false;

        this.on('remove', this.onRemove, this);
    };
    
    PickComponentSystem = pc.inherits(PickComponentSystem, pc.fw.ComponentSystem);
        
    pc.extend(PickComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            // This material is swapped out for a pick material by the pc.scene.Picker. However,
            // since it's useful to debug the pick shapes visually, we'll put a default phong
            // material on the pick shapes.
            data.material = new pc.scene.PhongMaterial();

            properties = ['material'];
            PickComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        onRemove: function (entity, data) {
            this.deleteShapes(data.layer, data.shapes);
        },

        addShape: function (layer, shape) {
            if (this.layers[layer] === undefined) {
                this.layers[layer] = [];
            }
            this.layers[layer].push(shape.model);

            if (this.display) {
                this.context.scene.addModel(shape.model);    
            }
        },

        deleteShapes: function (layer, shapes) {
            var layerModels = this.layers[layer];
            
            for (var i = 0; i < shapes.length; i++) {
                var model = shapes[i].model;
                var index = layerModels.indexOf(model);
                if (index !== -1) {
                    layerModels.splice(index, 1);
                }
                if (this.display) {
                    this.context.scene.removeModel(model);    
                }
            }
        },

        getLayerModels: function (layerName) {
            return this.layers[layerName];
        }

    });

    return {
        PickComponentSystem: PickComponentSystem
    };
}());
