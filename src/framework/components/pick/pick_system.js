pc.extend(pc, function () {

    /**
     * @name pc.PickComponentSystem
     * @constructor Create a new PickComponentSystem
     * @class Allows an Entity to be picked from the scene using a pc.picking.Picker Object
     * @param {pc.Application} app The Application.
     * @extends pc.ComponentSystem
     */
    var PickComponentSystem = function PickComponentSystem(app) {
        this.id = "pick";
        app.systems.add(this.id, this);

        this.ComponentType = pc.PickComponent;
        this.DataType = pc.PickComponentData;

        this.schema = [
            'layer',
            'shapes',
            'material'
        ];

        // Dictionary of layers: name -> array of models
        this.layers = {
            'default': []
        };
        this.display = false;

        this.on('remove', this.onRemove, this);
    };

    PickComponentSystem = pc.inherits(PickComponentSystem, pc.ComponentSystem);

    pc.extend(PickComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            // This material is swapped out for a pick material by the pc.Picker. However,
            // since it's useful to debug the pick shapes visually, we'll put a default phong
            // material on the pick shapes.
            data.material = new pc.PhongMaterial();

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
                this.app.scene.addModel(shape.model);
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
                    this.app.scene.removeModel(model);
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
