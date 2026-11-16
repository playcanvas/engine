import {
    BLEND_ADDITIVEALPHA,
    BLEND_NORMAL,
    Entity,
    EventHandler,
    MeshInstance,
    Quat,
    StandardMaterial,
    Vec3
} from 'playcanvas';

/**
 * @import { AppBase, Color, Mesh, ParticleSystemComponent, Texture } from 'playcanvas'
 */

/**
 * One emitter of an effect.
 *
 * @typedef {object} EffectLayer
 * @property {string} name - The name of the emitter entity.
 * @property {object} options - The particle system component options. The effect makes every
 * layer a one-shot, so `loop` and `autoPlay` are ignored.
 * @property {number} [delay] - The seconds from the start of the effect until this layer emits.
 * Defaults to 0.
 * @property {Vec3} [position] - The position of the emitter in the space of the effect, where +Y
 * points along the surface normal. Defaults to the origin.
 */

/**
 * A light flash that fades out over the duration.
 *
 * @typedef {object} EffectLight
 * @property {Color} color - The color of the light.
 * @property {number} intensity - The intensity at the start of the flash.
 * @property {number} range - The range of the light.
 * @property {number} duration - The seconds until the light has faded out.
 * @property {number} [offset] - The distance of the light along the surface normal. Defaults to 0.5.
 * @property {number} [flicker] - How much the light flickers, 0-1. Defaults to 0.
 */

/**
 * A mark left on the surface, such as a scorch mark or a bullet hole, that fades out at the end.
 *
 * @typedef {object} EffectDecal
 * @property {Mesh} mesh - A unit plane facing +Y.
 * @property {Texture} texture - The texture. Its alpha is the coverage.
 * @property {Color} color - The tint of a lit decal, or the color of a glowing one.
 * @property {number[]} size - The range of the size.
 * @property {number} duration - The seconds the decal stays, including the fade.
 * @property {number} [fade] - The seconds it takes to fade out. Defaults to 1.
 * @property {number} [delay] - The seconds from the start of the effect until it appears.
 * Defaults to 0.
 * @property {number} [glow] - When set, the decal glows with this intensity instead of being lit.
 */

/**
 * A complete effect, made of one or more emitters.
 *
 * @typedef {object} EffectDefinition
 * @property {EffectLayer[]} layers - The emitters of the effect.
 * @property {EffectLight} [light] - An optional light flash.
 * @property {EffectDecal[]} [decals] - Optional marks left on the surface.
 * @property {number} [shake] - An optional camera shake strength, sent with the pool's `shake`
 * event when the effect starts.
 * @property {number} [maxInstances] - The most instances of this effect playing at once. When all
 * are playing, the oldest one restarts at the new position. Defaults to 16.
 */

const tmpRotation = new Quat();

/**
 * The decal materials, shared by all instances of an effect. The instances fade their decals
 * with a parameter on their mesh instance.
 *
 * @type {WeakMap<EffectDecal, StandardMaterial>}
 */
const decalMaterials = new WeakMap();

/**
 * @param {EffectDecal} decal - The decal definition.
 * @returns {StandardMaterial} The material of the decal.
 */
const getDecalMaterial = (decal) => {
    let material = decalMaterials.get(decal);
    if (!material) {
        material = new StandardMaterial();
        material.opacityMap = decal.texture;
        material.opacityMapChannel = 'a';
        material.depthWrite = false;
        // pull the decal towards the camera in the depth test, so the surface doesn't hide it,
        // even when seen at a grazing angle
        material.depthBias = -0.1;
        material.slopeDepthBias = -2;
        if (decal.glow) {
            material.diffuse.set(0, 0, 0);
            material.emissive = decal.color;
            material.emissiveMap = decal.texture;
            material.emissiveIntensity = decal.glow;
            material.useLighting = false;
            material.blendType = BLEND_ADDITIVEALPHA;
        } else {
            material.diffuse = decal.color;
            material.diffuseMap = decal.texture;
            material.gloss = 0.2;
            material.blendType = BLEND_NORMAL;
        }
        material.update();
        decalMaterials.set(decal, material);
    }
    return material;
};

/**
 * A single instance of an effect. It owns an entity with a child entity per layer, and plays all
 * of them as one-shots, each after its own delay.
 */
class ParticleEffect {
    /**
     * @type {Entity}
     */
    entity;

    /**
     * @type {{ entity: Entity, delay: number, started: boolean }[]}
     */
    layers = [];

    /**
     * @type {Entity|null}
     */
    light = null;

