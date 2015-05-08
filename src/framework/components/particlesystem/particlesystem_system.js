pc.extend(pc, function() {

    var ParticleSystemComponentSystem = function ParticleSystemComponentSystem(app) {
        this.id = 'particlesystem';
        this.description = "Updates and renders particle system in the scene.";
        app.systems.add(this.id, this);

        this.ComponentType = pc.ParticleSystemComponent;
        this.DataType = pc.ParticleSystemComponentData;

        this.schema = [
            'enabled',
            'autoPlay',
            'numParticles',
            'lifetime',
            'rate',
            'rate2',
            'startAngle',
            'startAngle2',
            'loop',
            'preWarm',
            'lighting',
            'halfLambert',
            'intensity',
            'depthWrite',
            'depthSoftening',
            'sort',
            'blendType',
            'stretch',
            'alignToMotion',
            'emitterShape',
            'emitterExtents',
            'emitterRadius',
            'initialVelocity',
            'wrap',
            'wrapBounds',
            'colorMapAsset',
            'normalMapAsset',
            'mesh',
            'localVelocityGraph',
            'localVelocityGraph2',
            'velocityGraph',
            'velocityGraph2',
            'rotationSpeedGraph',
            'rotationSpeedGraph2',
            'scaleGraph',
            'scaleGraph2',
            'colorGraph',
            'colorGraph2',
            'alphaGraph',
            'alphaGraph2',
            'colorMap',
            'normalMap'
        ];

        this.propertyTypes = {
            emitterExtents: 'vector',
            wrapBounds: 'vector',
            localVelocityGraph: 'curveset',
            localVelocityGraph2: 'curveset',
            velocityGraph: 'curveset',
            velocityGraph2: 'curveset',
            colorGraph: 'curveset',
            colorGraph2: 'curveset',
            alphaGraph: 'curve',
            alphaGraph2: 'curve',
            rotationSpeedGraph: 'curve',
            rotationSpeedGraph2: 'curve',
            scaleGraph: 'curve',
            scaleGraph2: 'curve'
        };

        this.on('remove', this.onRemove, this);
        pc.ComponentSystem.on('update', this.onUpdate, this);
        pc.ComponentSystem.on('toolsUpdate', this.onToolsUpdate, this);

        var gd = app.graphicsDevice;
        this.debugMesh = this._createDebugMesh();

        this.debugMaterial = new pc.BasicMaterial();
        this.debugMaterial.color = new pc.Color(1, 0.5, 0, 1);
        this.debugMaterial.update();

    };
    ParticleSystemComponentSystem = pc.inherits(ParticleSystemComponentSystem, pc.ComponentSystem);

    pc.extend(ParticleSystemComponentSystem.prototype, {

        initializeComponentData: function(component, data, properties) {

            properties = [];
            var types = this.propertyTypes;
            var type;

            for (var prop in data) {
                if (data.hasOwnProperty(prop)) {
                    properties.push(prop);
                }

                if (types[prop] === 'vector') {
                    if (pc.type(data[prop]) === 'array') {
                        data[prop] = new pc.Vec3(data[prop][0], data[prop][1], data[prop][2]);
                    }
                } else if (types[prop] === 'curve') {
                    if (!(data[prop] instanceof pc.Curve)) {
                        type = data[prop].type;
                        data[prop] = new pc.Curve(data[prop].keys);
                        data[prop].type = type;
                    }
                } else if (types[prop] === 'curveset') {
                    if (!(data[prop] instanceof pc.CurveSet)) {
                        type = data[prop].type;
                        data[prop] = new pc.CurveSet(data[prop].keys);
                        data[prop].type = type;
                    }
                }
            }

            ParticleSystemComponentSystem._super.initializeComponentData.call(this, component, data, properties);

            if (this._inTools) {
                this._createDebugShape(component);
            }
        },

        cloneComponent: function (entity, clone) {
            var source = entity.particlesystem.data;
            var schema = this.schema;

            var data = {};

            for (var i = 0, len = schema.length; i < len; i++) {
                var prop = schema[i];
                var sourceProp = source[prop];
                if (sourceProp instanceof pc.Vec3 ||
                    sourceProp instanceof pc.Curve ||
                    sourceProp instanceof pc.CurveSet) {

                    sourceProp = sourceProp.clone();
                    data[prop] = sourceProp;
                } else {
                    if (sourceProp !== null && sourceProp !== undefined) {
                        data[prop] = sourceProp;
                    }
                }
            }

            return this.addComponent(clone, data);
        },

        onUpdate: function(dt) {
            var components = this.store;
            var currentCamera;

            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var c = components[id];
                    var entity = c.entity;
                    var data = c.data;

                    if (data.enabled && entity.enabled) {
                        var emitter = data.model.emitter;

                        if (!data.paused) {
                            emitter.addTime(dt);
                        }
                    }
                }
            }
        },

        onToolsUpdate: function (dt) {
            var components = this.store;

            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var c = components[id];

                    if (c.data.enabled && c.entity.enabled) {
                        this._updateDebugShape(c);
                    }
                }
            }
        },

        onRemove: function(entity, data) {
            if (data.model) {
                this.app.scene.removeModel(data.model);
                entity.removeChild(data.model.getGraph());
                data.model = null;
            }
        },

        _createDebugMesh: function () {
            var gd = this.app.graphicsDevice;

            var format = new pc.VertexFormat(gd, [
                { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.ELEMENTTYPE_FLOAT32 }
            ]);

            var vertexBuffer = new pc.VertexBuffer(gd, format, 8);
            var positions = new Float32Array(vertexBuffer.lock());
            positions.set([
                -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5,
                -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5
            ]);
            vertexBuffer.unlock();

            var indexBuffer = new pc.IndexBuffer(gd, pc.INDEXFORMAT_UINT8, 24);
            var indices = new Uint8Array(indexBuffer.lock());
            indices.set([
                0,1,1,2,2,3,3,0,
                4,5,5,6,6,7,7,4,
                0,4,1,5,2,6,3,7
            ]);
            indexBuffer.unlock();

            var mesh = new pc.Mesh();
            mesh.vertexBuffer = vertexBuffer;
            mesh.indexBuffer[0] = indexBuffer;
            mesh.primitive[0].type = pc.PRIMITIVE_LINES;
            mesh.primitive[0].base = 0;
            mesh.primitive[0].count = indexBuffer.getNumIndices();
            mesh.primitive[0].indexed = true;
            return mesh;
        },

        _createDebugShape: function (component) {
            var node = new pc.GraphNode();

            var model = new pc.Model();
            model.graph = node;

            model.meshInstances = [ new pc.MeshInstance(node, this.debugMesh, this.debugMaterial) ];

            component.data.debugShape = model;

            if (component.data.enabled && component.entity.enabled) {
                this.app.root.addChild(node);
                this.app.scene.addModel(model);
            }

            return model;
        },

        _updateDebugShape: function (component) {
            var he = component.data.emitterExtents;
            var x = he.x;
            var y = he.y;
            var z = he.z;

            var entity = component.entity;
            var root = component.data.debugShape.graph;
            root.setPosition(entity.getPosition());
            root.setRotation(entity.getRotation());

            x = x || 0.0005;
            y = y || 0.0005;
            z = z || 0.0005;

            root.setLocalScale(x, y, z);
        }
    });

    return {
        ParticleSystemComponentSystem: ParticleSystemComponentSystem
    };
}());
