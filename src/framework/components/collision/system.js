pc.extend(pc, function () {

    /**
     * @name pc.CollisionComponentSystem
     * @description Creates a new CollisionComponentSystem.
     * @class Manages creation of {@link pc.CollisionComponent}s.
     * @param {pc.Application} app The running {pc.Application}
     * @extends pc.ComponentSystem
     */
     var CollisionComponentSystem = function CollisionComponentSystem (app) {
        this.id = "collision";
        this.description = "Specifies a collision volume.";
        app.systems.add(this.id, this);

        this.ComponentType = pc.CollisionComponent;
        this.DataType = pc.CollisionComponentData;

        this.schema = [
            'enabled',
            'type',
            'halfExtents',
            'radius',
            'axis',
            'height',
            'asset',
            'shape',
            'model'
        ];

        this.implementations = { };

        this.on('remove', this.onRemove, this);

        pc.ComponentSystem.on('update', this.onUpdate, this);
    };

    CollisionComponentSystem = pc.inherits(CollisionComponentSystem, pc.ComponentSystem);

    CollisionComponentSystem.prototype = pc.extend(CollisionComponentSystem.prototype, {
        onLibraryLoaded: function () {
            if (typeof Ammo !== 'undefined') {
                //
            } else {
                // Unbind the update function if we haven't loaded Ammo by now
                pc.ComponentSystem.off('update', this.onUpdate, this);
            }
        },

        initializeComponentData: function (component, _data, properties) {
            // duplicate the input data because we are modifying it
            var data = {};
            properties = ['type', 'halfExtents', 'radius', 'axis', 'height', 'shape', 'model', 'asset', 'enabled'];
            properties.forEach(function (prop) {
                data[prop] = _data[prop];
            });

            if (!data.type) {
                data.type = component.data.type;
            }
            component.data.type = data.type;

            if (data.halfExtents && pc.type(data.halfExtents) === 'array') {
                data.halfExtents = new pc.Vec3(data.halfExtents[0], data.halfExtents[1], data.halfExtents[2]);
            }

            var impl = this._createImplementation(data.type);
            impl.beforeInitialize(component, data);

            CollisionComponentSystem._super.initializeComponentData.call(this.system, component, data, properties);

            impl.afterInitialize(component, data);
        },

        /**
        * @private
        * @description
        * Creates an implementation based on the collision type and caches it
        * in an internal implementations structure, before returning it.
        */
        _createImplementation: function (type) {
            if (this.implementations[type] === undefined) {
                var impl;
                switch (type) {
                    case 'box':
                        impl = new CollisionBoxSystemImpl(this);
                        break;
                    case 'sphere':
                        impl = new CollisionSphereSystemImpl(this);
                        break;
                    case 'capsule':
                        impl = new CollisionCapsuleSystemImpl(this);
                        break;
                    case 'cylinder':
                        impl = new CollisionCylinderSystemImpl(this);
                        break;
                    case 'mesh':
                        impl = new CollisionMeshSystemImpl(this);
                        break;
                    default:
                        throw "Invalid collision system type: " + type;
                }
                this.implementations[type] = impl;
            }

            return this.implementations[type];
        },

        /**
        * @private
        * @description Gets an existing implementation for the specified entity
        */
        _getImplementation: function (entity) {
            return this.implementations[entity.collision.data.type];
        },

        cloneComponent: function (entity, clone) {
            return this._getImplementation(entity).clone(entity, clone);
        },

        onRemove: function (entity, data) {
            this.implementations[data.type].remove(entity, data);
        },

        onUpdate: function (dt) {
            var id, entity, data;
            var components = this.store;

            for (id in components) {
                entity = components[id].entity;
                data = components[id].data;

                if (data.enabled && entity.enabled) {
                    if (!entity.rigidbody && entity.trigger) {
                        entity.trigger.syncEntityToBody();
                    }
                }
            }
        },

        onTransformChanged: function(component, position, rotation, scale) {
            this.implementations[component.data.type].updateTransform(component, position, rotation, scale);
        },

        /**
        * @private
        * @description Destroys the previous collision type and creates a new one
        * based on the new type provided
        */
        changeType: function (component, previousType, newType) {
             this.implementations[previousType].remove( component.entity, component.data);
             this._createImplementation(newType).reset(component, component.data);
        },

        /**
        * @private
        * @description Recreates rigid bodies or triggers for the specified component
        */
        recreatePhysicalShapes: function (component) {
            this.implementations[component.data.type].recreatePhysicalShapes(component);
        }
    });

    /**
    * Collision system implementations
    */
    CollisionSystemImpl = function (system) {
        this.system = system;
    };

    CollisionSystemImpl.prototype = {
        /**
        * @private
        * @description Called before the call to system.super.initializeComponentData is made
        */
        beforeInitialize: function (component, data) {
            data.shape = this.createPhysicalShape(component.entity, data);

            data.model = new pc.Model();
            data.model.graph = new pc.GraphNode();
        },

        /**
        * @private
        * @description Called after the call to system.super.initializeComponentData is made
        */
        afterInitialize: function (component, data) {
            this.recreatePhysicalShapes(component);
            component.data.initialized = true;
        },

        /**
        * @private
        * @description Called when a collision component changes type in order to
        * recreate debug and physical shapes
        */
        reset: function (component, data) {
            this.beforeInitialize(component, data);
            this.afterInitialize(component, data);
        },

        /**
        * @private
        * @description Re-creates rigid bodies / triggers
        */
        recreatePhysicalShapes: function (component) {
            var entity = component.entity;
            var data = component.data;

            if (typeof Ammo !== 'undefined') {
                data.shape = this.createPhysicalShape(component.entity, data);
                if (entity.rigidbody) {
                    entity.rigidbody.disableSimulation();
                    entity.rigidbody.createBody();
                } else {
                    if (!entity.trigger) {
                        entity.trigger = new pc.Trigger(this.system.app, component, data);
                    } else {
                        entity.trigger.initialize(data);
                    }
                }
            }
        },

        /**
        * @private
        * @description Creates a physical shape for the collision. This consists
        * of the actual shape that will be used for the rigid bodies / triggers of
        * the collision.
        */
        createPhysicalShape: function (entity, data) {
            return undefined;
        },

        updateTransform: function(component, position, rotation, scale) {
            if (component.entity.trigger) {
                component.entity.trigger.syncEntityToBody();
            }
        },

        /**
        * @private
        * @description Called when the collision is removed
        */
        remove: function (entity, data) {
            var app = this.system.app;
            if (entity.rigidbody && entity.rigidbody.body) {
                app.systems.rigidbody.removeBody(entity.rigidbody.body);
            }

            if (entity.trigger) {
                entity.trigger.destroy();
                delete entity.trigger;
            }

            if (app.scene.containsModel(data.model)) {
                app.root.removeChild(data.model.graph);
                app.scene.removeModel(data.model);
            }
        },

        /**
        * @private
        * @description Called when the collision is cloned to another entity
        */
        clone: function (entity, clone) {
            var src = this.system.dataStore[entity.getGuid()];

            var data = {
                enabled: src.data.enabled,
                type: src.data.type,
                halfExtents: [src.data.halfExtents.x, src.data.halfExtents.y, src.data.halfExtents.z],
                radius: src.data.radius,
                axis: src.data.axis,
                height: src.data.height,
                asset: src.data.asset,
                model: src.data.model
            };

            return this.system.addComponent(clone, data);
        }
    };

    /**
    /* Box Collision System
    */
    CollisionBoxSystemImpl = function (system) {};

    CollisionBoxSystemImpl = pc.inherits(CollisionBoxSystemImpl, CollisionSystemImpl);

    CollisionBoxSystemImpl.prototype = pc.extend(CollisionBoxSystemImpl.prototype, {
        createPhysicalShape: function (entity, data) {
            if (typeof Ammo !== 'undefined') {
                var he = data.halfExtents;
                var ammoHe = new Ammo.btVector3(he.x, he.y, he.z);
                return new Ammo.btBoxShape(ammoHe);
            } else {
                return undefined;
            }
        }
    });

    /**
    /* Sphere Collision System
    */

    CollisionSphereSystemImpl = function (system) {};

    CollisionSphereSystemImpl = pc.inherits(CollisionSphereSystemImpl, CollisionSystemImpl);

    CollisionSphereSystemImpl.prototype = pc.extend(CollisionSphereSystemImpl.prototype, {
        createPhysicalShape: function (entity, data) {
            if (typeof Ammo !== 'undefined') {
                return new Ammo.btSphereShape(data.radius);
            } else {
                return undefined;
            }
        }
    });

    /**
    /* Capsule Collision System
    */

    CollisionCapsuleSystemImpl = function (system) {};

    CollisionCapsuleSystemImpl = pc.inherits(CollisionCapsuleSystemImpl, CollisionSystemImpl);

    CollisionCapsuleSystemImpl.prototype = pc.extend(CollisionCapsuleSystemImpl.prototype, {
        createPhysicalShape: function (entity, data) {
            var shape = null;
            var axis = (data.axis !== undefined) ? data.axis : 1;
            var radius = data.radius || 0.5;
            var height = Math.max((data.height || 2) - 2 * radius, 0);

            if (typeof Ammo !== 'undefined') {
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
        }
    });

    /**
    /* Cylinder Collision System
    */

    CollisionCylinderSystemImpl = function (system) {};

    CollisionCylinderSystemImpl = pc.inherits(CollisionCylinderSystemImpl, CollisionSystemImpl);

    CollisionCylinderSystemImpl.prototype = pc.extend(CollisionCylinderSystemImpl.prototype, {
        createPhysicalShape: function (entity, data) {
            var halfExtents = null;
            var shape = null;
            var axis = (data.axis !== undefined) ? data.axis : 1;
            var radius = (data.radius !== undefined) ? data.radius : 0.5;
            var height = (data.height !== undefined) ? data.height : 1;

            if (typeof Ammo !== 'undefined') {
                switch (axis) {
                    case 0:
                        halfExtents = new Ammo.btVector3(height * 0.5, radius, radius);
                        shape = new Ammo.btCylinderShapeX(halfExtents);
                        break;
                    case 1:
                        halfExtents = new Ammo.btVector3(radius, height * 0.5, radius);
                        shape = new Ammo.btCylinderShape(halfExtents);
                        break;
                    case 2:
                        halfExtents = new Ammo.btVector3(radius, radius, height * 0.5);
                        shape = new Ammo.btCylinderShapeZ(halfExtents);
                        break;
                }
            }
            return shape;
        }
    });

    /**
    /* Mesh Collision System
    */

    CollisionMeshSystemImpl = function (system) { };

    CollisionMeshSystemImpl = pc.inherits(CollisionMeshSystemImpl, CollisionSystemImpl);

    CollisionMeshSystemImpl.prototype = pc.extend(CollisionMeshSystemImpl.prototype, {
        // override for the mesh implementation because the asset model needs
        // special handling
        beforeInitialize: function (component, data) {},

        createPhysicalShape: function (entity, data) {
            if (typeof Ammo !== 'undefined' && data.model) {
                var model = data.model;
                var shape = new Ammo.btCompoundShape();

                var i, j;
                for (i = 0; i < model.meshInstances.length; i++) {
                    var meshInstance = model.meshInstances[i];
                    var mesh = meshInstance.mesh;
                    var ib = mesh.indexBuffer[pc.RENDERSTYLE_SOLID];
                    var vb = mesh.vertexBuffer;

                    var format = vb.getFormat();
                    var stride = format.size / 4;
                    var positions;
                    for (j = 0; j < format.elements.length; j++) {
                        var element = format.elements[j];
                        if (element.name === pc.SEMANTIC_POSITION) {
                            positions = new Float32Array(vb.lock(), element.offset);
                        }
                    }

                    var indices = new Uint16Array(ib.lock());
                    var numTriangles = mesh.primitive[0].count / 3;

                    var v1 = new Ammo.btVector3();
                    var v2 = new Ammo.btVector3();
                    var v3 = new Ammo.btVector3();
                    var i1, i2, i3;

                    var base = mesh.primitive[0].base;
                    var triMesh = new Ammo.btTriangleMesh();
                    for (j = 0; j < numTriangles; j++) {
                        i1 = indices[base+j*3] * stride;
                        i2 = indices[base+j*3+1] * stride;
                        i3 = indices[base+j*3+2] * stride;
                        v1.setValue(positions[i1], positions[i1 + 1], positions[i1 + 2]);
                        v2.setValue(positions[i2], positions[i2 + 1], positions[i2 + 2]);
                        v3.setValue(positions[i3], positions[i3 + 1], positions[i3 + 2]);
                        triMesh.addTriangle(v1, v2, v3, true);
                    }

                    var useQuantizedAabbCompression = true;
                    var triMeshShape = new Ammo.btBvhTriangleMeshShape(triMesh, useQuantizedAabbCompression);

                    var wtm = meshInstance.node.getWorldTransform();
                    var scl = wtm.getScale();
                    triMeshShape.setLocalScaling(new Ammo.btVector3(scl.x, scl.y, scl.z));

                    var pos = meshInstance.node.getPosition();
                    var rot = meshInstance.node.getRotation();

                    var transform = new Ammo.btTransform();
                    transform.setIdentity();
                    transform.getOrigin().setValue(pos.x, pos.y, pos.z);

                    var ammoQuat = new Ammo.btQuaternion();
                    ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
                    transform.setRotation(ammoQuat);

                    shape.addChildShape(transform, triMeshShape);
                }

                var entityTransform = entity.getWorldTransform();
                var scale = entityTransform.getScale();
                var vec = new Ammo.btVector3();
                vec.setValue(scale.x, scale.y, scale.z);
                shape.setLocalScaling(vec);

                return shape;
            } else {
                return undefined;
            }
        },

        recreatePhysicalShapes: function (component) {
            var data = component.data;

            if (data.asset !== null && component.enabled && component.entity.enabled) {
                this.loadModelAsset(component);
            } else {
                data.model = null;
                this.doRecreatePhysicalShape(component);
            }
        },

        loadModelAsset: function (component) {
            var self = this;
            var id = component.data.asset;
            var data = component.data;
            var assets = this.system.app.assets;

            var asset = assets.get(id);
            if (asset) {
                asset.ready(function (asset) {
                    data.model = asset.resource;
                    self.doRecreatePhysicalShape(component);
                });
                assets.load(asset);
            } else {
                assets.once("add:" + id, function (asset) {
                    asset.ready(function (asset) {
                        data.model = asset.resource;
                        self.doRecreatePhysicalShape(component);
                    });
                    assets.load(asset);
                });
            }
        },

        doRecreatePhysicalShape: function (component) {
            var entity = component.entity;
            var data = component.data;

            if (data.model) {
                if (data.shape) {
                   Ammo.destroy(data.shape);
                }

                data.shape = this.createPhysicalShape(entity, data);

                if (entity.rigidbody) {
                    entity.rigidbody.createBody();
                } else {
                    if (!entity.trigger) {
                        entity.trigger = new pc.Trigger(this.system.app, component, data);
                    } else {
                        entity.trigger.initialize(data);
                    }

                }
            } else {
                this.remove(entity, data);
            }

        },

        updateTransform: function (component, position, rotation, scale) {
            if (component.shape) {
                var entityTransform = component.entity.getWorldTransform();
                var worldScale = entityTransform.getScale();

                // if the scale changed then recreate the shape
                var previousScale = component.shape.getLocalScaling();
                if (worldScale.x !== previousScale.x() ||
                    worldScale.y !== previousScale.y() ||
                    worldScale.z !== previousScale.z() ) {
                    this.doRecreatePhysicalShape(component);
                }
            }

            CollisionMeshSystemImpl._super.updateTransform.call(this, component, position, rotation, scale);
        }
    });

    return {
        CollisionComponentSystem: CollisionComponentSystem
    };
}());