    /**
     * @type {{ entity: Entity, meshInstance: MeshInstance, definition: EffectDecal }[]}
     */
    decals = [];

    /**
     * The seconds since the effect started.
     *
     * @type {number}
     */
    time = 0;

    /**
     * The seconds the effect takes to finish, including the delays of its layers.
     *
     * @type {number}
     */
    duration = 0;

    /**
     * True while the effect is playing.
     *
     * @type {boolean}
     */
    playing = false;

    /**
     * @param {string} name - The name of the effect.
     * @param {EffectDefinition} definition - The definition of the effect.
     * @param {number[]} [lightLayers] - The layers the light of the effect lights. Defaults to the
     * World layer.
     */
    constructor(name, definition, lightLayers) {
        this.definition = definition;
        this.entity = new Entity(name);
        this.entity.enabled = false;

        for (const layer of definition.layers) {
            const entity = new Entity(layer.name);
            if (layer.position) {
                entity.setLocalPosition(layer.position);
            }

            // layers waiting for their delay stay disabled, so the previous play doesn't show
            entity.enabled = false;
            entity.addComponent('particlesystem', {
                ...layer.options,
                loop: false,
                autoPlay: false
            });
            this.entity.addChild(entity);

            const delay = layer.delay ?? 0;
            this.layers.push({ entity, delay, started: false });

            // a one-shot emits for rate * numParticles seconds, and the last particle then lives
            // for the lifetime
            const ps = /** @type {ParticleSystemComponent} */ (entity.particlesystem);
            const emitDuration = Math.max(ps.rate, ps.rate2) * ps.numParticles;
            this.duration = Math.max(this.duration, delay + emitDuration + ps.lifetime);
        }

        const light = definition.light;
        if (light) {
            this.light = new Entity('Light');
            this.light.addComponent('light', {
                type: 'omni',
                color: light.color,
                intensity: 0,
                range: light.range,
                castShadows: false,
                ...(lightLayers ? { layers: lightLayers } : {})
            });
            this.light.setLocalPosition(0, light.offset ?? 0.5, 0);
            this.entity.addChild(this.light);
            this.duration = Math.max(this.duration, light.duration);
        }

        (definition.decals ?? []).forEach((decal, i) => {
            const meshInstance = new MeshInstance(decal.mesh, getDecalMaterial(decal));
            const entity = new Entity('Decal');
            entity.addComponent('render', {
                meshInstances: [meshInstance],
                castShadows: false
            });
            // lifted off the surface, so it doesn't fight with it in the depth buffer, and each
            // decal a little higher than the one before
            entity.setLocalPosition(0, 0.02 + i * 0.005, 0);
            this.entity.addChild(entity);
            this.decals.push({ entity, meshInstance, definition: decal });
            this.duration = Math.max(this.duration, (decal.delay ?? 0) + decal.duration);
        });
    }

    /**
     * Starts the effect, restarting it if it is still playing.
     *
     * @param {Vec3} position - The position of the effect.
     * @param {Vec3} normal - The direction the effect faces, usually the normal of the surface it
     * hits. Its +Y axis points this way.
     */
    play(position, normal) {
        this.entity.setPosition(position);
        this.entity.setRotation(tmpRotation.setFromDirections(Vec3.UP, normal));
        this.entity.enabled = true;

        for (const layer of this.layers) {
            layer.entity.enabled = false;
            layer.started = false;
        }

        // every decal is a little different
        for (const { entity, definition } of this.decals) {
            const size = definition.size[0] + Math.random() * (definition.size[1] - definition.size[0]);
            entity.setLocalScale(size, 1, size);
            entity.setLocalEulerAngles(0, Math.random() * 360, 0);
            entity.enabled = false;
        }

        this.time = 0;
        this.playing = true;
        this.update(0);
    }

    /**
     * Advances the effect, starting layers whose delay has passed and fading the light.
     *
     * @param {number} dt - The time step in seconds.
     */
    update(dt) {
        if (!this.playing) {
            return;
        }
        this.time += dt;

        for (const layer of this.layers) {
            if (!layer.started && this.time >= layer.delay) {
                layer.started = true;
                layer.entity.enabled = true;
                const ps = /** @type {ParticleSystemComponent} */ (layer.entity.particlesystem);
                ps.reset();
                ps.play();
            }
        }

        const light = this.definition.light;
        if (this.light?.light && light) {
            const fade = Math.max(0, 1 - this.time / light.duration);
            const flicker = 1 - (light.flicker ?? 0) * Math.random();
            this.light.light.intensity = light.intensity * fade * fade * flicker;
        }

        for (const { entity, meshInstance, definition } of this.decals) {
            const age = this.time - (definition.delay ?? 0);
            entity.enabled = age >= 0 && age < definition.duration;
            const fade = definition.fade ?? 1;
            const opacity = Math.min(1, Math.max(0, (definition.duration - age) / fade));
            meshInstance.setParameter('material_opacity', opacity);
        }

        if (this.time >= this.duration) {
            this.playing = false;
            this.entity.enabled = false;
        }
    }

