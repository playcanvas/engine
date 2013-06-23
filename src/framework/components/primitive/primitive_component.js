pc.extend(pc.fw, function () {
    /**
    * @component
    * @name pc.fw.PrimitiveComponent
    * @class The Primitive Component renders a Primitive shape (cube, sphere, cone, etc) attached to the Entity.
    * @param {pc.fw.PrimitiveComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.fw.Entity} entity The Entity that this Component is attached to.    
    * @extends pc.fw.Component
    * @property {pc.shape.Type} type The type of primitive
    * @property {pc.Color} color The color of the primitive
    * @property {Boolean} castShadows If true, the primitive will cast shadows. Only for lights that have shadow casting enabled.
    * @property {Boolean} receiveShadows If true, the primitive will have shadows cast onto it.
    * @property {pc.scene.Material} material The material used to render the primitive
    * @property {pc.scene.Model} model The model geometry that is used to render the primitive
    */    
    var PrimitiveComponent = function PrimitiveComponent(system, entity) {
        this.on("set_castShadows", this.onSetCastShadows, this);
        this.on("set_color", this.onSetColor, this);
        this.on("set_model", this.onSetModel, this);
        this.on("set_receiveShadows", this.onSetReceiveShadows, this);
        this.on("set_type", this.onSetType, this);
    };
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
                var mesh = null;

                switch (newValue) {
                    case pc.shape.Type.BOX: 
                        mesh = this.system.box;
                        break;
                    case pc.shape.Type.CAPSULE:
                        mesh = this.system.capsule;
                        break;
                    case pc.shape.Type.SPHERE:
                        mesh = this.system.sphere;
                        break;
                    case pc.shape.Type.CONE:
                        mesh = this.system.cone;
                        break;
                    case pc.shape.Type.CYLINDER:
                        mesh = this.system.cylinder;
                        break;
                    default:
                        throw new Error("Unknown shape type: " + newValue);
                }

                var node = new pc.scene.GraphNode();

                var model = new pc.scene.Model();
                model.graph = node;
                model.meshInstances = [ new pc.scene.MeshInstance(node, mesh, data.material) ];

                if (this.system.context.designer) {
                    model.generateWireframe();
                }

                this.model = model;
            }
        },

        onSetCastShadows: function (name, oldValue, newValue) {
            var model = this.data.model;
            if (model) {
                var scene = this.system.context.scene;
                var inScene = scene.containsModel(model);
                if (inScene) {
                    scene.removeModel(model);
                }

                var meshInstances = model.meshInstances;
                for (var i = 0; i < meshInstances.length; i++) {
                    meshInstances[i].castShadow = newValue;
                }

                if (inScene) {
                    scene.addModel(model);
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

            data.material.ambient[0] = newValue.r;
            data.material.ambient[1] = newValue.g;
            data.material.ambient[2] = newValue.b;
            
            data.material.diffuse[0] = newValue.r;
            data.material.diffuse[1] = newValue.g;
            data.material.diffuse[2] = newValue.b;

            data.material.update();
        },

        onSetModel: function (name, oldValue, newValue) {
            if (oldValue) {
                this.entity.removeChild(oldValue.getGraph());
                this.system.context.scene.removeModel(oldValue);
                delete oldValue._entity;
            }
            
            if (newValue) {
                var componentData = this.data;
                var meshInstances = newValue.meshInstances;
                for (var i = 0; i < meshInstances.length; i++) {
                    meshInstances[i].castShadow = componentData.castShadows;
                    meshInstances[i].receiveShadow = componentData.receiveShadows;
                }

                this.entity.addChild(newValue.graph);
                this.system.context.scene.addModel(newValue);

                // Store the entity that owns this model
                newValue._entity = this.entity;
            }
        },

        onSetReceiveShadows: function (name, oldValue, newValue) {
            if (newValue !== undefined) {
                var componentData = this.data;
                if (componentData.model) {
                    var meshInstances = componentData.model.meshInstances;
                    for (var i = 0; i < meshInstances.length; i++) {
                        meshInstances[i].receiveShadow = newValue;
                    }
                }
            }
        }        
    });

    return {
        PrimitiveComponent: PrimitiveComponent
    };
}());