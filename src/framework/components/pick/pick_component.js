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

        this.display = false;
    };
    
    PickComponentSystem = PickComponentSystem.extendsFrom(pc.fw.ComponentSystem);
    
    PickComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.PickComponentData();

        this.initialiseComponent(entity, componentData, data, []);

        return componentData;
    };
    
    PickComponentSystem.prototype.deleteComponent = function (entity) {
        var componentData = this._getComponentData(entity);        
        componentData.shapes = [];
        componentData.geometries = [];
        
        this.removeComponent(entity);
    };
    
    PickComponentSystem.prototype.render = function () {
        if (this.display) {
            this.draw();
        }
    };
    
    PickComponentSystem.prototype.draw = function (prefunc) {
        var components = this._getComponents();
        
        for (var id in components) {
            if (components.hasOwnProperty(id)) {
                var entity = components[id].entity;
                var componentData = components[id].component;
                var numGeometries = componentData.geometries.length;

                for (var index = 0; index < numGeometries; index++) {
                    if (prefunc) {
                        prefunc(entity, componentData, index);
                    }
                    var transform = componentData.shapes[index].transform;
                    componentData.geometries[index].dispatch(transform);
                }
            }
        }
    };
    
    PickComponentSystem.prototype.addShape = function(entity, shape) {
        var componentData = this._getComponentData(entity);

        var geometry = null;
        switch (shape.type) {
            case pc.shape.Type.BOX:
                geometry = pc.scene.procedural.createBox({
                    material: componentData.pickMaterial, 
                    halfExtents: shape.halfExtents
                });
                break;
            case pc.shape.Type.SPHERE:
                geometry = pc.scene.procedural.createSphere({
                    material: componentData.pickMaterial,
                    radius: shape.radius
                });
                break;
            case pc.shape.Type.TORUS:
                geometry = pc.scene.procedural.createTorus({
                    material: componentData.pickMaterial,
                    tubeRadius: shape.iradius,
                    ringRadius: shape.oradius
                });
                break;
        }
        componentData.shapes.push(shape);
        componentData.geometries.push(geometry);
    };
    
    PickComponentSystem.prototype.getShape = function(entity, index) {
        return this._getComponentData(entity).shapes[index];
    };

    PickComponentSystem.prototype.setRenderColor = function (entity, color) {
        var componentData = this._getComponentData(entity);
        componentData.pickMaterial.setParameter("pick_color", color);
    };
    
    return {
        PickComponentSystem: PickComponentSystem
    };
    
}());
