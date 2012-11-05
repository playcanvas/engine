pc.extend(pc.fw, function () {
    var PrimitiveComponent = function PrimitiveComponent(entity) {
        var schema = [{
            name: "type",
            displayName: "Type",
            description: "Type of primitive",
            type: "enumeration",
            options: {
                enumerations: [{
                    name: 'Box',
                    value: pc.shape.Type.BOX
                }, {
                    name: 'Sphere',
                    value: pc.shape.Type.SPHERE
                }, {
                    name: 'Cylinder',
                    value: pc.shape.Type.CYLINDER
                }, {
                    name: 'Cone',
                    value: pc.shape.Type.CONE
                }]
            },
            defaultValue: "Box"
        }, {
            name: "color",
            displayName: "Color",
            description: "Material color",
            type: "rgb",
            defaultValue: "0xffffff"
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
            name: "material",
            exposed: false
        }, {
            name: "model",
            exposed: false
        }];

        this.assignSchema(schema);

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
    }
    PrimitiveComponent = pc.inherits(PrimitiveComponent, pc.fw.Component);
    pc.extend(PrimitiveComponent.prototype, {
        /**
         * @function
         * @private
         * @name pc.fw.PrimitiveComponentSystem#onSetType
         * @description Handle changes to the 'type' variable
         */
        onSetType: function (name, oldValue, newValue) {
            var data = this.data;//this.getComponentData(entity);

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

                if (this.system.context.designer) {
                    geometry.generateWireframe();
                }

                var mesh = new pc.scene.MeshNode();
                mesh.setGeometry(geometry);

                var model = new pc.scene.Model();
                model.getGeometries().push(geometry);
                model.getMaterials().push(data.material);
                model.getMeshes().push(mesh);
                model.setGraph(mesh);

                this.model = model;
            }
        },

        onSetCastShadows: function (name, oldValue, newValue) {
            if (newValue !== undefined) {
                var componentData = this.data;
                if (componentData.model) {
                    var meshes = componentData.model.getMeshes();
                    for (var i = 0; i < meshes.length; i++) {
                        meshes[i].setCastShadows(newValue);
                    }
                }
            }
        },

        /**
         * @function
         * @private
         * @name pc.fw.PrimitiveComponentSystem#onSetColor
         * @description Handle changes to the 'color' variable
         */
        onSetColor: function (name, oldValue, newValue) {
            var data = this.data;
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
        },

        onSetModel: function (name, oldValue, newValue) {
            if (oldValue) {
                this.entity.removeChild(oldValue.getGraph());
                this.system.context.scene.removeModel(oldValue);
                delete oldValue._entity;
            }
            
            if (newValue) {
                var componentData = this.data;
                var meshes = newValue.getMeshes();
                for (var i = 0; i < meshes.length; i++) {
                    meshes[i].setCastShadows(componentData.castShadows);
                    meshes[i].setReceiveShadows(componentData.receiveShadows);
                }

                this.entity.addChild(newValue.getGraph());
                this.system.context.scene.addModel(newValue);

                // Store the entity that owns this model
                newValue._entity = this.entity;
            }
        },

        onSetReceiveShadows: function (name, oldValue, newValue) {
            if (newValue !== undefined) {
                var componentData = this.data;
                if (componentData.model) {
                    var meshes = componentData.model.getMeshes();
                    for (var i = 0; i < meshes.length; i++) {
                        meshes[i].setReceiveShadows(newValue);
                    }
                }
            }
        }        
    });

    /**
     * @name pc.fw.PrimitiveComponentSystem
     * @constructor Create a new PrimitiveComponentSystem
     * @class The primitive component renders a geometry primitive with the transform of the entity it is attached to.
     * @param {pc.fw.ApplicationContext} context The ApplicationContext for the active application
     */
    var PrimitiveComponentSystem = function PrimitiveComponentSystem(context) {
        this.id = 'primitive'
        this.context = context;
        this.ComponentType = pc.fw.PrimitiveComponent;
        this.DataType = pc.fw.PrimitiveComponentData;

        context.systems.add(this.id, this);

        this.bind('remove', this.onRemove.bind(this));
    };
    PrimitiveComponentSystem = pc.inherits(PrimitiveComponentSystem, pc.fw.ComponentSystem);

    pc.extend(PrimitiveComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            var material = new pc.scene.Material();
            material.setProgramName('phong');
            material.setParameter('material_diffuse', [1,1,1]);
            material.setParameter('material_ambient', [1,1,1]);
            material.setParameter('material_specular', [0,0,0]);
            material.setParameter('material_emissive', [0,0,0]);
            material.setParameter('material_shininess', 0);
            material.setParameter('material_opacity', 1)
            data.material = material;

            properties = ['material', 'castShadows', 'color', 'receiveShadows', 'type'];
            PrimitiveComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        onRemove: function (entity, data) {
            if (data.model) {
                this.context.scene.removeModel(data.model);
                entity.removeChild(data.model.getGraph());
                data.model = null;
            }
        }
    });

    return {
        PrimitiveComponent: PrimitiveComponent,
        PrimitiveComponentSystem: PrimitiveComponentSystem
    };
}());