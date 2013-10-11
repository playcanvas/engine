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
        this.debugRender = false;

        this.on('remove', this.onRemove, this);

        pc.fw.ComponentSystem.on('update', this.onUpdate, this);
        pc.fw.ComponentSystem.on('toolsUpdate', this.onToolsUpdate, this);
    };

    CollisionComponentSystem = pc.inherits(CollisionComponentSystem, pc.fw.ComponentSystem);

    CollisionComponentSystem.prototype = pc.extend(CollisionComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {

            this.implementation = this._createImplementation(data.type);
            this.implementation.preInit(component, data, properties);

            properties = ['halfExtents', 'radius', 'axis', 'height', 'shape', 'model'];
            CollisionComponentSystem._super.initializeComponentData.call(this, component, data, properties);

            this.implementation.postInit(component, data, properties);
        },

        _createImplementation: function (type) {
            switch (type) {
                case 'Box':
                    return new CollisionBoxSystemImpl(this);
                case 'Sphere':
                    return new CollisionSphereSystemImpl(this);
                case 'Capsule':
                    return new CollisionCapsuleSystemImpl(this);
                case 'Mesh':
                    return new CollisionMeshSystemImpl(this);
                default:
                    throw "Invalid collision system type: " + type;
            }
        },

        cloneComponent: function (entity, clone) {
            if (this.implementation ) {
                return this.implementation.clone(entity, clone);
            }
        },
        
        onRemove: function (entity, data) {
            if (this.implementation) {
                this.implementation.remove(entity, data);
            }
            
        },

        onUpdate: function (dt) {
            if (this.debugRender) {
                this.updateDebugShapes();
            }
        },

        updateDebugShapes: function () {
            if (this.implementation) {
                this.implementation.updateDebugShapes();
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
    });

    /**
    /* Box Collision System
    */

    CollisionBoxSystemImpl = function (system) {
        this.system = system;
    }

    CollisionBoxSystemImpl.prototype = pc.extend(CollisionBoxSystemImpl.prototype, {
        preInit: function (component, data, properties) {
            this._createDebugShape();

            if (typeof(Ammo) !== 'undefined') {
                data.shape = new Ammo.btBoxShape(new Ammo.btVector3(data.halfExtents[0], data.halfExtents[1], data.halfExtents[2]));
            }

            data.model = new pc.scene.Model();
            data.model.graph = new pc.scene.GraphNode();
            data.model.meshInstances = [ new pc.scene.MeshInstance(data.model.graph, this.system.mesh, this.system.material) ];
        },

        _createDebugShape: function () {
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
            this.system.mesh = mesh;

            var material = new pc.scene.BasicMaterial();
            material.color = pc.math.vec4.create(0, 0, 1, 1);
            material.update()
            this.system.material = material;
        },

        postInit: function (component, data, properties) {
            if (component.entity.rigidbody) {
                component.entity.rigidbody.createBody();
            } else {
                if (typeof(Ammo) !== 'undefined') {
                    component.entity.trigger = new pc.fw.Trigger(this.system.context, component, data);
                }
            }
        },

        updateDebugShapes: function () {
            var components = this.system.store;
            var context = this.system.context;
            for (var id in components) {
                var entity = components[id].entity;
                var data = components[id].data;

                var x = data.halfExtents[0];
                var y = data.halfExtents[1];
                var z = data.halfExtents[2];
                var model = data.model;

                if (!context.scene.containsModel(data.model)) {
                    context.scene.addModel(data.model);
                    context.root.addChild(data.model.graph);
                }

                var root = model.graph;
                root.setPosition(entity.getPosition());
                root.setRotation(entity.getRotation());
                root.setLocalScale(x / 0.5, y / 0.5, z / 0.5);
            }
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
    
    CollisionSphereSystemImpl = function (system) {
        this.system = system;
    }

    CollisionSphereSystemImpl.prototype = pc.extend(CollisionSphereSystemImpl.prototype, {
        preInit: function (component, data, properties) {
            this._createDebugShape();

            if (typeof(Ammo) !== 'undefined') {
                data.shape = new Ammo.btSphereShape(data.radius);    
            }

            data.model = new pc.scene.Model();
            data.model.graph = new pc.scene.GraphNode();
            data.model.meshInstances = [ new pc.scene.MeshInstance(data.model.graph, this.system.mesh, this.system.material) ]; 
        },

        _createDebugShape: function () {
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
            this.system.mesh = mesh;

            var material = new pc.scene.BasicMaterial();
            material.color = pc.math.vec4.create(0, 0, 1, 1);
            material.update();
            this.system.material = material;
        },

        updateDebugShapes: function () {
            var components = this.system.store;
            var context = this.system.context;

            for (var id in components) {
                var entity = components[id].entity;
                var data = components[id].data;

                var r = data.radius;
                var model = data.model;

                if (!context.scene.containsModel(data.model)) {
                    context.scene.addModel(data.model);
                    context.root.addChild(data.model.graph);
                }

                var root = model.graph;
                root.setPosition(entity.getPosition());
                root.setRotation(entity.getRotation());
                root.setLocalScale(r / 0.5, r / 0.5, r / 0.5);
            }
        },

        postInit: function (component, data, properties) {
           if (component.entity.rigidbody) {
                component.entity.rigidbody.createBody();
            } else {
                if (typeof(Ammo) !== 'undefined') {
                    component.entity.trigger = new pc.fw.Trigger(this.system.context, component, data);
                }
            } 
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
    });

    /**
    /* Capsule Collision System
    */
    
    CollisionCapsuleSystemImpl = function (system) {
        this.system = system;
    }

    CollisionCapsuleSystemImpl.prototype = pc.extend(CollisionCapsuleSystemImpl.prototype, {
        preInit: function (component, data, properties) {
            var axis = data.axis || 1;
            var radius = data.radius || 0.5;
            var height = Math.max((data.height || 2) - 2 * radius, 0);

            this._createDebugShape(component, data, axis, radius, height);

            if (typeof(Ammo) !== 'undefined') {
                switch (axis) {
                    case 0:
                        data.shape = new Ammo.btCapsuleShapeX(radius, height);
                        break;
                    case 1:
                        data.shape = new Ammo.btCapsuleShape(radius, height);
                        break;
                    case 2:
                        data.shape = new Ammo.btCapsuleShapeZ(radius, height);
                        break;
                }
            }
        },

        _createDebugShape: function (component, data, axis, radius, height) {
            var gd = this.system.context.graphicsDevice;

            // Create the graphical resources required to render a capsule shape
            var format = new pc.gfx.VertexFormat(gd, [
                { semantic: pc.gfx.SEMANTIC_POSITION, components: 3, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
            ]);

            var vertexBuffer = new pc.gfx.VertexBuffer(gd, format, 328, pc.gfx.BUFFER_DYNAMIC);

            var mesh = new pc.scene.Mesh();
            mesh.vertexBuffer = vertexBuffer;
            mesh.indexBuffer[0] = this.system.indexBuffer;
            mesh.primitive[0].type = pc.gfx.PRIMITIVE_LINES;
            mesh.primitive[0].base = 0;
            mesh.primitive[0].count = vertexBuffer.getNumVertices();
            mesh.primitive[0].indexed = false;
            this.system.mesh = mesh;

            var material = new pc.scene.BasicMaterial();
            material.color = pc.math.vec4.create(0, 0, 1, 1);
            material.update();
            this.system.material = material;

            data.model = new pc.scene.Model();
            data.model.graph = new pc.scene.GraphNode();
            data.model.meshInstances = [ new pc.scene.MeshInstance(data.model.graph, mesh, this.system.material) ];

            var model = data.model;
            var vertexBuffer = model.meshInstances[0].mesh.vertexBuffer;

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

        postInit: function (component, data, properties) {
            if (component.entity.rigidbody) {
                component.entity.rigidbody.createBody();
            } else {
                if (typeof(Ammo) !== 'undefined') {
                    component.entity.trigger = new pc.fw.Trigger(this.system.context, component, data);
                }
            }
        },

        updateDebugShapes: function () {
            var components = this.system.store;
            var context = this.system.context;
            for (var id in components) {
                var entity = components[id].entity;
                var data = components[id].data;

                var model = data.model;
                var root = model.graph;

                if (!context.scene.containsModel(model)) {
                    context.scene.addModel(model);
                    context.root.addChild(root);
                }

                root.setPosition(entity.getPosition());
                root.setRotation(entity.getRotation());
                root.setLocalScale(1, 1, 1);
            }
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
    });

    /**
    /* Mesh Collision System
    */
    
    CollisionMeshSystemImpl = function (system) {
        this.system = system;
    }

    CollisionMeshSystemImpl.prototype = pc.extend(CollisionMeshSystemImpl.prototype, {
        preInit: function (component, data, properties) {
        },

        postInit: function (component, data, properties) {
        }
    });

    return {
        CollisionComponentSystem: CollisionComponentSystem
    };
}());