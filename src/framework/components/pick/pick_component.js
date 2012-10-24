pc.extend(pc.fw, function () {
    
    /**
     * @name pc.fw.PickComponentSystem
     * @constructor Create a new PickComponentSystem
     * @class Allows an Entity to be picked from the scene using a pc.fw.picking.Picker Object
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var PickComponentSystem = function PickComponentSystem(context) {
        context.systems.add("pick", this);    

        // Dictionary of layers: name -> array of models
        this.layers = {
            'default': []
        };
        this.display = false;
    };
    
    PickComponentSystem = pc.inherits(PickComponentSystem, pc.fw.ComponentSystem);
    
    PickComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.PickComponentData();

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
        componentData.material = material;

        this.initializeComponent(entity, componentData, data, []);

        return componentData;
    };
    
    PickComponentSystem.prototype.deleteComponent = function (entity) {
        var componentData = this.getComponentData(entity);        

        this.deleteShapes(entity);

        this.removeComponent(entity);
    };
    
    PickComponentSystem.prototype.render = function () {
        if (this.display) {
            // Render the pick shapes here
            var componentData;
            var components = this.getComponents();
            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var entity = components[id].entity;
                    componentData = components[id].component;
                    for (var i = 0; i < componentData.shapes.length; i++) {
                        var model = componentData.shapes[i].model;
                        model.dispatch();
                    }
                }
            }
        }
    };

    PickComponentSystem.prototype.addShape = function (entity, shape, shapeName) {
        var componentData = this.getComponentData(entity);

        var geometry = null;
        switch (shape.type) {
            case pc.shape.Type.BOX:
                geometry = pc.scene.procedural.createBox({
                    material: componentData.material, 
                    halfExtents: shape.halfExtents
                });
                break;
            case pc.shape.Type.SPHERE:
                geometry = pc.scene.procedural.createSphere({
                    material: componentData.material,
                    radius: shape.radius
                });
                break;
            case pc.shape.Type.TORUS:
                geometry = pc.scene.procedural.createTorus({
                    material: componentData.material,
                    tubeRadius: shape.iradius,
                    ringRadius: shape.oradius
                });
                break;
        }

        var mesh = new pc.scene.MeshNode();
        mesh.setGeometry(geometry);

        var model = new pc.scene.Model();
        model.getGeometries().push(geometry);
        model.getMaterials().push(componentData.material);
        model.getMeshes().push(mesh);
        model.setGraph(mesh);

        model._entity = entity;

        componentData.shapes.push({
            shape: shape,
            shapeName: shapeName,
            model: model
        });

        if (this.layers[componentData.layer] === undefined) {
            this.layers[componentData.layer] = [];
        }
        this.layers[componentData.layer].push(model);
    };

    PickComponentSystem.prototype.deleteShapes = function (entity) {
        var componentData = this.getComponentData(entity);

        var layerModels = this.layers[componentData.layer];
        for (var i = 0; i < componentData.shapes.length; i++) {
            var model = componentData.shapes[i].model;
            var index = layerModels.indexOf(model);
            if (index !== -1) {
                layerModels.splice(index, 1);
            }
        }

        componentData.shapes = [];
    };

    PickComponentSystem.prototype.getLayerModels = function (layerName) {
        return this.layers[layerName];
    };

    return {
        PickComponentSystem: PickComponentSystem
    };
}());
