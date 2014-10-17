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
                name: "spawnBounds",
                displayName: "Spawn Bounds",
                description: "Defines an AABB in which particles are allowed to spawn",
                type: "vector",
                defaultValue: [0, 0, 0, 1]
            }, {
                name: "wrapBounds",
                displayName: "Wrap Bounds",
                description: "AABB around to camera to wrap particles. Used for infinite atmospheric effect like rain or mist",
                type: "vector",
                defaultValue: null
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
                name: "smoothness",
                displayName: "Smoothness",
                description: "Graph interpolation smoothness",
                type: "number",
                defaultValue: 4,
                options: {
                    min: 1,
                    max: 32,
                    step: 1
                }
            }, {
                name: "oneShot",
                displayName: "One Shot",
                description: "Disables looping",
                type: "boolean",
                defaultValue: false,
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
            }, {
                name: "depthTest",
                displayName: "Depth Test",
                description: "Enables hardware depth testing; don't use it for semi-transparent particles",
                type: "boolean",
                defaultValue: false,
            }, {
                name: "gammaCorrect",
                displayName: "Enabled gamma correction",
                description: "",
                type: "boolean",
                defaultValue: true,
            }, {
                name: "textureAsset",
                displayName: "Texture",
                description: "Particle texture, possibly with alpha channel",
                type: "asset",
                options: {
                    max: 1,
                    type: "texture"
                },
                defaultValue: null
            }, {
                name: "normalTextureAsset",
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
                name: "maxEmissionTime",
                displayName: "Max emission time",
                description: "Limits time for one-shot emission. Should be only used in case of high Speed Divergence",
                type: "number",
                defaultValue: 15.0,
                options: {
                    min: 0,
                    max: 600,
                    step: 0.5
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
                name: 'localOffsetGraph',
                displayName: "Local Offset",
                description: "A graph that defines the local position of particles over time.",
                type: "lineargraph",
                defaultValue: [[
                ]],
                options: {
                    curveNames: ['X', 'Y', 'Z']
                }
            }, {
                name: 'offsetGraph',
                displayName: "Offset",
                description: "A graph that defines the world position of particles over time.",
                type: "lineargraph",
                defaultValue: [],
                options: {
                    curveNames: ['X', 'Y', 'Z']
                }
            }, {
                name: 'angleGraph',
                displayName: "Angle",
                description: "A graph that defines the rotation of particles over time.",
                type: "lineargraph",
                defaultValue: [],
                options: {
                    curveNames: ['X', 'Y', 'Z'],
                    max: 180
                }
            }, {
                name: 'scaleGraph',
                displayName: "Scale",
                description: "A graph that defines the scale of particles over time.",
                type: "lineargraph",
                defaultValue: [],
                options: {
                    curveNames: ['Scale']
                }
            }, {
                name: 'colorGraph',
                displayName: "Color",
                description: "A graph that defines the color of particles over time.",
                type: "lineargraph",
                defaultValue: [],
                options: {
                    curveNames: ['R', 'G', 'B']
                }
            }, {
                name: 'alphaGraph',
                displayName: "Opacity",
                description: "A graph that defines the opacity of particles over time.",
                type: "lineargraph",
                defaultValue: [],
                options: {
                    curveNames: ['Opacity'],
                    max: 1
                }
            }, {
                name: 'localPosDivGraph',
                displayName: "Local Position Divergence",
                description: "A graph that defines the local position divergence of particles over time.",
                type: "lineargraph",
                defaultValue: [],
                options: {
                    curveNames: ['X', 'Y', 'Z']
                }
            }, {
                name: 'posDivGraph',
                displayName: "Position Divergence",
                description: "A graph that defines the world position of particles over time.",
                type: "lineargraph",
                defaultValue: [],
                options: {
                    curveNames: ['X', 'Y', 'Z']
                }
            }, {
                name: 'scaleDivGraph',
                displayName: "Scale Divergence",
                description: "A graph that defines the scaling divergence of particles over time.",
                type: "lineargraph",
                defaultValue: [],
                options: {
                    curveNames: ['Scale']
                }
            }, {
                name: 'angleDivGraph',
                displayName: "Angle Divergence",
                description: "A graph that defines the rotation divergence of particles over time.",
                type: "lineargraph",
                defaultValue: [],
                options: {
                    curveNames: ['X', 'Y', 'Z'],
                    max: 180
                }
            }, {
                name: 'alphaDivGraph',
                displayName: "Opacity Divergence",
                description: "A graph that defines the opacity divergence of particles over time.",
                type: "lineargraph",
                defaultValue: [],
                options: {
                    curveNames: ['Opacity'],
                    max: 1
                }
            }, {
                name: 'camera',
                exposed: false
            }, {
                name: 'texture',
                exposed: false
            }, {
                name: 'normalTexture',
                exposed: false
            }
        ];

        this.exposeProperties();

        this.on('remove', this.onRemove, this);
        pc.fw.ComponentSystem.on('update', this.onUpdate, this);
    };
    ParticleSystemComponentSystem = pc.inherits(ParticleSystemComponentSystem, pc.fw.ComponentSystem);

    pc.extend(ParticleSystemComponentSystem.prototype, {

        initializeComponentData: function(component, data, properties) {

            properties = [];
            for (var prop in data) {
                if (data.hasOwnProperty(prop)) {
                    properties.push(prop);
                }
            }
            ParticleSystemComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        onUpdate: function(dt) {
            var components = this.store;

            for (var id in components) {
                if (components.hasOwnProperty(id)) {

                    if ((components[id].data.enabled) && (components[id].entity.enabled)) {
                        components[id].data.model.emitter.addTime(dt);
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
