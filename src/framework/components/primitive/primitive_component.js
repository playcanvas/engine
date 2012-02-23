pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.PrimitiveComponentSystem
     * @constructor Create a new PrimitiveComponentSystem
     * @class The primitive component renders a geometry primitive with the transform of the entity it is attached to.
     * @param {pc.fw.ApplicationContext} context The ApplicationContext for the active application
     */
    var PrimitiveComponentSystem = function PrimitiveComponentSystem(context) {
        this.context = context;

        context.systems.add("primitive", this);

        // Handle changes to the 'castShadows' value
        this.bind("set_castShadows", this.onSetCastShadows.bind(this));
        // Handle changes to the 'color' value
        this.bind("set_color", this.onSetColor.bind(this));
        // Handle changes to the 'model' value
        this.bind("set_model", this.onSetModel.bind(this));
        // Handle changes to the 'receiveShadows' value
        this.bind("set_receiveShadows", this.onSetReceiveShadows.bind(this));
        // Handle changes to the 'type' value
        this.bind("set_type", this.onSetType.bind(this));
    };
    
    PrimitiveComponentSystem = PrimitiveComponentSystem.extendsFrom(pc.fw.ComponentSystem);
    PrimitiveComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.PrimitiveComponentData();

        var material = new pc.scene.Material();
        material.setProgramName('phong');
        material.setParameter('material_diffuse', [1,1,1]);
        material.setParameter('material_ambient', [1,1,1]);
        material.setParameter('material_specular', [0,0,0]);
        material.setParameter('material_emissive', [0,0,0]);
        material.setParameter('material_shininess', 0);
        material.setParameter('material_opacity', 1)
        componentData.material = material;

        var attribs = ['castShadows', 'color', 'receiveShadows', 'type'];
        this.initialiseComponent(entity, componentData, data, attribs);

        return componentData;
    };      
    
    PrimitiveComponentSystem.prototype.deleteComponent = function (entity, data) {
        var component = this.getComponentData(entity);

        if (component.model) {
            this.context.scene.removeModel(component.model);
            entity.removeChild(component.model.getGraph());
            component.model = null;
        }
    
        this.removeComponent(entity);
    };
    
    /**
     * @function
     * @private
     * @name pc.fw.PrimitiveComponentSystem#onSetType
     * @description Handle changes to the 'type' variable
     */
    PrimitiveComponentSystem.prototype.onSetType = function (entity, name, oldValue, newValue) {
        var data = this.getComponentData(entity);

        if (newValue) {
            var geometry = null;

            switch (newValue) {
                case pc.shape.Type.BOX: 
                    // Create a 1x1x1 Box.
                    geometry = pc.scene.procedural.createBox({
                        material: data.material, 
                        halfExtents: [0.5,0.5,0.5]
                    });
                    break;
                case pc.shape.Type.SPHERE:
                    // Create a 1m diameter sphere
                    geometry = pc.scene.procedural.createSphere({
                        material: data.material,
                        radius: 0.5
                    });
                    break;
                case pc.shape.Type.CONE:
                    // Create a cone 1m high and 1m across
                    geometry = pc.scene.procedural.createCone({
                        material: data.material,
                        baseRadius: 0.5,
                        peakRadius: 0,
                        height: 1
                    });
                    break;
                case pc.shape.Type.CYLINDER:
                    // Create a cylinder 1m high and 1m across
                    geometry = pc.scene.procedural.createCylinder({
                        material: data.material,
                        radius: 0.5,
                        height: 1
                    });
                    break;
                default:
                    throw new Error("Unknown shape type: " + newValue);
                    break;
            };

            if (this.context.designer) {
                geometry.generateWireframe();
            }

            var mesh = new pc.scene.MeshNode();
            mesh.setGeometry(geometry);

            var model = new pc.scene.Model();
            model.getGeometries().push(geometry);
            model.getMaterials().push(data.material);
            model.getMeshes().push(mesh);
            model.setGraph(mesh);

            this.set(entity, "model", model);
        }
    };

    PrimitiveComponentSystem.prototype.onSetCastShadows = function (entity, name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.getComponentData(entity);
            if (componentData.model) {
                componentData.model.setCastShadows(newValue);
            }
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

    }

    PrimitiveComponentSystem.prototype.onSetModel = function (entity, name, oldValue, newValue) {
        if (oldValue) {
            entity.removeChild(oldValue.getGraph());
            this.context.scene.removeModel(oldValue);
            delete oldValue._entity;
        }
        
        if (newValue) {
            var componentData = this.getComponentData(entity);
            newValue.setCastShadows(componentData.castShadows);
            newValue.setReceiveShadows(componentData.receiveShadows);

            entity.addChild(newValue.getGraph());
            this.context.scene.addModel(newValue);

            // Store the entity that owns this model
            newValue._entity = entity;
        }
    };

    PrimitiveComponentSystem.prototype.onSetReceiveShadows = function (entity, name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.getComponentData(entity);
            if (componentData.model) {
                componentData.model.setReceiveShadows(newValue);
            }
        }
    };

    return {
        PrimitiveComponentSystem: PrimitiveComponentSystem
    };
}());