pc.extend(pc.fw, function() {

    var ParticleSystemComponentSystem = function ParticleSystemComponentSystem(context) {
        this.id = 'particlesystem';
        this.description = "Updates and renders particle system in the scene.";
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.ParticleSystemComponent;
        this.DataType = pc.fw.ParticleSystemComponentData;

        this.schema = [

            {
                name: "enabled",
                displayName: "Enabled",
                description: "Enables or disables the component",
                type: "boolean",
                defaultValue: true
            },

            {
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
            },

            {
                name: "birthBounds",
                displayName: "Spawn bounds",
                description: "Defines an AABB in which particles are allowed to spawn",
                type: "vector",
                defaultValue: [0, 0, 0, 1]
            },

            {
                name: "wrapBounds",
                displayName: "Wrap bounds",
                description: "AABB around to camera to wrap particles. Used for infinite atmospheric effect like rain or mist",
                type: "vector",
                defaultValue: undefined
            },

            {
                name: "lifetime",
                displayName: "Lifetime",
                description: "The time of life of each particle, in seconds",
                type: "number",
                defaultValue: 5,
                options: {
                    min: 0,
                    max: Number.MAX_VALUE,
                    step: 0.01
                }
            },

            {
                name: "rate",
                displayName: "Emission rate",
                description: "Delay between emission of each particle, in seconds",
                type: "number",
                defaultValue: 0.05,
                options: {
                    min: 0,
                    max: Number.MAX_VALUE,
                    step: 0.01
                }
            },

            {
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
            },

            {
                name: "oneShot",
                displayName: "One shot",
                description: "Disables looping",
                type: "boolean",
                defaultValue: false,
            },

            {
                name: "lighting",
                displayName: "Lighting",
                description: "Enables particle lighting; Only ambient and directional lights are used",
                type: "boolean",
                defaultValue: false,
            },

            {
                name: "softerLighting",
                displayName: "Softer lighting",
                description: "Uses Half-Lambert shading instead of Lambert",
                type: "boolean",
                defaultValue: false,
            },

            {
                name: "ztest",
                displayName: "Depth test",
                description: "Enables hardware depth testing; Don't use it for semi-transparent particles",
                type: "boolean",
                defaultValue: false,
            },

            {
                name: "srgb",
                displayName: "Gamma correction",
                description: "",
                type: "boolean",
                defaultValue: true,
            },

            {
                name: "textureAsset",
                displayName: "Texture",
                description: "Particle texture, possibly with alpha channel",
                type: "asset",
                options: {
                    max: 1,
                    type: "texture"
                },
                defaultValue: undefined
            },

            {
                name: "textureNormalAsset",
                displayName: "Normal map",
                description: "Normal map used for each particle",
                type: "asset",
                options: {
                    max: 1,
                    type: "texture"
                },
                defaultValue: undefined
            },

            {
                name: "mesh",
                displayName: "Particle mesh",
                description: "Mesh to use as particle; Will be quad, if not set",
                type: "asset",
                options: {
                    max: 1,
                    type: "model"
                },
                defaultValue: undefined
            },

            {
                name: "deltaRandomness",
                displayName: "Speed divergence",
                description: "Makes each particle's speed less uniform each frame",
                type: "number",
                defaultValue: 0.0,
                options: {
                    min: 0,
                    max: 1,
                    step: 0.01
                }
            },

            {
                name: "deltaRandomnessStatic",
                displayName: "Speed divergence static",
                description: "Makes each particle's speed less uniform during whole particle's lifetime",
                type: "number",
                defaultValue: 0.0,
                options: {
                    min: 0,
                    max: 1,
                    step: 0.01
                }
            },

            {
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
            },

            {
                name: "sort",
                displayName: "Sorting mode",
                description: "How to sort particles; Only works in CPU mode",
                type: "enumeration",
                options: {
                    enumerations: [{
                        name: 'None',
                        value: 0
                    }, {
                        name: 'Camera distance',
                        value: 1
                    }, {
                        name: 'Newer first',
                        value: 2
                    }, {
                        name: 'Older first',
                        value: 3
                    }]
                },
                defaultValue: 0,
            },

            {
                name: "stretch",
                displayName: "Stretch",
                description: "Stretches particles in the direction of motion",
                type: "number",
                defaultValue: 0,
                options: {
                    min: 0,
                    max: 32,
                    step: 0.25
                }
            },

            {
                name: "depthSoftening",
                displayName: "Depth softening",
                description: "Softens particle intersections with scene geometry",
                type: "number",
                defaultValue: 0,
                options: {
                    min: 0,
                    max: 1,
                    step: 0.01
                }
            },

            {
                name: 'camera',
                exposed: false
            },

            {
                name: 'graphLocalOffset',
                exposed: false
            }, {
                name: 'graphWorldOffset',
                exposed: false
            }, {
                name: 'graphAngle',
                exposed: false
            }, {
                name: 'graphScale',
                exposed: false
            }, {
                name: 'graphColor',
                exposed: false
            }, {
                name: 'graphAlpha',
                exposed: false
            }, {
                name: 'graphPosDiv',
                exposed: false
            }, {
                name: 'graphPosWorldDiv',
                exposed: false
            }, {
                name: 'graphScaleDiv',
                exposed: false
            }, {
                name: 'graphAngleDiv',
                exposed: false
            }, {
                name: 'graphAlphaDiv',
                exposed: false
            },

            {
                name: 'texture',
                exposed: false
            }, {
                name: 'textureNormal',
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
