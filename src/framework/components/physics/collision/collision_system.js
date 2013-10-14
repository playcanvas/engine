pc.extend(pc.fw, function () {
   
    var CollisionComponentSystem = function CollisionComponentSystem (context) {
        this.id = "collision";
        this.description = "Specifies a collision volume.";
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.CollisionComponent;
        this.DataType = pc.fw.CollisionComponentData;

        this.schema = [{
            name: "type",
            displayName: "Type",
            description: "The type of the collision volume",
            type: "enumeration",
            options: {
                enumerations: [{
                    name: 'Box',
                    value: 'Box'
                }, {
                    name: 'Sphere',
                    value: 'Sphere'
                }, {
                    name: 'Capsule',
                    value: 'Capsule'
                }, {
                    name: 'Mesh',
                    value: 'Mesh'
                }]
            },
            defaultValue: "Box"
        },{
            name: "halfExtents",
            displayName: "Half Extents",
            description: "The half-extents of the box",
            type: "vector",
            options: {
                min: 0,
                step: 0.1
            },
            defaultValue: [0.5, 0.5, 0.5],
            filter: {
                type: "Box"
            }
        }, {
            name: "radius",
            displayName: "Radius",
            description: "The radius of the collision volume",
            type: "number",
            options: {
                min: 0,
                step: 0.1
            },
            defaultValue: 0.5,
            filter: {
                type: ["Sphere", "Capsule"]
            }
        }, {
            name: "axis",
            displayName: "Axis",
            description: "Major axis of capsule",
            type: "enumeration",
            options: {
                enumerations: [{
                    name: 'X',
                    value: 0
                }, {
                    name: 'Y',
                    value: 1
                }, {
                    name: 'Z',
                    value: 2
                }]
            },
            defaultValue: 1,
            filter: {
                type: "Capsule"
            }
        }, {
            name: "height",
            displayName: "Height",
            description: "The height of the collision capsule",
            type: "number",
            options: {
                min: 0,
                step: 0.1
            },
            defaultValue: 2,
            filter: {
                type: "Capsule"
            }
        }, {
            name: "shape",
            exposed: false
        }, {
            name: 'model',
            exposed: false
        }];

        this.exposeProperties();
        this.implementations = {};
        this.debugRender = false;

        this.on('remove', this.onRemove, this);

        pc.fw.ComponentSystem.on('update', this.onUpdate, this);
        pc.fw.ComponentSystem.on('toolsUpdate', this.onToolsUpdate, this);
    };

    CollisionComponentSystem = pc.inherits(CollisionComponentSystem, pc.fw.ComponentSystem);

    CollisionComponentSystem.prototype = pc.extend(CollisionComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {

            if (!data.type) {
                data.type = component.data.type;
            }

            component.data.type = data.type;

            var impl = this._createImplementation(data.type);
            impl.initialize(component, data);

            properties = ['halfExtents', 'radius', 'axis', 'height', 'shape', 'model'];
            CollisionComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        _createImplementation: function (type) {
            if (typeof this.implementations[type] === 'undefined') {
                var impl;
                switch (type) {
                    case 'Box':
                        impl = new CollisionBoxSystemImpl(this);
                        break;
                    case 'Sphere':
                        impl = new CollisionSphereSystemImpl(this);
                        break;
                    case 'Capsule':
                        impl = new CollisionCapsuleSystemImpl(this);
                        break;
                    case 'Mesh':
                        impl = new CollisionMeshSystemImpl(this);
                        break;
                    default:
                        throw "Invalid collision system type: " + type;
                        break;
                }
                this.implementations[type] = impl;
            }

            return this.implementations[type];
        },

        _getImplementation: function (entity) {
            return this.implementations[entity.collider.data.type];
        },

        cloneComponent: function (entity, clone) {
            return this._getImplementation(entity).clone(entity, clone);
        },
        
        onRemove: function (entity, data) {
            this.implementations[data.type].remove(entity, data);
        },

        onUpdate: function (dt) {
            if (this.debugRender) {
                this.updateDebugShapes();
            }
        },

        updateDebugShapes: function () {
            var id, entity, data, impl;
            var components = this.store;
            var context = this.context;

            for (id in components) {
                entity = components[id].entity;
                data = components[id].data;
                impl = this._getImplementation(entity);

                if (!context.scene.containsModel(data.model)) {
                    context.scene.addModel(data.model);
                    context.root.addChild(data.model.graph);
                }

                if (typeof impl !== 'undefined') {
                    impl.updateDebugShape(entity, data);
                }
            }
        },

        onToolsUpdate: function (dt) {
            this.updateDebugShapes();
        },

        /**
        * @function
        * @name pc.fw.CollisionComponentSystem#setDebugRender
        * @description Display collision shape outlines
        * @param {Boolean} value Enable or disable
        */
        setDebugRender: function (value) {
            this.debugRender = value;
        },

        changeShape: function (component, previousShape, newShape) {
             this.implementations[previousShape].remove( component.entity, component.data);
             this._createImplementation(newShape).initialize(component, component.data);
        },

        refreshPhysicalShapes: function (component) {
            this.implementations[component.data.type].refreshPhysicalShapes(component); 
        }
    });

    /** 
    * Collision system implementations
    */
    CollisionSystemImpl = function (system) {
        this.system = system;
    };

    CollisionSystemImpl.prototype = {
        initialize: function (component, data) {
            this.createDebugShape(data);
            data.shape = this.createPhysicalShape(data);

            data.model = new pc.scene.Model();
            data.model.graph = new pc.scene.GraphNode();
            data.model.meshInstances = [ new pc.scene.MeshInstance(data.model.graph, this.mesh, this.material) ]; 

            if (component.entity.rigidbody) {
                component.entity.rigidbody.createBody();
            } else {
                if (typeof(Ammo) !== 'undefined') {
                    component.entity.trigger = new pc.fw.Trigger(this.system.context, component, data);
                }
            }
        },

        refreshPhysicalShapes: function (component) {
            var entity = component.entity;
            var data = component.data;

            if (entity.rigidbody) {
                data.shape = this.createPhysicalShape(data);
                component.rigidbody.createBody();
            } else if (entity.trigger) {
                data.shape = this.createPhysicalShape(data);
                entity.trigger.initialize(data);
            }
        },

        createDebugShape: function (data) {
            return undefined;
        },

        createPhysicalShape: function (data) {
            return undefined;
        },

        updateDebugShape : function (entity, data) {

        },

        remove: function (entity, data) {
            var context = this.system.context;
            if (entity.rigidbody && entity.rigidbody.body) {
                context.systems.rigidbody.removeBody(entity.rigidbody.body);
            }

            if (entity.trigger) {
                entity.trigger.destroy();
            }

            if (context.scene.containsModel(data.model)) {
                context.root.removeChild(data.model.graph);
                context.scene.removeModel(data.model);
            }
        },

        clone: function (entity, clone) {
            CollisionComponentSystem._super.clone.call(this.system, entity, clone);
        }
    };

    /**
    /* Box Collision System
    */
    CollisionBoxSystemImpl = function (system) {};

    CollisionBoxSystemImpl = pc.inherits(CollisionBoxSystemImpl, CollisionSystemImpl);

    CollisionBoxSystemImpl.prototype = pc.extend(CollisionBoxSystemImpl.prototype, {

        createDebugShape: function (data) {
            if (!this.mesh) {
                var gd = this.system.context.graphicsDevice;

                var format = new pc.gfx.VertexFormat(gd, [
                    { semantic: pc.gfx.SEMANTIC_POSITION, components: 3, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
                ]);

                var vertexBuffer = new pc.gfx.VertexBuffer(gd, format, 8);
                var positions = new Float32Array(vertexBuffer.lock());
                positions.set([
                    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5,
                    -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5
                ]);
                vertexBuffer.unlock();

                var indexBuffer = new pc.gfx.IndexBuffer(gd, pc.gfx.INDEXFORMAT_UINT8, 24);
                var indices = new Uint8Array(indexBuffer.lock());
                indices.set([
                    0,1,1,2,2,3,3,0,
                    4,5,5,6,6,7,7,4,
                    0,4,1,5,2,6,3,7
                ]);
                indexBuffer.unlock();

                var mesh = new pc.scene.Mesh();
                mesh.vertexBuffer = vertexBuffer;
                mesh.indexBuffer[0] = indexBuffer;
                mesh.primitive[0].type = pc.gfx.PRIMITIVE_LINES;
                mesh.primitive[0].base = 0;
                mesh.primitive[0].count = indexBuffer.getNumIndices();
                mesh.primitive[0].indexed = true;
                this.mesh = mesh;
            }

            if (!this.material) {
                var material = new pc.scene.BasicMaterial();
                material.color = pc.math.vec4.create(0, 0, 1, 1);
                material.update()
                this.material = material;
            }

        },

        createPhysicalShape: function (data) {
            if (typeof(Ammo) !== 'undefined') {
                return new Ammo.btBoxShape( 
                    new Ammo.btVector3( 
                        data.halfExtents[0], data.halfExtents[1], data.halfExtents[2]
                    ));    
            } else {
                return undefined;
            }
        },

        updateDebugShape : function (entity, data) {
            var x = data.halfExtents[0];
            var y = data.halfExtents[1];
            var z = data.halfExtents[2];

            var root = data.model.graph;
            root.setPosition(entity.getPosition());
            root.setRotation(entity.getRotation());
            root.setLocalScale(x / 0.5, y / 0.5, z / 0.5);
        },

        clone: function (entity, clone) {
            var src = this.system.dataStore[entity.getGuid()];
            var data = {
                halfExtents: pc.extend([], src.data.halfExtents)
            };
            return this.system.addComponent(clone, data); 
        }
    });

    /**
    /* Sphere Collision System
    */
    
    CollisionSphereSystemImpl = function (system) {};

    CollisionSphereSystemImpl = pc.inherits(CollisionSphereSystemImpl, CollisionSystemImpl);

    CollisionSphereSystemImpl.prototype = pc.extend(CollisionSphereSystemImpl.prototype, {
        createDebugShape: function (data) {
            if (!this.mesh) {
                var context = this.system.context;
                var gd = context.graphicsDevice;

                // Create the graphical resources required to render a camera frustum
                var format = new pc.gfx.VertexFormat(gd, [
                    { semantic: pc.gfx.SEMANTIC_POSITION, components: 3, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
                ]);

                var vertexBuffer = new pc.gfx.VertexBuffer(gd, format, 41);
                var positions = new Float32Array(vertexBuffer.lock());

                var i;
                var r = 0.5;
                var numVerts = vertexBuffer.getNumVertices();
                for (i = 0; i < numVerts-1; i++) {
                    var theta = 2 * Math.PI * (i / (numVerts-2));
                    var x = r * Math.cos(theta);
                    var z = r * Math.sin(theta);
                    positions[(i)*3+0] = x;
                    positions[(i)*3+1] = 0;
                    positions[(i)*3+2] = z;
                }
                vertexBuffer.unlock();

                var indexBuffer = new pc.gfx.IndexBuffer(gd, pc.gfx.INDEXFORMAT_UINT8, 80);
                var inds = new Uint8Array(indexBuffer.lock());
                for (i = 0; i < 40; i++) {
                    inds[i * 2 + 0] = i;
                    inds[i * 2 + 1] = i + 1;
                }
                indexBuffer.unlock();

                var mesh = new pc.scene.Mesh();
                mesh.vertexBuffer = vertexBuffer;
                mesh.indexBuffer[0] = indexBuffer;
                mesh.primitive[0].type = pc.gfx.PRIMITIVE_LINES;
                mesh.primitive[0].base = 0;
                mesh.primitive[0].count = indexBuffer.getNumIndices();
                mesh.primitive[0].indexed = true;
                this.mesh = mesh;
            }
            
            if (!this.material) {
                var material = new pc.scene.BasicMaterial();
                material.color = pc.math.vec4.create(0, 0, 1, 1);
                material.update();
                this.material = material;
            }
        },

        createPhysicalShape: function (data) {
            if (typeof(Ammo) !== 'undefined') {
                return new Ammo.btSphereShape(data.radius);   
            } else {
                return undefined;
            }
        },

        updateDebugShape: function (entity, data) {
            var r = data.radius;
            var root = data.model.graph;
            root.setPosition(entity.getPosition());
            root.setRotation(entity.getRotation());
            root.setLocalScale(r / 0.5, r / 0.5, r / 0.5);
        }
    });

    /**
    /* Capsule Collision System
    */
    
    CollisionCapsuleSystemImpl = function (system) {};

    CollisionCapsuleSystemImpl = pc.inherits(CollisionCapsuleSystemImpl, CollisionSystemImpl);

    CollisionCapsuleSystemImpl.prototype = pc.extend(CollisionCapsuleSystemImpl.prototype, {
        createDebugShape: function (data) {            
            if (!this.mesh) {
                var gd = this.system.context.graphicsDevice;

                // Create the graphical resources required to render a capsule shape
                var format = new pc.gfx.VertexFormat(gd, [
                    { semantic: pc.gfx.SEMANTIC_POSITION, components: 3, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
                ]);

                var vertexBuffer = new pc.gfx.VertexBuffer(gd, format, 328, pc.gfx.BUFFER_DYNAMIC);
                this.updateCapsuleShape(data, vertexBuffer);

                var mesh = new pc.scene.Mesh();
                mesh.vertexBuffer = vertexBuffer;
                mesh.primitive[0].type = pc.gfx.PRIMITIVE_LINES;
                mesh.primitive[0].base = 0;
                mesh.primitive[0].count = vertexBuffer.getNumVertices();
                mesh.primitive[0].indexed = false;
                
                this.mesh = mesh;
            }
            
            if (!this.material) {
                var material = new pc.scene.BasicMaterial();
                material.color = pc.math.vec4.create(0, 0, 1, 1);
                material.update();
                this.material = material;    
            }
        },

        updateCapsuleShape: function(data, vertexBuffer) {
            var axis = (typeof data.axis !== 'undefined') ? data.axis : 1;
            var radius = data.radius || 0.5;
            var height = Math.max((data.height || 2) - 2 * radius, 0);

            var positions = new Float32Array(vertexBuffer.lock());

            var xo = 0;
            var yo = 1;
            var zo = 2;
            if (axis === 0) {
                xo = 1;
                yo = 0;
                zo = 2;
            } else if (axis === 2) {
                xo = 0;
                yo = 2;
                zo = 1;
            }

            var i, x = 0;
            var theta;
            // Generate caps
            for (cap = -1; cap < 2; cap += 2) {
                for (i = 0; i < 40; i++) {
                    theta = 2 * Math.PI * (i / 40);
                    positions[x+xo] = radius * Math.cos(theta);
                    positions[x+yo] = cap * height * 0.5;
                    positions[x+zo] = radius * Math.sin(theta);
                    x += 3;

                    theta = 2 * Math.PI * ((i + 1) / 40);
                    positions[x+xo] = radius * Math.cos(theta);
                    positions[x+yo] = cap * height * 0.5;
                    positions[x+zo] = radius * Math.sin(theta);
                    x += 3;
                }

                for (i = 0; i < 20; i++) {
                    theta = Math.PI * (i / 20) + Math.PI * 1.5;
                    positions[x+xo] = 0;
                    positions[x+yo] = cap * (height * 0.5 + radius * Math.cos(theta));
                    positions[x+zo] = cap * (radius * Math.sin(theta));
                    x += 3;

                    theta = Math.PI * ((i + 1) / 20) + Math.PI * 1.5;
                    positions[x+xo] = 0;
                    positions[x+yo] = cap * (height * 0.5 + radius * Math.cos(theta));
                    positions[x+zo] = cap * (radius * Math.sin(theta));
                    x += 3;
                }

                for (i = 0; i < 20; i++) {
                    theta = Math.PI * (i / 20) + Math.PI * 1.5;
                    positions[x+xo] = cap * (radius * Math.sin(theta));
                    positions[x+yo] = cap * (height * 0.5 + radius * Math.cos(theta));
                    positions[x+zo] = 0;
                    x += 3;

                    theta = Math.PI * ((i + 1) / 20) + Math.PI * 1.5;
                    positions[x+xo] = cap * (radius * Math.sin(theta));
                    positions[x+yo] = cap * (height * 0.5 + radius * Math.cos(theta));
                    positions[x+zo] = 0;
                    x += 3;
                }
            }

            // Connect caps
            for (i = 0; i < 4; i++) {
                theta = 2 * Math.PI * (i / 4);
                positions[x+xo] = radius * Math.cos(theta);
                positions[x+yo] = height * 0.5;
                positions[x+zo] = radius * Math.sin(theta);
                x += 3;

                theta = 2 * Math.PI * (i / 4);
                positions[x+xo] = radius * Math.cos(theta);
                positions[x+yo] = -height * 0.5;
                positions[x+zo] = radius * Math.sin(theta);
                x += 3;
            }

            vertexBuffer.unlock();
        },

        createPhysicalShape: function (data) {
            var shape = null;
            var axis = (typeof data.axis !== 'undefined') ? data.axis : 1;
            var radius = data.radius || 0.5;
            var height = Math.max((data.height || 2) - 2 * radius, 0);

            if (typeof(Ammo) !== 'undefined') {
                switch (axis) {
                    case 0:
                        shape = new Ammo.btCapsuleShapeX(radius, height);
                        break;
                    case 1:
                        shape = new Ammo.btCapsuleShape(radius, height);
                        break;
                    case 2:
                        shape = new Ammo.btCapsuleShapeZ(radius, height);
                        break;
                }
            }
            return shape;
        },

        updateDebugShape: function (entity, data) {
            var root = data.model.graph;
            root.setPosition(entity.getPosition());
            root.setRotation(entity.getRotation());
            root.setLocalScale(1, 1, 1);
        },

        refreshPhysicalShapes: function (component) {
            var model = component.data.model;
            if (model) {
                var vertexBuffer = model.meshInstances[0].mesh.vertexBuffer; 
                this.updateCapsuleShape(component.data, vertexBuffer);
                CollisionCapsuleSystemImpl._super.refreshPhysicalShapes.call(this, component);
            }
        },
    });

    /**
    /* Mesh Collision System
    */
    
    CollisionMeshSystemImpl = function (system) {};

    CollisionMeshSystemImpl = pc.inherits(CollisionMeshSystemImpl, CollisionSystemImpl);

    CollisionMeshSystemImpl.prototype = pc.extend(CollisionMeshSystemImpl.prototype, {
        
    });

    return {
        CollisionComponentSystem: CollisionComponentSystem
    };
}());