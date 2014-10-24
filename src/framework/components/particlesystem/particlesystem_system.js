pc.extend(pc.fw, function() {

    var ParticleSystemComponentSystem = function ParticleSystemComponentSystem(context) {
        this.id = 'particlesystem';
        this.description = "Updates and renders particle system in the scene.";
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.ParticleSystemComponent;
        this.DataType = pc.fw.ParticleSystemComponentData;

        this.schema = [{
                name: "enabled",
                displayName: "Enabled",
                description: "Enables or disables the component",
                type: "boolean",
                defaultValue: true
            }, {
                name: "numParticles",
                displayName: "Particle count",
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
                defaultValue: 0.05,
                options: {
                    min: 0,
                    step: 0.01
                }
            }, {
                name: "oneShot",
                displayName: "One Shot",
                description: "Disables looping",
                type: "boolean",
                defaultValue: false,
            }, {
                name: "maxEmissionTime",
                displayName: "Max emission time",
                description: "Limits time for one-shot emission. Should be only used in case of high Speed Divergence",
                type: "number",
                defaultValue: 15.0,
                options: {
                    min: 0,
                    max: 600,
                    step: 0.5
                },
                filter: {
                    oneShot: true
                }
            }, {
                name: "preWarm",
                displayName: "Pre Warm",
                description: "Starts particles in the middle of simulation",
                type: "boolean",
                defaultValue: false,
                filter: {
                    oneShot: false
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
                name: "gammaCorrect",
                displayName: "Enabled gamma correction",
                description: "",
                type: "boolean",
                defaultValue: true,
            }, {
                name: "depthTest",
                displayName: "Depth Test",
                description: "Enables hardware depth testing; don't use it for semi-transparent particles",
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
                description: "How to sort particles; Only works in CPU mode",
                type: "enumeration",
                options: {
                    enumerations: [{
                        name: 'None',
                        value: pc.scene.PARTICLES_SORT_NONE
                    }, {
                        name: 'Camera Distance',
                        value: pc.scene.PARTICLES_SORT_DISTANCE
                    }, {
                        name: 'Newer First',
                        value: pc.scene.PARTICLES_SORT_NEWER_FIRST
                    }, {
                        name: 'Older First',
                        value: pc.scene.PARTICLES_SORT_OLDER_FIRST
                    }]
                },
                defaultValue: 0,
            }, {
                name: "stretch",
                displayName: "Stretch",
                description: "Stretch particles in the direction of motion",
                type: "number",
                defaultValue: 0,
                options: {
                    min: 0,
                    max: 32,
                    step: 0.25
                }
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
                displayName: "Normal map",
                description: "Normal map used for each particle",
                type: "asset",
                options: {
                    max: 1,
                    type: "texture"
                },
                defaultValue: null
            }, {
                name: "mesh",
                displayName: "Particle mesh",
                description: "Mesh to use as particle; Will be quad, if not set",
                type: "asset",
                options: {
                    max: 1,
                    type: "model"
                },
                defaultValue: null
            }, {
                name: "speedDiv",
                displayName: "Speed Divergence",
                description: "Makes each particle's speed less uniform each frame",
                type: "number",
                defaultValue: 0.0,
                options: {
                    min: 0,
                    max: 1,
                    step: 0.01
                }
            }, {
                name: "constantSpeedDiv",
                displayName: "Constant Speed Divergence",
                description: "Makes each particle's speed less uniform during whole particle's lifetime",
                type: "number",
                defaultValue: 0.0,
                options: {
                    min: 0,
                    max: 1,
                    step: 0.01
                }
            }, {
                name: 'localOffsetGraph',
                displayName: "Local Position",
                description: "A graph that defines the local position of particles over time.",
                type: "curveset",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]]
                },
                options: {
                    curveNames: ['X', 'Y', 'Z']
                }
            }, {
                name: 'localPosDivGraph',
                displayName: "Local Position Divergence",
                description: "A graph that defines the local position divergence of particles over time.",
                type: "curveset",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]]
                },
                options: {
                    curveNames: ['X', 'Y', 'Z'],
                    min: 0,
                    max: 1
                }
            }, {
                name: 'offsetGraph',
                displayName: "Position",
                description: "A graph that defines the world position of particles over time.",
                type: "curveset",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]]
                },
                options: {
                    curveNames: ['X', 'Y', 'Z']
                }
            }, {
                name: 'posDivGraph',
                displayName: "Position Divergence",
                description: "A graph that defines the world position of particles over time.",
                type: "curveset",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]]
                },
                options: {
                    curveNames: ['X', 'Y', 'Z'],
                    min: 0,
                    max: 1
                }
            }, {
                name: 'angleGraph',
                displayName: "Angle",
                description: "A graph that defines the rotation of particles over time.",
                type: "curve",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [0, 0, 1, 0]
                },
                options: {
                    curveNames: ['Angle'],
                    max: 360,
                    verticalAxisValue: 360
                }
            }, {
                name: 'angleDivGraph',
                displayName: "Angle Divergence",
                description: "A graph that defines the rotation divergence of particles over time.",
                type: "curve",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [0, 0, 1, 0]
                },
                options: {
                    curveNames: ['Angle'],
                    min: 0,
                    max: 1
                }
            }, {
                name: 'scaleGraph',
                displayName: "Scale",
                description: "A graph that defines the scale of particles over time.",
                type: "curve",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [0, 1, 1, 1]
                },
                options: {
                    curveNames: ['Scale'],
                    verticalAxisValue: 1
                }
            }, {
                name: 'scaleDivGraph',
                displayName: "Scale Divergence",
                description: "A graph that defines the scaling divergence of particles over time.",
                type: "curve",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [0, 0, 1, 0]
                },
                options: {
                    curveNames: ['Scale'],
                    verticalAxisValue: 1,
                    min: 0,
                    max: 1
                }
            }, {
                name: 'colorGraph',
                displayName: "Color",
                description: "A graph that defines the color of particles over time.",
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
                description: "A graph that defines the opacity of particles over time.",
                type: "curve",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [0, 1, 1, 1],
                },
                options: {
                    curveNames: ['Opacity'],
                    max: 1,
                    min: 0
                }
            }, {
                name: 'alphaDivGraph',
                displayName: "Opacity Divergence",
                description: "A graph that defines the opacity divergence of particles over time.",
                type: "curve",
                defaultValue: {
                    type: pc.CURVE_SMOOTHSTEP,
                    keys: [0, 0, 1, 0]
                },
                options: {
                    curveNames: ['Opacity'],
                    max: 1,
                    min: 0
                }
            }, {
                name: "smoothness",
                displayName: "Smoothness",
                description: "Graph interpolation smoothness",
                type: "number",
                defaultValue: 4,
                options: {
                    min: 0,
                    max: 32,
                    step: 1
                }
            }, {
                name: 'camera',
                exposed: false
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
        pc.fw.ComponentSystem.on('update', this.onUpdate, this);
    };
    ParticleSystemComponentSystem = pc.inherits(ParticleSystemComponentSystem, pc.fw.ComponentSystem);

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
                        data[prop] = new pc.Vec3(data[prop]);
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
        },

        cloneComponent: function (entity, clone) {
            var source = entity.particlesystem.data;

            var component = this.addComponent(clone, {
                numParticles: source.numParticles,
                rate: source.rate,
                lifetime: source.lifetime,
                spawnBounds: source.spawnBounds ? source.spawnBounds.clone() : null,
                wrapBounds: source.wrapBounds ? source.wrapBounds.clone() : null,
                wind: source.wind ? source.wind.clone() : null,
                smoothness: source.smoothness,
                colorMap: source.colorMap,
                colorMapAsset: source.colorMapAsset,
                normalMap: source.normalMap,
                normalMapAsset: source.normalMapAsset,
                oneShot: source.oneShot,
                speedDiv: source.speedDiv,
                constantSpeedDiv: source.constantSpeedDiv,
                sort: source.sort,
                mode: source.mode,
                camera: source.camera,
                scene: source.scene,
                lighting: source.lighting,
                halfLambert: source.halfLambert,
                maxEmissionTime: source.maxEmissionTime,
                stretch: source.stretch,
                depthSoftening: source.depthSoftening,
                mesh: source.mesh,
                depthTest: source.depthTest,
                gammaCorrect: source.gammaCorrect,
                localOffsetGraph: source.localOffsetGraph ? source.localOffsetGraph.clone() : null,
                offsetGraph: source.offsetGraph ? source.offsetGraph.clone() : null,
                angleGraph: source.angleGraph ? source.angleGraph.clone() : null,
                scaleGraph: source.scaleGraph ? source.scaleGraph.clone() : null,
                colorGraph: source.colorGraph ? source.colorGraph.clone() : null,
                alphaGraph: source.alphaGraph ? source.alphaGraph.clone() : null,
                localPosDivGraph: source.localPosDivGraph ? source.localPosDivGraph.clone() : null,
                posDivGraph: source.posDivGraph ? source.posDivGraph.clone() : null,
                scaleDivGraph: source.scaleDivGraph ? source.scaleDivGraph.clone() : null,
                angleDivGraph: source.angleDivGraph ? source.angleDivGraph.clone() : null,
                alphaDivGraph: source.alphaDivGraph ? source.alphaDivGraph.clone() : null,
                enabled: source.enabled
            });
        },

        onUpdate: function(dt) {
            var components = this.store;
            var currentCamera;

            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var c = components[id];
                    var data = c.data;
                    var emitter = data.model.emitter;

                    if (data.enabled && c.entity.enabled) {
                        // check if the emitter has no camera set or if the
                        // camera is disabled
                        var cameraEntity = data.camera;
                        var camera = cameraEntity ? cameraEntity.camera : null;
                        if (!cameraEntity || !camera || !camera.enabled) {

                            // if there is no valid camera then get the first enabled camera
                            if (!currentCamera) {
                                currentCamera = this.context.systems.camera.cameras[0];
                                if (currentCamera) {
                                    currentCamera = currentCamera.entity;
                                }
                            }

                            c.entity.particlesystem.camera = currentCamera;
                        }

                        emitter.addTime(dt);
                    }
                }
            }
        },

        onRemove: function(entity, data) {
            if (data.model) {
                this.context.scene.removeModel(data.model);
                entity.removeChild(data.model.getGraph());
                data.model = null;
            }
        }
    });

    return {
        ParticleSystemComponentSystem: ParticleSystemComponentSystem
    };
}());
