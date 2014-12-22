pc.extend(pc, function() {

    var ParticleSystemComponentSystem = function ParticleSystemComponentSystem(app) {
        this.id = 'particlesystem';
        this.description = "Updates and renders particle system in the scene.";
        app.systems.add(this.id, this);

        this.ComponentType = pc.ParticleSystemComponent;
        this.DataType = pc.ParticleSystemComponentData;

        this.schema = [{
                name: "enabled",
                displayName: "Enabled",
                description: "Enable or disable the component",
                type: "boolean",
                defaultValue: true
            }, {
                name: "autoPlay",
                displayName: "Auto Play",
                description: "Play automatically on start",
                type: "boolean",
                defaultValue: true
            }, {
                name: "numParticles",
                displayName: "Particle Count",
                description: "Total number of particles allocated",
                type: "number",
                defaultValue: 30,
                options: {
                    min: 1,
                    max: 4096,
                    step: 1
                }
            }, {
                name: "lifetime",
                displayName: "Lifetime",
                description: "The lifetime of each particle in seconds",
                type: "number",
                defaultValue: 5,
                options: {
                    min: 0,
                    step: 0.01
                }
            }, {
                name: "rate",
                displayName: "Emission Rate",
                description: "Delay between emission of each particle in seconds",
                type: "number",
                defaultValue: 0.1,
                options: {
                    min: 0,
                    step: 0.01
                }
            }, {
                name: "rate2",
                displayName: "Emission Rate 2",
                description: "Defines the random range of Emission Rate",
                type: "number",
                defaultValue: 0.1,
                options: {
                    min: 0,
                    step: 0.01
                }
            }, {
                name: "startAngle",
                displayName: "Start Angle",
                description: "The starting angle of each particle in degrees",
                type: "number",
                defaultValue: 0.0,
                options: {
                    min: 0,
                    step: 0.01
                }
            }, {
                name: "startAngle2",
                displayName: "Start Angle 2",
                description: "Defines the random range of Start Angle",
                type: "number",
                defaultValue: 0.0,
                options: {
                    min: 0,
                    step: 0.01
                }
            }, {
                name: "loop",
                displayName: "Loop",
                description: "Enables looping",
                type: "boolean",
                defaultValue: true,
            }, {
                name: "preWarm",
                displayName: "Pre Warm",
                description: "Starts particles in the middle of simulation",
                type: "boolean",
                defaultValue: false,
                filter: {
                    loop: true
                }
            }, {
                name: "lighting",
                displayName: "Lighting",
                description: "Enables particle lighting; Only ambient and directional lights are used",
                type: "boolean",
                defaultValue: false,
            }, {
                name: "halfLambert",
                displayName: "Half-Lambert",
                description: "Uses Half-Lambert shading instead of Lambert, for softer lighting.",
                type: "boolean",
                defaultValue: false,
                filter: {
                    lighting: true
                }
            }, {
                name: "intensity",
                displayName: "Color Intensity",
                description: "Controls the intensity of the colors for each particle",
                type: "number",
                defaultValue: 1,
                options: {
                    min: 0,
                    max: 10,
                    step: 0.1
                }
            }, {
                name: "depthWrite",
                displayName: "Depth Write",
                description: "Enables writing to depth buffer, therefore giving accurate occlusion between particles. Do not use it for semi-transparent particles",
                type: "boolean",
                defaultValue: false,
            }, {
                name: "depthSoftening",
                displayName: "Depth Softening",
                description: "Softens particle intersections with scene geometry",
                type: "number",
                defaultValue: 0,
                options: {
                    min: 0,
                    max: 1,
                    step: 0.01
                }
            }, {
                name: "sort",
                displayName: "Sorting Mode",
                description: "How to sort particles; Any value other than None will force CPU mode",
                type: "enumeration",
                options: {
                    enumerations: [{
                        name: 'None',
                        value: pc.PARTICLESORT_NONE
                    }, {
                        name: 'Camera Distance',
                        value: pc.PARTICLESORT_DISTANCE
                    }, {
                        name: 'Newer First',
                        value: pc.PARTICLESORT_NEWER_FIRST
                    }, {
                        name: 'Older First',
                        value: pc.PARTICLESORT_OLDER_FIRST
                    }]
                },
                defaultValue: 0,
            }, {
                name: "blendType",
                displayName: "Blending Mode",
                description: "How to blend particles",
                type: "enumeration",
                options: {
                    enumerations: [{
                        name: 'Alpha',
                        value: pc.BLEND_NORMAL
                    }, {
                        name: 'Add',
                        value: pc.BLEND_ADDITIVE
                    }, {
                        name: 'Multiply',
                        value: pc.BLEND_MULTIPLICATIVE
                    }]
                },
                defaultValue: pc.BLEND_NORMAL,
            }, {
                name: "stretch",
                displayName: "Stretch",
                description: "Stretch particles in the direction of motion",
                type: "number",
                defaultValue: 0,
                options: {
                    min: 0,
                    step: 0.01
                }
            }, {
                name: "alignToMotion",
                displayName: "Align To Motion",
                description: "Rotates particles along the direction of motion",
                type: 'boolean',
                defaultValue: false
            }, {
                name: "spawnBounds",
                displayName: "Spawn Bounds",
                description: "Defines an AABB in which particles are allowed to spawn",
                type: "vector",
                defaultValue: [0, 0, 0]
            }, {
                name: "wrap",
                displayName: "Wrap",
                description: "Set to true to wrap particles around the camera. Used for infinite atmospheric effect like rain or mist.",
                type: 'boolean',
                defaultValue: false
            }, {
                name: "wrapBounds",
                displayName: "Wrap Bounds",
                description: "AABB around to camera to wrap particles. Used for infinite atmospheric effect like rain or mist.",
                type: "vector",
                filter: {
                    wrap: true
                },
                defaultValue: [0, 0, 0]
            }, {
                name: "colorMapAsset",
                displayName: "Color Map",
                description: "Color map used for each particle, with alpha channel",
                type: "asset",
                options: {
                    max: 1,
                    type: "texture"
                },
                defaultValue: null
            }, {
                name: "normalMapAsset",
                displayName: "Normal Map",
                description: "Normal map used for each particle",
                type: "asset",
                options: {
                    max: 1,
                    type: "texture"
                },
                defaultValue: null
            }, {
                name: "mesh",
                displayName: "Particle Mesh",
                description: "Mesh to use as particle; Will be quad, if not set",
                type: "asset",
                options: {
                    max: 1,
                    type: "model"
                },
                defaultValue: null
            }, {
                name: 'localVelocityGraph',
                displayName: "Local Velocity",
                description: "Curves that define the local velocity of particles over time.",
                type: "curveset",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [[0, 0], [0, 0], [0, 0]],
                    betweenCurves: false
                },
                options: {
                    curveNames: ['X', 'Y', 'Z'],
                    secondCurve: 'localVelocityGraph2'
                }
            }, {
                name: 'localVelocityGraph2',
                displayName: "Local Velocity 2",
                description: "Curves that define the range of the Local Velocity",
                type: "curveset",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [[0, 0], [0, 0], [0, 0]]
                },
                filter: {
                    always: false // hide from Designer but do expose it
                }
            }, {
                name: 'velocityGraph',
                displayName: "Velocity",
                description: "Curves that define the world velocity of particles over time.",
                type: "curveset",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [[0, -1], [0, -1], [0, -1]],
                    betweenCurves: true
                },
                options: {
                    curveNames: ['X', 'Y', 'Z'],
                    secondCurve: 'velocityGraph2'
                }
            }, {
                name: 'velocityGraph2',
                displayName: "Velocity 2",
                description: "Curves that define the range of the Velocity",
                type: "curveset",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [[0, 1], [0, 1], [0, 1]]
                },
                options: {
                    curveNames: ['X', 'Y', 'Z']
                },
                filter: {
                    always: false // hide from Designer but do expose it
                }
            }, {
                name: 'rotationSpeedGraph',
                displayName: "Rotation Speed",
                description: "Curve that defines how fast particles rotate over time.",
                type: "curve",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [0, 0],
                    betweenCurves: false
                },
                options: {
                    curveNames: ['Angle'],
                    secondCurve: 'rotationSpeedGraph2',
                    verticalAxisValue: 360,
                },
                filter: {
                    alignToMotion: false
                }
            }, {
                name: 'rotationSpeedGraph2',
                displayName: "Rotation Speed 2",
                description: "Curve that defines the range of Rotation Speed",
                type: "curve",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [0, 0]
                },
                options: {
                    curveNames: ['Angle'],
                    verticalAxisValue: 360
                },
                filter: {
                    always: false
                }
            }, {
                name: 'scaleGraph',
                displayName: "Scale",
                description: "Curve that defines the scale of particles over time",
                type: "curve",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [0, 0.1],
                    betweenCurves: false
                },
                options: {
                    curveNames: ['Scale'],
                    verticalAxisValue: 1,
                    secondCurve: 'scaleGraph2',
                    min: 0
                }
            }, {
                name: 'scaleGraph2',
                displayName: "Scale 2",
                description: "Curve that defines the range of Scale",
                type: "curve",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [0, 0.1]
                },
                options: {
                    curveNames: ['Scale'],
                    verticalAxisValue: 1,
                    min: 0
                },
                filter: {
                    always: false
                }
            }, {
                name: 'colorGraph',
                displayName: "Color",
                description: "Curves that define the color of particles over time",
                type: "curveset",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [[0, 1], [0, 1], [0, 1]],
                    betweenCurves: false
                },
                options: {
                    curveNames: ['R', 'G', 'B'],
                    max: 1,
                    min: 0
                }
            }, {
                name: 'colorGraph2',
                displayName: "Color 2",
                description: "Curves that define the range of Color",
                exposed: false, // not used at the moment
                type: "curveset",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [[0, 1, 1, 1], [0, 1, 1, 1], [0, 1, 1, 1]],
                },
                options: {
                    curveNames: ['R', 'G', 'B'],
                    max: 1,
                    min: 0
                }
            }, {
                name: 'alphaGraph',
                displayName: "Opacity",
                description: "Curve that defines the opacity of particles over time",
                type: "curve",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [0, 1],
                    betweenCurves: false
                },
                options: {
                    curveNames: ['Opacity'],
                    max: 1,
                    min: 0,
                    secondCurve: 'alphaGraph2'
                }
            }, {
                name: 'alphaGraph2',
                displayName: "Opacity 2",
                description: "Curve that defines the range of Opacity",
                type: "curve",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [0, 1],
                },
                options: {
                    curveNames: ['Opacity'],
                    max: 1,
                    min: 0
                },
                filter: {
                    always: false
                }
            }, {
                name: 'colorMap',
                exposed: false
            }, {
                name: 'normalMap',
                exposed: false
            }
        ];

        this.exposeProperties();

        this.propertyTypes = {};
        for (var i=0; i<this.schema.length; i++) {
            var s = this.schema[i];
            this.propertyTypes[s.name] = s.type;
        }

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
                var sourceProp = source[prop.name];
                if (sourceProp instanceof pc.Vec3 ||
                    sourceProp instanceof pc.Curve ||
                    sourceProp instanceof pc.CurveSet) {

                    sourceProp = sourceProp.clone();
                    data[prop.name] = sourceProp;
                } else {
                    if (sourceProp !== null && sourceProp !== undefined) {
                        data[prop.name] = sourceProp;
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
            var he = component.data.spawnBounds;
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

            root.setLocalScale(x * 2, y * 2, z * 2);
        }
    });

    return {
        ParticleSystemComponentSystem: ParticleSystemComponentSystem
    };
}());