    destroy() {
        this.entity.destroy();
    }
}

/**
 * Plays effects by name, reusing the instances that have finished. Instances are created on
 * demand, up to the `maxInstances` of each effect.
 *
 * @example
 * const pool = new ParticleEffectPool(app, { spark: sparkDefinition });
 * pool.on('shake', strength => shakeCamera(strength));
 * pool.spawn('spark', hitPoint, hitNormal);
 */
class ParticleEffectPool extends EventHandler {
    /**
     * @type {Map<string, ParticleEffect[]>}
     */
    _instances = new Map();

    /**
     * @param {AppBase} app - The application.
     * @param {Record<string, EffectDefinition>} definitions - The effects, by name.
     * @param {object} [options] - The options.
     * @param {Entity} [options.parent] - The entity the effects are added to. Defaults to the
     * scene root.
     * @param {number[]} [options.lightLayers] - The layers the lights of the effects light, when
     * the scene uses layers other than World. Defaults to the World layer.
     */
    constructor(app, definitions, { parent = app.root, lightLayers } = {}) {
        super();
        this.app = app;
        this.definitions = definitions;
        this.parent = parent;
        this.lightLayers = lightLayers;
        app.on('update', this.update, this);
    }

    /**
     * Plays an effect.
     *
     * @param {string} name - The name of the effect.
     * @param {Vec3} position - The position of the effect.
     * @param {Vec3} [normal] - The direction the effect faces. Defaults to up.
     * @returns {ParticleEffect} The instance playing the effect.
     */
    spawn(name, position, normal = Vec3.UP) {
        const definition = this.definitions[name];
        if (!definition) {
            throw new Error(`Unknown particle effect '${name}'`);
        }

        let instances = this._instances.get(name);
        if (!instances) {
            instances = [];
            this._instances.set(name, instances);
        }

        // reuse a finished instance, create a new one, or restart the one that played the longest
        let effect = instances.find((instance) => !instance.playing);
        if (!effect) {
            if (instances.length < (definition.maxInstances ?? 16)) {
                effect = new ParticleEffect(name, definition, this.lightLayers);
                this.parent.addChild(effect.entity);
                instances.push(effect);
            } else {
                effect = instances.reduce((oldest, instance) => (instance.time > oldest.time ? instance : oldest));
            }
        }

        effect.play(position, normal);

        if (definition.shake) {
            this.fire('shake', definition.shake, position);
        }
        return effect;
    }

    /**
     * Calls a function for the particle system of every layer of every instance, for example to
     * change a setting at runtime.
     *
     * @param {(ps: ParticleSystemComponent, layer: EffectLayer) => void} callback - The function.
     */
    forEachLayer(callback) {
        for (const [name, instances] of this._instances) {
            const layers = this.definitions[name].layers;
            for (const instance of instances) {
                instance.layers.forEach((layer, i) => {
                    callback(/** @type {ParticleSystemComponent} */ (layer.entity.particlesystem), layers[i]);
                });
            }
        }
    }

    /**
     * The number of effects playing.
     *
     * @type {number}
     */
    get activeCount() {
        let count = 0;
        for (const instances of this._instances.values()) {
            for (const instance of instances) {
                if (instance.playing) count++;
            }
        }
        return count;
    }

    /**
     * The number of effect instances, playing or waiting for reuse.
     *
     * @type {number}
     */
    get instanceCount() {
        let count = 0;
        for (const instances of this._instances.values()) {
            count += instances.length;
        }
        return count;
    }

    /**
     * @param {number} dt - The time step in seconds.
     * @private
     */
    update(dt) {
        for (const instances of this._instances.values()) {
            for (const instance of instances) {
                instance.update(dt);
            }
        }
    }

    destroy() {
        this.app.off('update', this.update, this);
        for (const instances of this._instances.values()) {
            instances.forEach((instance) => instance.destroy());
        }
        this._instances.clear();
        this.off();
    }
}

export { ParticleEffect, ParticleEffectPool };
