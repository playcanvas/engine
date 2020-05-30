Object.assign(pc, function () {
    var _schema = [
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
        'emitterExtentsInner',
        'emitterRadius',
        'emitterRadiusInner',
        'initialVelocity',
        'wrap',
        'wrapBounds',
        'localSpace',
        'colorMapAsset',
        'normalMapAsset',
        'mesh',
        'meshAsset',
        'orientation',
        'particleNormal',
        'localVelocityGraph',
        'localVelocityGraph2',
        'velocityGraph',
        'velocityGraph2',
        'rotationSpeedGraph',
        'rotationSpeedGraph2',
        'radialSpeedGraph',
        'radialSpeedGraph2',
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
        'animStartFrame',
        'animNumFrames',
        'animNumAnimations',
        'animIndex',
        'randomizeAnimIndex',
        'animSpeed',
        'animLoop',
        'layers'
    ];

    /**
     * @class
     * @name pc.ParticleSystemComponentSystem
     * @augments pc.ComponentSystem
     * @classdesc Allows an Entity to render a particle system.
     * @description Create a new ParticleSystemComponentSystem.
     * @param {pc.Application} app - The Application.
     */
    var ParticleSystemComponentSystem = function ParticleSystemComponentSystem(app) {
        pc.ComponentSystem.call(this, app);

        this.id = 'particlesystem';
        this.description = "Updates and renders particle system in the scene.";

        this.ComponentType = pc.ParticleSystemComponent;
        this.DataType = pc.ParticleSystemComponentData;

        this.schema = _schema;

        this.propertyTypes = {
            emitterExtents: 'vec3',
            emitterExtentsInner: 'vec3',
            particleNormal: 'vec3',
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
            radialSpeedGraph: 'curve',
            radialSpeedGraph2: 'curve',
            scaleGraph: 'curve',
            scaleGraph2: 'curve'
        };

        this._enabledParticleSystems = [];

        this.on('beforeremove', this.onRemove, this);
        pc.ComponentSystem.bind('update', this.onUpdate, this);
    };
    ParticleSystemComponentSystem.prototype = Object.create(pc.ComponentSystem.prototype);
    ParticleSystemComponentSystem.prototype.constructor = ParticleSystemComponentSystem;

    pc.Component._buildAccessors(pc.ParticleSystemComponent.prototype, _schema);

    Object.assign(ParticleSystemComponentSystem.prototype, {

        initializeComponentData: function (component, _data, properties) {
            var data = {};

            properties = [];
            var types = this.propertyTypes;
            var type;

            // we store the mesh asset id as "mesh" (it should be "meshAsset")
            // this re-maps "mesh" into "meshAsset" if it is an asset or an asset id
            if (_data.mesh instanceof pc.Asset || typeof _data.mesh === 'number') {
                // migrate into meshAsset property
                _data.meshAsset = _data.mesh;
                delete _data.mesh;
            }

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

                // duplicate layer list
                if (data.layers && pc.type(data.layers) === 'array') {
                    data.layers = data.layers.slice(0);
                }
            }

            pc.ComponentSystem.prototype.initializeComponentData.call(this, component, data, properties);
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
                } else if (prop === "layers") {
                    data.layers = source.layers.slice(0);
                } else {
                    if (sourceProp !== null && sourceProp !== undefined) {
                        data[prop] = sourceProp;
                    }
                }
            }

            return this.addComponent(clone, data);
        },

        onUpdate: function (dt) {
            var i, len;

            var particleSystems = this._enabledParticleSystems;
            for (i = 0, len = particleSystems.length; i < len; i++) {
                particleSystems[i]._update(dt);
            }
        },

        onRemove: function (entity, component) {
            component.onRemove();
        }
    });

    return {
        ParticleSystemComponentSystem: ParticleSystemComponentSystem
    };
}());
