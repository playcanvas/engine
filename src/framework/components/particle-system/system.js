import { Curve } from '../../../core/math/curve.js';
import { CurveSet } from '../../../core/math/curve-set.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Asset } from '../../asset/asset.js';
import { ComponentSystem } from '../system.js';
import { _properties, ParticleSystemComponent } from './component.js';
import { particleChunksGLSL } from '../../../scene/shader-lib/glsl/collections/particle-chunks-glsl.js';
import { particleChunksWGSL } from '../../../scene/shader-lib/wgsl/collections/particle-chunks-wgsl.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../platform/graphics/constants.js';
import { ShaderChunks } from '../../../scene/shader-lib/shader-chunks.js';

/**
 * @import { AppBase } from '../../app-base.js'
 */

const _propertyTypes = {
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

/**
 * Allows an Entity to render a particle system.
 *
 * @category Graphics
 */
class ParticleSystemComponentSystem extends ComponentSystem {
    /**
     * Create a new ParticleSystemComponentSystem.
     *
     * @param {AppBase} app - The Application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'particlesystem';

        this.ComponentType = ParticleSystemComponent;

        this.on('beforeremove', this.onBeforeRemove, this);
        this.app.systems.on('update', this.onUpdate, this);

        // register particle shader chunks
        ShaderChunks.get(app.graphicsDevice, SHADERLANGUAGE_GLSL).add(particleChunksGLSL);
        ShaderChunks.get(app.graphicsDevice, SHADERLANGUAGE_WGSL).add(particleChunksWGSL);
    }

    initializeComponentData(component, _data) {
        // duplicate input data as we are modifying it
        const data = { ..._data };

        // we store the mesh asset id as "mesh" (it should be "meshAsset")
        // this re-maps "mesh" into "meshAsset" if it is an asset or an asset id
        if (data.mesh instanceof Asset || typeof data.mesh === 'number') {
            // migrate into meshAsset property
            data.meshAsset = data.mesh;
            delete data.mesh;
        }

        for (const prop in data) {
            if (data[prop] === undefined || data[prop] === null) continue;

            const type = _propertyTypes[prop];
            if (type === 'vec3') {
                if (Array.isArray(data[prop])) {
                    data[prop] = new Vec3(data[prop][0], data[prop][1], data[prop][2]);
                }
            } else if (type === 'curve') {
                if (!(data[prop] instanceof Curve)) {
                    const t = data[prop].type;
                    data[prop] = new Curve(data[prop].keys);
                    data[prop].type = t;
                }
            } else if (type === 'curveset') {
                if (!(data[prop] instanceof CurveSet)) {
                    const t = data[prop].type;
                    data[prop] = new CurveSet(data[prop].keys);
                    data[prop].type = t;
                }
            }
        }

        // duplicate layer list
        if (data.layers && Array.isArray(data.layers)) {
            data.layers = data.layers.slice(0);
        }

        // store the enabled state before applying the other properties, so that
        // initialization-time side effects in their setters (e.g. asset loading)
        // respect the intended enabled state. Written to the backing field directly
        // to avoid firing enable/disable events before initialization completes.
        if (data.enabled !== undefined) {
            component._enabled = data.enabled;
        }

        for (let i = 0; i < _properties.length; i++) {
            const property = _properties[i];
            if (data[property] !== undefined) {
                component[property] = data[property];
            }
        }

        super.initializeComponentData(component, data);
    }

    cloneComponent(entity, clone) {
        const c = entity.particlesystem;

        const data = {
            enabled: c.enabled
        };

        for (let i = 0; i < _properties.length; i++) {
            const prop = _properties[i];
            const value = c[prop];
            if (value instanceof Vec3 || value instanceof Curve || value instanceof CurveSet) {
                data[prop] = value.clone();
            } else if (prop === 'layers') {
                data.layers = value.slice(0);
            } else if (value !== null && value !== undefined) {
                data[prop] = value;
            }
        }

        return this.addComponent(clone, data);
    }

    onUpdate(dt) {
        const components = this.store;
        const stats = this.app.stats.particles;
        const composition = this.app.scene.layers;

        // disable light cube on all layers first
        for (let i = 0; i < composition.layerList.length; i++) {
            composition.layerList[i].requiresLightCube = false;
        }

        for (const id in components) {
            if (components.hasOwnProperty(id)) {
                const component = components[id].entity.particlesystem;
                const entity = component.entity;

                if (component.enabled && entity.enabled) {
                    const emitter = component.emitter;
                    if (!emitter?.meshInstance.visible) continue;

                    // if emitter is using lighting, enable light cube on all layers it is assigned to
                    if (emitter.lighting) {
                        const layers = component.layers;
                        for (let i = 0; i < layers.length; i++) {
                            const layer = composition.getLayerById(layers[i]);
                            if (layer) {
                                layer.requiresLightCube = true;
                            }
                        }
                    }

                    if (!component._paused) {
                        let numSteps = 0;
                        emitter.simTime += dt;
                        if (emitter.simTime >= emitter.fixedTimeStep) {
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
