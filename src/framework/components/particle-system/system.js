pc.extend(pc, function() {

   /**
     * @name pc.ParticleSystemComponentSystem
     * @description Create a new ParticleSystemComponentSystem
     * @class Allows an Entity to render a particle system
     * @param {pc.Application} app The Application.
     * @extends pc.ComponentSystem
     */
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
            'noFog',
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
            'localSpace',
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
            'normalMap',
            'animTilesX',
            'animTilesY',
            'animNumFrames',
            'animSpeed',
            'animLoop'
        ];

        this.propertyTypes = {
            emitterExtents: 'vec3',
            wrapBounds: 'vec3',
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

        this.on('beforeremove', this.onRemove, this);
        pc.ComponentSystem.on('update', this.onUpdate, this);
    };
    ParticleSystemComponentSystem = pc.inherits(ParticleSystemComponentSystem, pc.ComponentSystem);

    pc.extend(ParticleSystemComponentSystem.prototype, {

        initializeComponentData: function(component, _data, properties) {
            var data = {};

            properties = [];
            var types = this.propertyTypes;
            var type;

            for (var prop in _data) {
                if (_data.hasOwnProperty(prop)) {
                    properties.push(prop);
                    // duplicate input data as we are modifying it
                    data[prop] = _data[prop];
                }

                if (types[prop] === 'vec3') {
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
            var numSteps, i;
            var stats = this.app.stats.particles;

            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var c = components[id];
                    var entity = c.entity;
                    var data = c.data;

                    if (data.enabled && entity.enabled) {
                        var emitter = data.model.emitter;
                        if (!emitter.meshInstance.visible) continue;

                        if (!data.paused) {

                            emitter.simTime += dt;
                            numSteps = 0;
                            if (emitter.simTime > emitter.fixedTimeStep) {
                                numSteps = Math.floor(emitter.simTime / emitter.fixedTimeStep);
                                emitter.simTime -= numSteps * emitter.fixedTimeStep;
                            }
                            if (numSteps) {
                                numSteps = Math.min(numSteps, emitter.maxSubSteps);
                                for(i=0; i<numSteps; i++) {
                                    emitter.addTime(emitter.fixedTimeStep);
                                }
                                stats._updatesPerFrame += numSteps;
                                stats._frameTime += emitter._addTimeTime;
                                emitter._addTimeTime = 0;
                            }

                            emitter.finishFrame();
                        }
                    }
                }
            }
        },

        onRemove: function(entity, component) {
            var data = component.data;
            if (data.model) {
                this.app.scene.removeModel(data.model);
                entity.removeChild(data.model.getGraph());
                data.model = null;
            }

            if (component.emitter) {
                component.emitter.destroy();
                component.emitter = null;
            }
        }
    });

    return {
        ParticleSystemComponentSystem: ParticleSystemComponentSystem
    };
}());
