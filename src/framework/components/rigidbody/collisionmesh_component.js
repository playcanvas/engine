pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.CollisionMeshComponent
     * @constructor Create a new CollisionMeshComponent
     * @class A box-shaped collision volume. use this in conjunction with a RigidBodyComponent to make a Box that can be simulated using the physics engine.
     * @param {pc.fw.CollisionMeshComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.     
     * @property {String} asset The GUID of the asset for the model
     * @property {pc.scene.Model} model The model that is added to the scene graph.
     * @extends pc.fw.Component
     */
    var CollisionMeshComponent = function CollisionMeshComponent (system, entity) {
        this.on("set_asset", this.onSetAsset, this);
        this.on("set_model", this.onSetModel, this);
    };
    CollisionMeshComponent = pc.inherits(CollisionMeshComponent, pc.fw.Component);
    
    pc.extend(CollisionMeshComponent.prototype, {

        loadModelAsset: function(guid) {
            var options = {
                batch: this.entity.getRequestBatch()
            };

            var asset = this.system.context.assets.getAsset(guid);
            if (!asset) {
                logERROR(pc.string.format('Trying to load model before asset {0} is loaded.', guid));
                return;
            }

            var url = asset.getFileUrl();
            this.system.context.loader.request(new pc.resources.ModelRequest(url), function (resources) {
                var model = resources[url];

                this.model = model;

                this.data.shape = this.createShape();

                if (this.entity.rigidbody) {
                    this.entity.rigidbody.createBody();
                }
            }.bind(this), function (errors, resources) {
                Object.keys(errors).forEach(function (key) {
                    logERROR(errors[key]);
                });
            }, function (progress) {

            }, options);
        },

        onSetAsset: function (name, oldValue, newValue) {
            if (newValue) {
                this.loadModelAsset(newValue);
            } else {
                this.model = null;
            }
        },

        onSetModel: function (name, oldValue, newValue) {
            if (oldValue) {
                this.entity.removeChild(oldValue.getGraph());
            }

            if (newValue) {
                this.entity.addChild(newValue.graph);

                // Store the entity that owns this model
                newValue._entity = this.entity;
            }
        },

        createShape: function () {
            if (typeof(Ammo) !== 'undefined') {
                var model = this.model;
                var meshInstance = model.meshInstances[0];
                var mesh = meshInstance.mesh;
                var ib = mesh.indexBuffer[pc.scene.RENDERSTYLE_SOLID];
                var vb = mesh.vertexBuffer;

                var format = vb.getFormat();
                var stride = format.size / 4;
                var positions;
                for (var i = 0; i < format.elements.length; i++) {
                    var element = format.elements[i];
                    if (element.scopeId.name === 'vertex_position') {
                        positions = new Float32Array(vb.lock(), element.offset);
                    }
                }

                var indices = new Uint16Array(ib.lock());
                var numTriangles = indices.length / 3;

                var v1 = new Ammo.btVector3();
                var v2 = new Ammo.btVector3();
                var v3 = new Ammo.btVector3();
                var i1, i2, i3;

                var triMesh = new Ammo.btTriangleMesh();
                for (i = 0; i < numTriangles; i++) {
                    i1 = indices[i*3] * stride;
                    i2 = indices[i*3+1] * stride;
                    i3 = indices[i*3+2] * stride;
                    v1.setValue(positions[i1], positions[i1 + 1], positions[i1 + 2]);
                    v2.setValue(positions[i2], positions[i2 + 1], positions[i2 + 2]);
                    v3.setValue(positions[i3], positions[i3 + 1], positions[i3 + 2]);
                    triMesh.addTriangle(v1, v2, v3, true);
                }

                var useQuantizedAabbCompression = true;
                var shape = new Ammo.btBvhTriangleMeshShape(triMesh, useQuantizedAabbCompression);

                var wtm = meshInstance.node.getWorldTransform();
                var scl = pc.math.mat4.getScale(wtm);
                shape.setLocalScaling(new Ammo.btVector3(scl[0], scl[1], scl[2]));

                return shape;
            } else {
                return undefined;
            }
        }
    });

    return {
        CollisionMeshComponent: CollisionMeshComponent
    };
}());