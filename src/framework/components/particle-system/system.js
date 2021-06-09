import { Curve } from '../../../math/curve.js';
import { CurveSet } from '../../../math/curve-set.js';
import { Vec3 } from '../../../math/vec3.js';

import { LIGHTTYPE_DIRECTIONAL } from '../../../scene/constants.js';

import { Asset } from '../../../asset/asset.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { ParticleSystemComponent } from './component.js';
import { ParticleSystemComponentData } from './data.js';

const _schema = [
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
    'screenSpace',
    'colorMapAsset',
    'normalMapAsset',
    'mesh',
    'meshAsset',
    'renderAsset',
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
 * @name ParticleSystemComponentSystem
 * @augments ComponentSystem
 * @classdesc Allows an Entity to render a particle system.
 * @description Create a new ParticleSystemComponentSystem.
 * @param {Application} app - The Application.
 */
class ParticleSystemComponentSystem extends ComponentSystem {
    constructor(app) {
        super(app);

        this.id = 'particlesystem';

        this.ComponentType = ParticleSystemComponent;
        this.DataType = ParticleSystemComponentData;

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

        this.on('beforeremove', this.onBeforeRemove, this);
        ComponentSystem.bind('update', this.onUpdate, this);
    }

    initializeComponentData(component, _data, properties) {
        var data = {};

        properties = [];
        var types = this.propertyTypes;
        var t;

        // we store the mesh asset id as "mesh" (it should be "meshAsset")
        // this re-maps "mesh" into "meshAsset" if it is an asset or an asset id
        if (_data.mesh instanceof Asset || typeof _data.mesh === 'number') {
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
                if (Array.isArray(data[prop])) {
                    data[prop] = new Vec3(data[prop][0], data[prop][1], data[prop][2]);
                }
            } else if (types[prop] === 'curve') {
                if (!(data[prop] instanceof Curve)) {
                    t = data[prop].type;
                    data[prop] = new Curve(data[prop].keys);
                    data[prop].type = t;
                }
            } else if (types[prop] === 'curveset') {
                if (!(data[prop] instanceof CurveSet)) {
                    t = data[prop].type;
                    data[prop] = new CurveSet(data[prop].keys);
                    data[prop].type = t;
                }
            }

            // duplicate layer list
            if (data.layers && Array.isArray(data.layers)) {
                data.layers = data.layers.slice(0);
            }
        }

        super.initializeComponentData(component, data, properties);
    }

    cloneComponent(entity, clone) {
        var source = entity.particlesystem.data;
        var schema = this.schema;

        var data = {};

        for (var i = 0, len = schema.length; i < len; i++) {
            var prop = schema[i];
            var sourceProp = source[prop];
            if (sourceProp instanceof Vec3 ||
                sourceProp instanceof Curve ||
                sourceProp instanceof CurveSet) {

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
    }

    onUpdate(dt) {
        var components = this.store;
        var numSteps, i, j, c;
        var stats = this.app.stats.particles;

        for (var id in components) {
            if (components.hasOwnProperty(id)) {
                c = components[id];
                var entity = c.entity;
                var data = c.data;

                if (data.enabled && entity.enabled) {
                    var emitter = data.model.emitter;
                    if (!emitter.meshInstance.visible) continue;

                    // Bake ambient and directional lighting into one ambient cube
                    // TODO: only do if lighting changed
                    // TODO: don't do for every emitter
                    if (emitter.lighting) {
                        var layer, lightCube;
                        var layers = data.layers;
                        for (i = 0; i < layers.length; i++) {
                            layer = this.app.scene.layers.getLayerById(layers[i]);
                            if (!layer) continue;

                            if (!layer._lightCube) {
                                layer._lightCube = new Float32Array(6 * 3);
                            }
                            lightCube = layer._lightCube;
                            for (i = 0; i < 6; i++) {
                                lightCube[i * 3] = this.app.scene.ambientLight.r;
                                lightCube[i * 3 + 1] = this.app.scene.ambientLight.g;
                                lightCube[i * 3 + 2] = this.app.scene.ambientLight.b;
                            }
                            var dirs = layer._splitLights[LIGHTTYPE_DIRECTIONAL];
                            for (j = 0; j < dirs.length; j++) {
                                for (c = 0; c < 6; c++) {
                                    var weight = Math.max(emitter.lightCubeDir[c].dot(dirs[j]._direction), 0) * dirs[j]._intensity;
                                    lightCube[c * 3] += dirs[j]._color.r * weight;
                                    lightCube[c * 3 + 1] += dirs[j]._color.g * weight;
                                    lightCube[c * 3 + 2] += dirs[j]._color.b * weight;
                                }
                            }
                        }
                        emitter.constantLightCube.setValue(lightCube); // ?
                    }

                    if (!data.paused) {
                        emitter.simTime += dt;
                        if (emitter.simTime > emitter.fixedTimeStep) {
                            numSteps = Math.floor(emitter.simTime / emitter.fixedTimeStep);
                            emitter.simTime -= numSteps * emitter.fixedTimeStep;
                        }
                        if (numSteps) {
                            numSteps = Math.min(numSteps, emitter.maxSubSteps);
                            for (i = 0; i < numSteps; i++) {
                                emitter.addTime(emitter.fixedTimeStep, false);
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
    }

    onBeforeRemove(entity, component) {
        component.onBeforeRemove();
    }
}

Component._buildAccessors(ParticleSystemComponent.prototype, _schema);

export { ParticleSystemComponentSystem };
