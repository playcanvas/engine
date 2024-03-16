import { Curve } from '../../../core/math/curve.js';
import { CurveSet } from '../../../core/math/curve-set.js';
import { Vec3 } from '../../../core/math/vec3.js';

import { Asset } from '../../asset/asset.js';

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
 * Allows an Entity to render a particle system.
 *
 * @category Graphics
 */
class ParticleSystemComponentSystem extends ComponentSystem {
    /**
     * Create a new ParticleSystemComponentSystem.
     *
     * @param {import('../../app-base.js').AppBase} app - The Application.
     * @ignore
     */
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
        this.app.systems.on('update', this.onUpdate, this);
    }

    initializeComponentData(component, _data, properties) {
        const data = {};

        properties = [];
        const types = this.propertyTypes;

        // we store the mesh asset id as "mesh" (it should be "meshAsset")
        // this re-maps "mesh" into "meshAsset" if it is an asset or an asset id
        if (_data.mesh instanceof Asset || typeof _data.mesh === 'number') {
            // migrate into meshAsset property
            _data.meshAsset = _data.mesh;
            delete _data.mesh;
        }

        for (const prop in _data) {
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
                    const t = data[prop].type;
                    data[prop] = new Curve(data[prop].keys);
                    data[prop].type = t;
                }
            } else if (types[prop] === 'curveset') {
                if (!(data[prop] instanceof CurveSet)) {
                    const t = data[prop].type;
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
        const source = entity.particlesystem.data;
        const schema = this.schema;

        const data = {};

        for (let i = 0, len = schema.length; i < len; i++) {
            const prop = schema[i];
            let sourceProp = source[prop];
            if (sourceProp instanceof Vec3 ||
                sourceProp instanceof Curve ||
                sourceProp instanceof CurveSet) {

                sourceProp = sourceProp.clone();
                data[prop] = sourceProp;
            } else if (prop === 'layers') {
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
        const components = this.store;
        let numSteps;
        const stats = this.app.stats.particles;
        const composition = this.app.scene.layers;

        // disable light cube on all layers first
        for (let i = 0; i < composition.layerList.length; i++) {
            composition.layerList[i].requiresLightCube = false;
        }

        for (const id in components) {
            if (components.hasOwnProperty(id)) {
                const component = components[id];
                const entity = component.entity;
                const data = component.data;

                if (data.enabled && entity.enabled) {
                    const emitter = entity.particlesystem.emitter;
                    if (!emitter?.meshInstance.visible) continue;

                    // if emitter is using lighting, enable light cube on all layers it is assigned to
                    if (emitter.lighting) {
                        const layers = data.layers;
                        for (let i = 0; i < layers.length; i++) {
                            const layer = composition.getLayerById(layers[i]);
                            if (layer)
                                layer.requiresLightCube = true;
                        }
                    }

                    if (!data.paused) {
                        emitter.simTime += dt;
                        if (emitter.simTime > emitter.fixedTimeStep) {
                            numSteps = Math.floor(emitter.simTime / emitter.fixedTimeStep);
                            emitter.simTime -= numSteps * emitter.fixedTimeStep;
                        }
                        if (numSteps) {
                            numSteps = Math.min(numSteps, emitter.maxSubSteps);
                            for (let i = 0; i < numSteps; i++) {
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

    destroy() {
        super.destroy();

        this.app.systems.off('update', this.onUpdate, this);
    }
}

export { ParticleSystemComponentSystem };
