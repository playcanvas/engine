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

        this.exposeProperties();
    
        // Dictionary of layers: name -> array of models
        this.layers = {
            'default': []
        };
        this.display = false;

        pc.fw.ComponentSystem.bind('toolsUpdate', this.onUpdate.bind(this));
        this.bind('remove', this.onRemove.bind(this));
    };
    
    PickComponentSystem = pc.inherits(PickComponentSystem, pc.fw.ComponentSystem);
        
    pc.extend(PickComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            // This material is swapped out for a pick material by the pc.scene.Picker. However,
            // since it's useful to debug the pick shapes visually, we'll put a default phong
            // material on the pick shapes.
            var material = new pc.scene.Material();
            material.setProgramName('phong');
            material.setParameter('material_diffuse', [1,1,1]);
            material.setParameter('material_ambient', [1,1,1]);
            material.setParameter('material_specular', [0,0,0]);
            material.setParameter('material_emissive', [0,0,0]);
            material.setParameter('material_shininess', 0);
            material.setParameter('material_opacity', 1)
            data.material = material;

            properties = ['material'];
            PickComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        onRemove: function (entity, data) {
            this.deleteShapes(data.layer, data.shapes);
        },

        onUpdate: function (dt) {
            if (this.display) {
                // Render the pick shapes here
                var componentData;
                var components = this.store;
                for (var id in components) {
                    if (components.hasOwnProperty(id)) {
                        var entity = components[id].entity;
                        componentData = components[id].data;

                        for (var i = 0; i < componentData.shapes.length; i++) {
                            this.context.scene.enqueue('opaque', function (model) {
                                return function () {
                                    model.dispatch();
                                }
                            }(componentData.shapes[i].model));
                        }

                    }
                }
            }
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
                if(this.display) {
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
