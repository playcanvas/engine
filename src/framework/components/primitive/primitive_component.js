pc.extend(pc.fw, function () {
    /**
    * @component
    * @name pc.fw.PrimitiveComponent
    * @class The Primitive Component renders a Primitive shape (cube, sphere, cone, etc) attached to the Entity.
    * @param {pc.fw.PrimitiveComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.fw.Entity} entity The Entity that this Component is attached to.    
    * @extends pc.fw.Component
    * @property {pc.shape.Type} type The type of primitive
    * @property {String} color The color of the primitive
    * @property {Boolean} castShadows If true, the primitive will cast shadows. Only for lights that have shadow casting enabled.
    * @property {Boolean} receiveShadows If true, the primitive will have shadows cast onto it.
    * @property {pc.scene.Material} material The material used to render the primitive
    * @property {pc.scene.Model} model The model geometry that is used to render the primitive
    */    
    var PrimitiveComponent = function PrimitiveComponent(system, entity) {
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
         * @name pc.fw.PrimitiveComponent#onSetType
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
         * @name pc.fw.PrimitiveComponent#onSetColor
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

    return {
        PrimitiveComponent: PrimitiveComponent,
    };
}());