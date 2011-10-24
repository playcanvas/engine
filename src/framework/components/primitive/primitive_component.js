pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.PrimitiveComponentSystem
     * @constructor Create a new PrimitiveComponentSystem
     * @class The primitive component renders a geometry primitive with the transform of the entity it is attached to.
     * @param {pc.fw.ApplicationContext} context The ApplicationContext for the active application
     */
    var PrimitiveComponentSystem = function PrimitiveComponentSystem(context) {
        context.systems.add("primitive", this);
        
        // Handle changes to the 'type' value
        this.bind("set_type", this.onSetType.bind(this));
        // Handle changes to the 'color' value
        this.bind("set_color", this.onSetColor.bind(this));
    };
    
    PrimitiveComponentSystem = PrimitiveComponentSystem.extendsFrom(pc.fw.ComponentSystem);
    PrimitiveComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.PrimitiveComponentData();
        
        this.initialiseComponent(entity, componentData, data, ['type', 'color']);

        return componentData;
    };      
    
    /**
     * @function
     * @name pc.fw.PrimitiveComponentSystem#render
     * @description Dispatch the geometry on each ComponentData
     */
    PrimitiveComponentSystem.prototype.render = function () {
        var id;
        var transform;
        var scale;
        var components = this._getComponents();
        
        for (id in components) {
            if (components.hasOwnProperty(id)) {
                entity = components[id].entity;
                data = components[id].component;
                
                transform = entity.getWorldTransform();
                
                if (data.geometry) {
                    data.geometry.dispatch(transform);
                }   
            }
        }
    };
    
    /**
     * @function
     * @private
     * @name pc.fw.PrimitiveComponentSystem#onSetType
     * @description Handle changes to the 'type' variable
     */
    PrimitiveComponentSystem.prototype.onSetType = function (entity, name, oldValue, newValue) {
        var data = this._getComponentData(entity);
        var transform;
        var scale;
        
        if(newValue) {
            switch(newValue) {
                case pc.shape.Type.BOX: 
                    // Create a 1x1x1 Box.
                    this.set(entity, "geometry", pc.graph.procedural.createBox({
                        material: data.material, 
                        halfExtents: [0.5,0.5,0.5]
                    }));
                    break;
                case pc.shape.Type.SPHERE:
                    // Create a 1m diameter sphere
                    this.set(entity, "geometry", pc.graph.procedural.createSphere({
                        material: data.material,
                        radius: 0.5
                    }));
                    break;
                case pc.shape.Type.CONE:
                    // Create a cone 1m high and 1m across
                    this.set(entity, "geometry", pc.graph.procedural.createCone({
                        material: data.material,
                        baseRadius: 0.5,
                        peakRadius: 0,
                        height: 1
                    }));
                    break;
                case pc.shape.Type.CYLINDER:
                    // Create a cylinder 1m high and 1m across
                    this.set(entity, "geometry", pc.graph.procedural.createCylinder({
                        material: data.material,
                        radius: 0.5,
                        height: 1
                    }));
                    break;
                default:
                    throw new Error("Unknown shape type: " + newValue);
                    break;
            };
            
        }
    };
    
    /**
     * @function
     * @private
     * @name pc.fw.PrimitiveComponentSystem#onSetColor
     * @description Handle changes to the 'color' variable
     */
    PrimitiveComponentSystem.prototype.onSetColor = function (entity, name, oldValue, newValue) {
        var data = this._getComponentData(entity);
        var rbg = 0;
        var color = [0,0,0];
        
        if(newValue) {
            rgb = parseInt(newValue);
            rgb = pc.math.intToBytes24(rgb);
            color = [
                rgb[0] / 255,
                rgb[1] / 255,
                rgb[2] / 255
            ];
        }

        data.material.setParameter('material_diffuse', color);
        data.material.setParameter('material_ambient', color);
        data.material.setParameter('material_specular', [0,0,0]);
        data.material.setParameter('material_emissive', [0,0,0]);
        data.material.setParameter('material_shininess', 0);
        data.material.setParameter('material_opacity', 1);

    }
    return {
        PrimitiveComponentSystem: PrimitiveComponentSystem
    };
    
}());

