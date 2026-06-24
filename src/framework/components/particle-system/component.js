import { Vec3 } from '../../../core/math/vec3.js';
import { BLEND_NORMAL, EMITTERSHAPE_BOX, LAYERID_DEPTH, LAYERID_WORLD, PARTICLEORIENTATION_SCREEN } from '../../../scene/constants.js';
import { Mesh } from '../../../scene/mesh.js';
import { ParticleEmitter } from '../../../scene/particle-system/particle-emitter.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

/**
 * @import { CurveSet } from '../../../core/math/curve-set.js'
 * @import { Curve } from '../../../core/math/curve.js'
 * @import { EventHandle } from '../../../core/event-handle.js'
 * @import { Texture } from '../../../platform/graphics/texture.js'
 */

const ASSET_PROPERTIES = ['colorMapAsset', 'normalMapAsset', 'meshAsset', 'renderAsset'];

// properties that the component can be initialized with, in the order they are applied
const _properties = [
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

let depthLayer;

/**
 * The ParticleSystemComponent enables an {@link Entity} to simulate particles and produce a
 * renderable particle mesh on either CPU or GPU. GPU simulation is generally much faster than
 * its CPU counterpart, because it avoids slow CPU-GPU synchronization and takes advantage of
 * many GPU cores. However, it requires client support for reasonable uniform counts, reading
 * from multiple textures in a vertex shader and the OES_texture_float extension, including
 * rendering into float textures. Most mobile devices fail to satisfy these requirements, so it's
 * not recommended to simulate thousands of particles on them. The GPU version also can't sort
 * particles, so enabling sorting forces CPU mode too.
 *
 * Particle rotation is specified by a single angle parameter: default billboard particles rotate
 * around the camera-facing axis, while mesh particles rotate around two different view-independent
 * axes. Most of the simulation parameters are specified with {@link Curve} or {@link CurveSet}.
 * Curves are interpolated based on each particle's lifetime, therefore parameters are able to
 * change over time. Most curve parameters can also be specified by 2 minimum/maximum curves, so
 * that each particle picks a random value in-between.
 *
 * You should never need to use the ParticleSystemComponent constructor directly. To add a
 * ParticleSystemComponent to an {@link Entity}, use {@link Entity#addComponent}:
 *
 * ```javascript
 * const entity = new pc.Entity();
 * entity.addComponent('particlesystem', {
 *     numParticles: 100,
 *     lifetime: 2,
 *     rate: 0.1
 * });
 * ```
 *
 * Once the ParticleSystemComponent is added to the entity, you can access it via the
 * {@link Entity#particlesystem} property:
 *
 * ```javascript
 * entity.particlesystem.loop = false; // Play the system once then stop
 *
 * console.log(entity.particlesystem.loop); // Get the loop flag and print it
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Particle Animated Index](https://playcanvas.github.io/#/graphics/particles-anim-index)
 * - [Particle Mesh](https://playcanvas.github.io/#/graphics/particles-mesh)
 * - [Particle Random Sprites](https://playcanvas.github.io/#/graphics/particles-random-sprites)
 * - [Particle Snow](https://playcanvas.github.io/#/graphics/particles-snow)
 * - [Particle Spark](https://playcanvas.github.io/#/graphics/particles-spark)
 *
 * @hideconstructor
 * @category Graphics
 */
class ParticleSystemComponent extends Component {
    /**
     * The particle emitter that performs the simulation. Only set while the component is or has
     * been enabled and the platform supports particle systems.
     *
     * @type {ParticleEmitter|null}
     * @ignore
     */
    emitter = null;

    /** @private */
    _requestedDepth = false;

    /** @private */
    _drawOrder = 0;

    /** @private */
    _paused = false;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtLayersChanged = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtLayerAdded = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtLayerRemoved = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtSetMeshes = null;

    /** @private */
    _autoPlay = true;

    /** @private */
    _numParticles = 1;

    /** @private */
    _lifetime = 50;

    /** @private */
    _rate = 1;

    /**
     * @type {number|null}
     * @private
     */
    _rate2 = null;

    /** @private */
    _startAngle = 0;

    /**
     * @type {number|null}
     * @private
     */
    _startAngle2 = null;

    /** @private */
    _loop = true;

    /** @private */
    _preWarm = false;

    /** @private */
    _lighting = false;

    /** @private */
    _halfLambert = false;

    /** @private */
    _intensity = 1;

    /** @private */
    _depthWrite = false;

    /** @private */
    _noFog = false;

    /** @private */
    _depthSoftening = 0;

    /** @private */
    _sort = 0;

    /** @private */
    _blendType = BLEND_NORMAL;

    /** @private */
    _stretch = 0.0;

    /** @private */
    _alignToMotion = false;

    /** @private */
    _emitterShape = EMITTERSHAPE_BOX;

    /** @private */
    _emitterExtents = new Vec3();

    /** @private */
    _emitterExtentsInner = new Vec3();

    /** @private */
    _emitterRadius = 0;

    /** @private */
    _emitterRadiusInner = 0;

    /** @private */
    _initialVelocity = 0;

    /** @private */
    _wrap = false;

    /** @private */
    _wrapBounds = new Vec3();

    /** @private */
    _localSpace = false;

    /** @private */
    _screenSpace = false;

    /**
     * @type {number|null}
     * @private
     */
    _colorMapAsset = null;

    /**
     * @type {number|null}
     * @private
     */
    _normalMapAsset = null;

    /**
     * @type {Mesh|null}
     * @private
     */
    _mesh = null;

    /**
     * @type {number|null}
     * @private
     */
    _meshAsset = null;

    /**
     * @type {number|null}
     * @private
     */
    _renderAsset = null;

    /** @private */
    _orientation = PARTICLEORIENTATION_SCREEN;

    /** @private */
    _particleNormal = new Vec3(0, 1, 0);

    /**
     * @type {CurveSet|null}
     * @private
     */
    _localVelocityGraph = null;

    /**
     * @type {CurveSet|null}
     * @private
     */
    _localVelocityGraph2 = null;

    /**
     * @type {CurveSet|null}
     * @private
     */
    _velocityGraph = null;

    /**
     * @type {CurveSet|null}
     * @private
     */
    _velocityGraph2 = null;

    /**
     * @type {Curve|null}
     * @private
     */
    _rotationSpeedGraph = null;

    /**
     * @type {Curve|null}
     * @private
     */
    _rotationSpeedGraph2 = null;

    /**
     * @type {Curve|null}
     * @private
     */
    _radialSpeedGraph = null;

    /**
     * @type {Curve|null}
     * @private
     */
    _radialSpeedGraph2 = null;

    /**
     * @type {Curve|null}
     * @private
     */
    _scaleGraph = null;

    /**
     * @type {Curve|null}
     * @private
     */
    _scaleGraph2 = null;

    /**
     * @type {CurveSet|null}
     * @private
     */
    _colorGraph = null;

    /**
     * @type {CurveSet|null}
     * @private
     */
    _colorGraph2 = null;

    /**
     * @type {Curve|null}
     * @private
     */
    _alphaGraph = null;

    /**
     * @type {Curve|null}
     * @private
     */
    _alphaGraph2 = null;

    /**
     * @type {Texture|null}
     * @private
     */
    _colorMap = null;

    /**
     * @type {Texture|null}
     * @private
     */
    _normalMap = null;

    /** @private */
    _animTilesX = 1;

    /** @private */
    _animTilesY = 1;

    /** @private */
    _animStartFrame = 0;

    /** @private */
    _animNumFrames = 1;

    /** @private */
    _animNumAnimations = 1;

    /** @private */
    _animIndex = 0;

    /** @private */
    _randomizeAnimIndex = false;

    /** @private */
    _animSpeed = 1;

    /** @private */
    _animLoop = true;

    /**
     * @type {number[]}
     * @private
     */
    _layers = [LAYERID_WORLD];

    /**
     * Sets whether the particle system plays automatically on creation. If set to false, it is
     * necessary to call {@link play} for the particle system to play. Defaults to true.
     *
     * @type {boolean}
     */
    set autoPlay(arg) {
        this._autoPlay = arg;
    }

    /**
     * Gets whether the particle system plays automatically on creation.
     *
     * @type {boolean}
     */
    get autoPlay() {
        return this._autoPlay;
    }

    /**
     * Sets the maximum number of simulated particles.
     *
     * @type {number}
     */
    set numParticles(arg) {
        this._setComplexProperty('numParticles', arg);
    }

    /**
     * Gets the maximum number of simulated particles.
     *
     * @type {number}
     */
    get numParticles() {
        return this._numParticles;
    }

    /**
     * Sets the length of time in seconds between a particle's birth and its death.
     *
     * @type {number}
     */
    set lifetime(arg) {
        this._setComplexProperty('lifetime', arg);
    }

    /**
     * Gets the length of time in seconds between a particle's birth and its death.
     *
     * @type {number}
     */
    get lifetime() {
        return this._lifetime;
    }

    /**
     * Sets the minimal interval in seconds between particle births.
     *
     * @type {number}
     */
    set rate(arg) {
        this._setComplexProperty('rate', arg);
    }

    /**
     * Gets the minimal interval in seconds between particle births.
     *
     * @type {number}
     */
    get rate() {
        return this._rate;
    }

    /**
     * Sets the maximal interval in seconds between particle births.
     *
     * @type {number}
     */
    set rate2(arg) {
        this._setComplexProperty('rate2', arg);
    }

    /**
     * Gets the maximal interval in seconds between particle births.
     *
     * @type {number}
     */
    get rate2() {
        return this._rate2;
    }

    /**
     * Sets the minimal initial Euler angle of a particle.
     *
     * @type {number}
     */
    set startAngle(arg) {
        this._setComplexProperty('startAngle', arg);
    }

    /**
     * Gets the minimal initial Euler angle of a particle.
     *
     * @type {number}
     */
    get startAngle() {
        return this._startAngle;
    }

    /**
     * Sets the maximal initial Euler angle of a particle.
     *
     * @type {number}
     */
    set startAngle2(arg) {
        this._setComplexProperty('startAngle2', arg);
    }

    /**
     * Gets the maximal initial Euler angle of a particle.
     *
     * @type {number}
     */
    get startAngle2() {
        return this._startAngle2;
    }

    /**
     * Sets whether the particle system loops.
     *
     * @type {boolean}
     */
    set loop(arg) {
        this._loop = arg;
        if (this.emitter) {
            this.emitter.loop = arg;
            this.emitter.resetTime(arg ? undefined : this.emitter.lifetime);
            this.emitter.resetMaterial();
        }
    }

    /**
     * Gets whether the particle system loops.
     *
     * @type {boolean}
     */
    get loop() {
        return this._loop;
    }

    /**
     * Sets whether the particle system will be initialized as though it has already completed a
     * full cycle. This only works with looping particle systems.
     *
     * @type {boolean}
     */
    set preWarm(arg) {
        this._setComplexProperty('preWarm', arg);
    }

    /**
     * Gets whether the particle system will be initialized as though it has already completed a
     * full cycle.
     *
     * @type {boolean}
     */
    get preWarm() {
        return this._preWarm;
    }

    /**
     * Sets whether particles will be lit by ambient and directional lights.
     *
     * @type {boolean}
     */
    set lighting(arg) {
        this._setComplexProperty('lighting', arg);
    }

    /**
     * Gets whether particles will be lit by ambient and directional lights.
     *
     * @type {boolean}
     */
    get lighting() {
        return this._lighting;
    }

    /**
     * Sets whether Half Lambert lighting is enabled. Enabling Half Lambert lighting avoids
     * particles looking too flat in shadowed areas. It is a completely non-physical lighting model
     * but can give more pleasing visual results.
     *
     * @type {boolean}
     */
    set halfLambert(arg) {
        this._setComplexProperty('halfLambert', arg);
    }

    /**
     * Gets whether Half Lambert lighting is enabled.
     *
     * @type {boolean}
     */
    get halfLambert() {
        return this._halfLambert;
    }

    /**
     * Sets the color multiplier.
     *
     * @type {number}
     */
    set intensity(arg) {
        this._setComplexProperty('intensity', arg);
    }

    /**
     * Gets the color multiplier.
     *
     * @type {number}
     */
    get intensity() {
        return this._intensity;
    }

    /**
     * Sets whether depth writes is enabled. If enabled, the particles will write to the depth
     * buffer. If disabled, the depth buffer is left unchanged and particles will be guaranteed to
     * overwrite one another in the order in which they are rendered.
     *
     * @type {boolean}
     */
    set depthWrite(arg) {
        this._setComplexProperty('depthWrite', arg);
    }

    /**
     * Gets whether depth writes is enabled.
     *
     * @type {boolean}
     */
    get depthWrite() {
        return this._depthWrite;
    }

    /**
     * Sets whether fogging is ignored.
     *
     * @type {boolean}
     */
    set noFog(arg) {
        this._setComplexProperty('noFog', arg);
    }

    /**
     * Gets whether fogging is ignored.
     *
     * @type {boolean}
     */
    get noFog() {
        return this._noFog;
    }

    /**
     * Sets whether depth softening is enabled. Controls fading of particles near their
     * intersections with scene geometry. This effect, when it's non-zero, requires scene depth map
     * to be rendered. Multiple depth-dependent effects can share the same map, but if you only use
     * it for particles, bear in mind that it can double engine draw calls.
     *
     * @type {number}
     */
    set depthSoftening(arg) {
        const oldValue = this._depthSoftening;
        if (oldValue !== arg) {
            this._depthSoftening = arg;
            if (arg) {
                if (this.enabled && this.entity.enabled) this._requestDepth();
            } else {
                if (this.enabled && this.entity.enabled) this._releaseDepth();
            }
            if (this.emitter) {
                this.emitter.depthSoftening = arg;
                this.reset();
                this.emitter.resetMaterial();
                this.rebuild();
            }
        }
    }

    /**
     * Gets whether depth softening is enabled.
     *
     * @type {number}
     */
    get depthSoftening() {
        return this._depthSoftening;
    }

    /**
     * Sets the particle sorting mode. Forces CPU simulation, so be careful.
     *
     * - {@link PARTICLESORT_NONE}: No sorting, particles are drawn in arbitrary order. Can be
     * simulated on GPU.
     * - {@link PARTICLESORT_DISTANCE}: Sorting based on distance to the camera. CPU only.
     * - {@link PARTICLESORT_NEWER_FIRST}: Newer particles are drawn first. CPU only.
     * - {@link PARTICLESORT_OLDER_FIRST}: Older particles are drawn first. CPU only.
     *
     * @type {number}
     */
    set sort(arg) {
        this._setComplexProperty('sort', arg);
    }

    /**
     * Gets the particle sorting mode.
     *
     * @type {number}
     */
    get sort() {
        return this._sort;
    }

    /**
     * Sets how particles are blended when being written to the currently active render target.
     * Can be:
     *
     * - {@link BLEND_SUBTRACTIVE}: Subtract the color of the source fragment from the destination
     * fragment and write the result to the frame buffer.
     * - {@link BLEND_ADDITIVE}: Add the color of the source fragment to the destination fragment and
     * write the result to the frame buffer.
     * - {@link BLEND_NORMAL}: Enable simple translucency for materials such as glass. This is
     * equivalent to enabling a source blend mode of {@link BLENDMODE_SRC_ALPHA} and
     * a destination
     * blend mode of {@link BLENDMODE_ONE_MINUS_SRC_ALPHA}.
     * - {@link BLEND_NONE}: Disable blending.
     * - {@link BLEND_PREMULTIPLIED}: Similar to {@link BLEND_NORMAL} expect
     * the source fragment is
     * assumed to have already been multiplied by the source alpha value.
     * - {@link BLEND_MULTIPLICATIVE}: Multiply the color of the source fragment by the color of the
     * destination fragment and write the result to the frame buffer.
     * - {@link BLEND_ADDITIVEALPHA}: Same as {@link BLEND_ADDITIVE} except
     * the source RGB is
     * multiplied by the source alpha.
     *
     * @type {number}
     */
    set blendType(arg) {
        this._blendType = arg;
        if (this.emitter) {
            this.emitter.blendType = arg;
            this.emitter.material.blendType = arg;
            this.emitter.resetMaterial();
            this.rebuild();
        }
    }

    /**
     * Gets how particles are blended when being written to the currently active render target.
     *
     * @type {number}
     */
    get blendType() {
        return this._blendType;
    }

    /**
     * Sets how much particles are stretched in their direction of motion. This is a value in world
     * units that controls the amount by which particles are stretched based on their velocity.
     * Particles are stretched from their center towards their previous position.
     *
     * @type {number}
     */
    set stretch(arg) {
        this._setComplexProperty('stretch', arg);
    }

    /**
     * Gets how much particles are stretched in their direction of motion.
     *
     * @type {number}
     */
    get stretch() {
        return this._stretch;
    }

    /**
     * Sets whether particles are oriented in their direction of motion or not.
     *
     * @type {boolean}
     */
    set alignToMotion(arg) {
        this._setComplexProperty('alignToMotion', arg);
    }

    /**
     * Gets whether particles are oriented in their direction of motion or not.
     *
     * @type {boolean}
     */
    get alignToMotion() {
        return this._alignToMotion;
    }

    /**
     * Sets the shape of the emitter. Defines the bounds inside which particles are spawned. Also
     * affects the direction of initial velocity.
     *
     * - {@link EMITTERSHAPE_BOX}: Box shape parameterized by emitterExtents. Initial velocity is
     * directed towards local Z axis.
     * - {@link EMITTERSHAPE_SPHERE}: Sphere shape parameterized by emitterRadius. Initial velocity is
     * directed outwards from the center.
     *
     * @type {number}
     */
    set emitterShape(arg) {
        this._setComplexProperty('emitterShape', arg);
    }

    /**
     * Gets the shape of the emitter.
     *
     * @type {number}
     */
    get emitterShape() {
        return this._emitterShape;
    }

    /**
     * Sets the extents of a local space bounding box within which particles are spawned at random
     * positions. This only applies to particle system with the shape `EMITTERSHAPE_BOX`.
     *
     * @type {Vec3}
     */
    set emitterExtents(arg) {
        this._setSimpleProperty('emitterExtents', arg);
    }

    /**
     * Gets the extents of a local space bounding box within which particles are spawned at random
     * positions.
     *
     * @type {Vec3}
     */
    get emitterExtents() {
        return this._emitterExtents;
    }

    /**
     * Sets the exception of extents of a local space bounding box within which particles are not
     * spawned. It is aligned to the center of emitterExtents. This only applies to particle system
     * with the shape `EMITTERSHAPE_BOX`.
     *
     * @type {Vec3}
     */
    set emitterExtentsInner(arg) {
        this._setSimpleProperty('emitterExtentsInner', arg);
    }

    /**
     * Gets the exception of extents of a local space bounding box within which particles are not
     * spawned.
     *
     * @type {Vec3}
     */
    get emitterExtentsInner() {
        return this._emitterExtentsInner;
    }

    /**
     * Sets the radius within which particles are spawned at random positions. This only applies to
     * particle system with the shape `EMITTERSHAPE_SPHERE`.
     *
     * @type {number}
     */
    set emitterRadius(arg) {
        this._setSimpleProperty('emitterRadius', arg);
    }

    /**
     * Gets the radius within which particles are spawned at random positions.
     *
     * @type {number}
     */
    get emitterRadius() {
        return this._emitterRadius;
    }

    /**
     * Sets the inner radius within which particles are not spawned. This only applies to particle
     * system with the shape `EMITTERSHAPE_SPHERE`.
     *
     * @type {number}
     */
    set emitterRadiusInner(arg) {
        this._setSimpleProperty('emitterRadiusInner', arg);
    }

    /**
     * Gets the inner radius within which particles are not spawned.
     *
     * @type {number}
     */
    get emitterRadiusInner() {
        return this._emitterRadiusInner;
    }

    /**
     * Sets the magnitude of the initial emitter velocity. Direction is given by emitter shape.
     *
     * @type {number}
     */
    set initialVelocity(arg) {
        this._setSimpleProperty('initialVelocity', arg);
    }

    /**
     * Gets the magnitude of the initial emitter velocity.
     *
     * @type {number}
     */
    get initialVelocity() {
        return this._initialVelocity;
    }

    /**
     * Sets whether particles wrap based on the set wrap bounds.
     *
     * @type {boolean}
     */
    set wrap(arg) {
        this._setComplexProperty('wrap', arg);
    }

    /**
     * Gets whether particles wrap based on the set wrap bounds.
     *
     * @type {boolean}
     */
    get wrap() {
        return this._wrap;
    }

    /**
     * Sets the wrap bounds of the particle system. This is half extents of a world space box
     * volume centered on the owner entity's position. If a particle crosses the boundary of one
     * side of the volume, it teleports to the opposite side.
     *
     * @type {Vec3}
     */
    set wrapBounds(arg) {
        this._setComplexProperty('wrapBounds', arg);
    }

    /**
     * Gets the wrap bounds of the particle system.
     *
     * @type {Vec3}
     */
    get wrapBounds() {
        return this._wrapBounds;
    }

    /**
     * Sets whether particles move with respect to the emitter's transform rather then world space.
     *
     * @type {boolean}
     */
    set localSpace(arg) {
        this._setComplexProperty('localSpace', arg);
    }

    /**
     * Gets whether particles move with respect to the emitter's transform rather then world space.
     *
     * @type {boolean}
     */
    get localSpace() {
        return this._localSpace;
    }

    /**
     * Sets whether particles are rendered in 2D screen space. This needs to be set when particle
     * system is part of hierarchy with {@link ScreenComponent} as its ancestor, and allows
     * particle system to integrate with the rendering of {@link ElementComponent}s. Note that an
     * entity with ParticleSystem component cannot be parented directly to {@link ScreenComponent},
     * but has to be a child of a {@link ElementComponent}, for example {@link LayoutGroupComponent}.
     *
     * @type {boolean}
     */
    set screenSpace(arg) {
        this._setComplexProperty('screenSpace', arg);
    }

    /**
     * Gets whether particles are rendered in 2D screen space.
     *
     * @type {boolean}
     */
    get screenSpace() {
        return this._screenSpace;
    }

    /**
     * Sets the {@link Asset} used to set the colorMap.
     *
     * @type {Asset|null}
     */
    set colorMapAsset(arg) {
        const assets = this.system.app.assets;

        if (this._colorMapAsset) {
            const asset = assets.get(this._colorMapAsset);
            if (asset) {
                this._unbindColorMapAsset(asset);
            }
        }

        if (arg instanceof Asset) {
            arg = arg.id;
        }
        this._colorMapAsset = arg;

        if (arg) {
            const asset = assets.get(arg);
            if (asset) {
                this._bindColorMapAsset(asset);
            } else {
                assets.once(`add:${arg}`, (asset) => {
                    this._bindColorMapAsset(asset);
                });
            }
        } else {
            this.colorMap = null;
        }
    }

    /**
     * Gets the {@link Asset} used to set the colorMap.
     *
     * @type {Asset|null}
     */
    get colorMapAsset() {
        return this._colorMapAsset;
    }

    /**
     * Sets the {@link Asset} used to set the normalMap.
     *
     * @type {Asset|null}
     */
    set normalMapAsset(arg) {
        const assets = this.system.app.assets;

        if (this._normalMapAsset) {
            const asset = assets.get(this._normalMapAsset);
            if (asset) {
                this._unbindNormalMapAsset(asset);
            }
        }

        if (arg instanceof Asset) {
            arg = arg.id;
        }
        this._normalMapAsset = arg;

        if (arg) {
            const asset = assets.get(arg);
            if (asset) {
                this._bindNormalMapAsset(asset);
            } else {
                assets.once(`add:${arg}`, (asset) => {
                    this._bindNormalMapAsset(asset);
                });
            }
        } else {
            this.normalMap = null;
        }
    }

    /**
     * Gets the {@link Asset} used to set the normalMap.
     *
     * @type {Asset|null}
     */
    get normalMapAsset() {
        return this._normalMapAsset;
    }

    /**
     * Sets the polygonal mesh to be used as a particle. Only first vertex/index buffer is used.
     * Vertex buffer must contain local position at first 3 floats of each vertex.
     *
     * @type {Mesh}
     */
    set mesh(arg) {
        // if the value being set is null, an asset or an asset id, then assume we are
        // setting the mesh asset, which will in turn update the mesh
        if (!arg || arg instanceof Asset || typeof arg === 'number') {
            this.meshAsset = arg;
        } else {
            this._onMeshChanged(arg);
        }
    }

    /**
     * Gets the polygonal mesh to be used as a particle.
     *
     * @type {Mesh}
     */
    get mesh() {
        return this._mesh;
    }

    /**
     * Sets the {@link Asset} used to set the mesh.
     *
     * @type {Asset|null}
     */
    set meshAsset(arg) {
        const assets = this.system.app.assets;

        if (this._meshAsset) {
            const asset = assets.get(this._meshAsset);
            if (asset) {
                this._unbindMeshAsset(asset);
            }
        }

        if (arg instanceof Asset) {
            arg = arg.id;
        }
        this._meshAsset = arg;

        if (arg) {
            const asset = assets.get(arg);
            if (asset) {
                this._bindMeshAsset(asset);
            }
        } else {
            this._onMeshChanged(null);
        }
    }

    /**
     * Gets the {@link Asset} used to set the mesh.
     *
     * @type {Asset|null}
     */
    get meshAsset() {
        return this._meshAsset;
    }

    /**
     * Sets the Render {@link Asset} used to set the mesh.
     *
     * @type {Asset|null}
     */
    set renderAsset(arg) {
        const assets = this.system.app.assets;

        if (this._renderAsset) {
            const asset = assets.get(this._renderAsset);
            if (asset) {
                this._unbindRenderAsset(asset);
            }
        }

        if (arg instanceof Asset) {
            arg = arg.id;
        }
        this._renderAsset = arg;

        if (arg) {
            const asset = assets.get(arg);
            if (asset) {
                this._bindRenderAsset(asset);
            }
        } else {
            this._onRenderChanged(null);
        }
    }

    /**
     * Gets the Render {@link Asset} used to set the mesh.
     *
     * @type {Asset|null}
     */
    get renderAsset() {
        return this._renderAsset;
    }

    /**
     * Sets the particle orientation mode. Can be:
     *
     * - {@link PARTICLEORIENTATION_SCREEN}: Particles are facing camera.
     * - {@link PARTICLEORIENTATION_WORLD}: User defined world space normal (particleNormal) to set
     * planes orientation.
     * - {@link PARTICLEORIENTATION_EMITTER}: Similar to previous, but the normal is affected by
     * emitter (entity) transformation.
     *
     * @type {number}
     */
    set orientation(arg) {
        this._setComplexProperty('orientation', arg);
    }

    /**
     * Gets the particle orientation mode.
     *
     * @type {number}
     */
    get orientation() {
        return this._orientation;
    }

    /**
     * Sets the particle normal. This only applies to particle system with the orientation modes
     * `PARTICLEORIENTATION_WORLD` and `PARTICLEORIENTATION_EMITTER`.
     *
     * @type {Vec3}
     */
    set particleNormal(arg) {
        this._setSimpleProperty('particleNormal', arg);
    }

    /**
     * Gets the particle normal.
     *
     * @type {Vec3}
     */
    get particleNormal() {
        return this._particleNormal;
    }

    /**
     * Sets the local space velocity graph.
     *
     * @type {CurveSet}
     */
    set localVelocityGraph(arg) {
        this._setGraphProperty('localVelocityGraph', arg);
    }

    /**
     * Gets the local space velocity graph.
     *
     * @type {CurveSet}
     */
    get localVelocityGraph() {
        return this._localVelocityGraph;
    }

    /**
     * Sets the second velocity graph. If not null, particles pick random values between
     * localVelocityGraph and localVelocityGraph2.
     *
     * @type {CurveSet}
     */
    set localVelocityGraph2(arg) {
        this._setGraphProperty('localVelocityGraph2', arg);
    }

    /**
     * Gets the second velocity graph.
     *
     * @type {CurveSet}
     */
    get localVelocityGraph2() {
        return this._localVelocityGraph2;
    }

    /**
     * Sets the world space velocity graph.
     *
     * @type {CurveSet}
     */
    set velocityGraph(arg) {
        this._setGraphProperty('velocityGraph', arg);
    }

    /**
     * Gets the world space velocity graph.
     *
     * @type {CurveSet}
     */
    get velocityGraph() {
        return this._velocityGraph;
    }

    /**
     * Sets the second world space velocity graph. If not null, particles pick random values
     * between velocityGraph and velocityGraph2.
     *
     * @type {CurveSet}
     */
    set velocityGraph2(arg) {
        this._setGraphProperty('velocityGraph2', arg);
    }

    /**
     * Gets the second world space velocity graph.
     *
     * @type {CurveSet}
     */
    get velocityGraph2() {
        return this._velocityGraph2;
    }

    /**
     * Sets the rotation speed graph.
     *
     * @type {Curve}
     */
    set rotationSpeedGraph(arg) {
        this._setGraphProperty('rotationSpeedGraph', arg);
    }

    /**
     * Gets the rotation speed graph.
     *
     * @type {Curve}
     */
    get rotationSpeedGraph() {
        return this._rotationSpeedGraph;
    }

    /**
     * Sets the second rotation speed graph. If not null, particles pick random values between
     * rotationSpeedGraph and rotationSpeedGraph2.
     *
     * @type {Curve}
     */
    set rotationSpeedGraph2(arg) {
        this._setGraphProperty('rotationSpeedGraph2', arg);
    }

    /**
     * Gets the second rotation speed graph.
     *
     * @type {Curve}
     */
    get rotationSpeedGraph2() {
        return this._rotationSpeedGraph2;
    }

    /**
     * Sets the radial speed graph. Velocity vector points from emitter origin to particle position.
     *
     * @type {Curve}
     */
    set radialSpeedGraph(arg) {
        this._setGraphProperty('radialSpeedGraph', arg);
    }

    /**
     * Gets the radial speed graph.
     *
     * @type {Curve}
     */
    get radialSpeedGraph() {
        return this._radialSpeedGraph;
    }

    /**
     * Sets the second radial speed graph. If not null, particles pick random values between
     * radialSpeedGraph and radialSpeedGraph2. Velocity vector points from emitter origin to
     * particle position.
     *
     * @type {Curve}
     */
    set radialSpeedGraph2(arg) {
        this._setGraphProperty('radialSpeedGraph2', arg);
    }

    /**
     * Gets the second radial speed graph.
     *
     * @type {Curve}
     */
    get radialSpeedGraph2() {
        return this._radialSpeedGraph2;
    }

    /**
     * Sets the scale graph.
     *
     * @type {Curve}
     */
    set scaleGraph(arg) {
        this._setGraphProperty('scaleGraph', arg);
    }

    /**
     * Gets the scale graph.
     *
     * @type {Curve}
     */
    get scaleGraph() {
        return this._scaleGraph;
    }

    /**
     * Sets the second scale graph. If not null, particles pick random values between `scaleGraph`
     * and `scaleGraph2`.
     *
     * @type {Curve}
     */
    set scaleGraph2(arg) {
        this._setGraphProperty('scaleGraph2', arg);
    }

    /**
     * Gets the second scale graph.
     *
     * @type {Curve}
     */
    get scaleGraph2() {
        return this._scaleGraph2;
    }

    /**
     * Sets the color graph.
     *
     * @type {CurveSet}
     */
    set colorGraph(arg) {
        this._setGraphProperty('colorGraph', arg);
    }

    /**
     * Gets the color graph.
     *
     * @type {CurveSet}
     */
    get colorGraph() {
        return this._colorGraph;
    }

    /**
     * Sets the second color graph. If not null, particles pick random values between `colorGraph`
     * and `colorGraph2`.
     *
     * @type {CurveSet}
     */
    set colorGraph2(arg) {
        this._setGraphProperty('colorGraph2', arg);
    }

    /**
     * Gets the second color graph.
     *
     * @type {CurveSet}
     */
    get colorGraph2() {
        return this._colorGraph2;
    }

    /**
     * Sets the alpha graph.
     *
     * @type {Curve}
     */
    set alphaGraph(arg) {
        this._setGraphProperty('alphaGraph', arg);
    }

    /**
     * Gets the alpha graph.
     *
     * @type {Curve}
     */
    get alphaGraph() {
        return this._alphaGraph;
    }

    /**
     * Sets the second alpha graph. If not null, particles pick random values between `alphaGraph`
     * and `alphaGraph2`.
     *
     * @type {Curve}
     */
    set alphaGraph2(arg) {
        this._setGraphProperty('alphaGraph2', arg);
    }

    /**
     * Gets the second alpha graph.
     *
     * @type {Curve}
     */
    get alphaGraph2() {
        return this._alphaGraph2;
    }

    /**
     * Sets the color map texture to apply to all particles in the system. If no texture is
     * assigned, a default spot texture is used.
     *
     * @type {Texture}
     */
    set colorMap(arg) {
        this._setComplexProperty('colorMap', arg);
    }

    /**
     * Gets the color map texture to apply to all particles in the system.
     *
     * @type {Texture}
     */
    get colorMap() {
        return this._colorMap;
    }

    /**
     * Sets the normal map texture to apply to all particles in the system. If no texture is
     * assigned, an approximate spherical normal is calculated for each vertex.
     *
     * @type {Texture}
     */
    set normalMap(arg) {
        this._setSimpleProperty('normalMap', arg);
    }

    /**
     * Gets the normal map texture to apply to all particles in the system.
     *
     * @type {Texture}
     */
    get normalMap() {
        return this._normalMap;
    }

    /**
     * Sets the number of horizontal tiles in the sprite sheet.
     *
     * @type {number}
     */
    set animTilesX(arg) {
        this._setComplexProperty('animTilesX', arg);
    }

    /**
     * Gets the number of horizontal tiles in the sprite sheet.
     *
     * @type {number}
     */
    get animTilesX() {
        return this._animTilesX;
    }

    /**
     * Sets the number of vertical tiles in the sprite sheet.
     *
     * @type {number}
     */
    set animTilesY(arg) {
        this._setComplexProperty('animTilesY', arg);
    }

    /**
     * Gets the number of vertical tiles in the sprite sheet.
     *
     * @type {number}
     */
    get animTilesY() {
        return this._animTilesY;
    }

    /**
     * Sets the sprite sheet frame that the animation should begin playing from. Indexed from the
     * start of the current animation.
     *
     * @type {number}
     */
    set animStartFrame(arg) {
        this._setComplexProperty('animStartFrame', arg);
    }

    /**
     * Gets the sprite sheet frame that the animation should begin playing from.
     *
     * @type {number}
     */
    get animStartFrame() {
        return this._animStartFrame;
    }

    /**
     * Sets the number of sprite sheet frames in the current sprite sheet animation. The number of
     * animations multiplied by number of frames should be a value less than `animTilesX`
     * multiplied by `animTilesY`.
     *
     * @type {number}
     */
    set animNumFrames(arg) {
        this._setComplexProperty('animNumFrames', arg);
    }

    /**
     * Gets the number of sprite sheet frames in the current sprite sheet animation.
     *
     * @type {number}
     */
    get animNumFrames() {
        return this._animNumFrames;
    }

    /**
     * Sets the number of sprite sheet animations contained within the current sprite sheet. The
     * number of animations multiplied by number of frames should be a value less than `animTilesX`
     * multiplied by `animTilesY`.
     *
     * @type {number}
     */
    set animNumAnimations(arg) {
        this._setComplexProperty('animNumAnimations', arg);
    }

    /**
     * Gets the number of sprite sheet animations contained within the current sprite sheet.
     *
     * @type {number}
     */
    get animNumAnimations() {
        return this._animNumAnimations;
    }

    /**
     * Sets the index of the animation to play. When `animNumAnimations` is greater than 1, the
     * sprite sheet animation index determines which animation the particle system should play.
     *
     * @type {number}
     */
    set animIndex(arg) {
        this._setComplexProperty('animIndex', arg);
    }

    /**
     * Gets the index of the animation to play.
     *
     * @type {number}
     */
    get animIndex() {
        return this._animIndex;
    }

    /**
     * Sets whether each particle emitted by the system will play a random animation from the
     * sprite sheet, up to `animNumAnimations`.
     *
     * @type {boolean}
     */
    set randomizeAnimIndex(arg) {
        this._setComplexProperty('randomizeAnimIndex', arg);
    }

    /**
     * Gets whether each particle emitted by the system will play a random animation from the
     * sprite sheet, up to `animNumAnimations`.
     *
     * @type {boolean}
     */
    get randomizeAnimIndex() {
        return this._randomizeAnimIndex;
    }

    /**
     * Sets the sprite sheet animation speed. 1 = particle lifetime, 2 = double the particle
     * lifetime, etc.
     *
     * @type {number}
     */
    set animSpeed(arg) {
        this._setSimpleProperty('animSpeed', arg);
    }

    /**
     * Gets the sprite sheet animation speed.
     *
     * @type {number}
     */
    get animSpeed() {
        return this._animSpeed;
    }

    /**
     * Sets whether the sprite sheet animation plays once or loops continuously.
     *
     * @type {boolean}
     */
    set animLoop(arg) {
        this._setComplexProperty('animLoop', arg);
    }

    /**
     * Gets whether the sprite sheet animation plays once or loops continuously.
     *
     * @type {boolean}
     */
    get animLoop() {
        return this._animLoop;
    }

    /**
     * Sets the array of layer IDs ({@link Layer#id}) to which this particle system should belong.
     * Don't push/pop/splice or modify this array. If you want to change it, set a new one instead.
     *
     * @type {number[]}
     */
    set layers(arg) {
        const oldLayers = this._layers;
        this._layers = arg;

        if (!this.emitter) return;
        for (let i = 0; i < oldLayers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(oldLayers[i]);
            if (!layer) continue;
            layer.removeMeshInstances([this.emitter.meshInstance]);
        }
        if (!this.enabled || !this.entity.enabled) return;
        for (let i = 0; i < arg.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(arg[i]);
            if (!layer) continue;
            layer.addMeshInstances([this.emitter.meshInstance]);
        }
    }

    /**
     * Gets the array of layer IDs ({@link Layer#id}) to which this particle system belongs.
     *
     * @type {ReadonlyArray<number>}
     */
    get layers() {
        return this._layers;
    }

    /**
     * Sets the draw order of the component. A higher value means that the component will be
     * rendered on top of other components in the same layer. This is not used unless the layer's
     * sort order is set to {@link SORTMODE_MANUAL}.
     *
     * @type {number}
     */
    set drawOrder(drawOrder) {
        this._drawOrder = drawOrder;
        if (this.emitter) {
            this.emitter.drawOrder = drawOrder;
        }
    }

    /**
     * Gets the draw order of the component.
     *
     * @type {number}
     */
    get drawOrder() {
        return this._drawOrder;
    }

    /**
     * Sets a property that only requires the emitter material to be updated.
     *
     * @param {string} name - The name of the property to set.
     * @param {*} arg - The new value of the property.
     * @private
     */
    _setSimpleProperty(name, arg) {
        this[`_${name}`] = arg;
        if (this.emitter) {
            this.emitter[name] = arg;
            this.emitter.resetMaterial();
        }
    }

    /**
     * Sets a property that requires the particle system to be rebuilt.
     *
     * @param {string} name - The name of the property to set.
     * @param {*} arg - The new value of the property.
     * @private
     */
    _setComplexProperty(name, arg) {
        this[`_${name}`] = arg;
        if (this.emitter) {
            this.emitter[name] = arg;
            this.emitter.resetMaterial();
            this.rebuild();
            this.reset();
        }
    }

    /**
     * Sets a curve property that requires the emitter graphs to be rebuilt.
     *
     * @param {string} name - The name of the property to set.
     * @param {*} arg - The new value of the property.
     * @private
     */
    _setGraphProperty(name, arg) {
        this[`_${name}`] = arg;
        if (this.emitter) {
            this.emitter[name] = arg;
            this.emitter.rebuildGraphs();
            this.emitter.resetMaterial();
        }
    }

    addMeshInstanceToLayers() {
        if (!this.emitter) return;
        for (let i = 0; i < this._layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
            if (!layer) continue;
            layer.addMeshInstances([this.emitter.meshInstance]);
            this.emitter._layer = layer;
        }
    }

    removeMeshInstanceFromLayers() {
        if (!this.emitter) return;
        for (let i = 0; i < this._layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
            if (!layer) continue;
            layer.removeMeshInstances([this.emitter.meshInstance]);
        }
    }

    onLayersChanged(oldComp, newComp) {
        this.addMeshInstanceToLayers();
        oldComp.off('add', this.onLayerAdded, this);
        oldComp.off('remove', this.onLayerRemoved, this);
        newComp.on('add', this.onLayerAdded, this);
        newComp.on('remove', this.onLayerRemoved, this);
    }

    onLayerAdded(layer) {
        if (!this.emitter) return;
        const index = this._layers.indexOf(layer.id);
        if (index < 0) return;
        layer.addMeshInstances([this.emitter.meshInstance]);
    }

    onLayerRemoved(layer) {
        if (!this.emitter) return;
        const index = this._layers.indexOf(layer.id);
        if (index < 0) return;
        layer.removeMeshInstances([this.emitter.meshInstance]);
    }

    _bindColorMapAsset(asset) {
        asset.on('load', this._onColorMapAssetLoad, this);
        asset.on('unload', this._onColorMapAssetUnload, this);
        asset.on('remove', this._onColorMapAssetRemove, this);
        asset.on('change', this._onColorMapAssetChange, this);

        if (asset.resource) {
            this._onColorMapAssetLoad(asset);
        } else {
            // don't trigger an asset load unless the component is enabled
            if (!this.enabled || !this.entity.enabled) return;
            this.system.app.assets.load(asset);
        }
    }

    _unbindColorMapAsset(asset) {
        asset.off('load', this._onColorMapAssetLoad, this);
        asset.off('unload', this._onColorMapAssetUnload, this);
        asset.off('remove', this._onColorMapAssetRemove, this);
        asset.off('change', this._onColorMapAssetChange, this);
    }

    _onColorMapAssetLoad(asset) {
        this.colorMap = asset.resource;
    }

    _onColorMapAssetUnload(asset) {
        this.colorMap = null;
    }

    _onColorMapAssetRemove(asset) {
        this._onColorMapAssetUnload(asset);
    }

    _onColorMapAssetChange(asset) {}

    _bindNormalMapAsset(asset) {
        asset.on('load', this._onNormalMapAssetLoad, this);
        asset.on('unload', this._onNormalMapAssetUnload, this);
        asset.on('remove', this._onNormalMapAssetRemove, this);
        asset.on('change', this._onNormalMapAssetChange, this);

        if (asset.resource) {
            this._onNormalMapAssetLoad(asset);
        } else {
            // don't trigger an asset load unless the component is enabled
            if (!this.enabled || !this.entity.enabled) return;
            this.system.app.assets.load(asset);
        }
    }

    _unbindNormalMapAsset(asset) {
        asset.off('load', this._onNormalMapAssetLoad, this);
        asset.off('unload', this._onNormalMapAssetUnload, this);
        asset.off('remove', this._onNormalMapAssetRemove, this);
        asset.off('change', this._onNormalMapAssetChange, this);
    }

    _onNormalMapAssetLoad(asset) {
        this.normalMap = asset.resource;
    }

    _onNormalMapAssetUnload(asset) {
        this.normalMap = null;
    }

    _onNormalMapAssetRemove(asset) {
        this._onNormalMapAssetUnload(asset);
    }

    _onNormalMapAssetChange(asset) {}

    _bindMeshAsset(asset) {
        asset.on('load', this._onMeshAssetLoad, this);
        asset.on('unload', this._onMeshAssetUnload, this);
        asset.on('remove', this._onMeshAssetRemove, this);
        asset.on('change', this._onMeshAssetChange, this);

        if (asset.resource) {
            this._onMeshAssetLoad(asset);
        } else {
            // don't trigger an asset load unless the component is enabled
            if (!this.enabled || !this.entity.enabled) return;
            this.system.app.assets.load(asset);
        }
    }

    _unbindMeshAsset(asset) {
        asset.off('load', this._onMeshAssetLoad, this);
        asset.off('unload', this._onMeshAssetUnload, this);
        asset.off('remove', this._onMeshAssetRemove, this);
        asset.off('change', this._onMeshAssetChange, this);
    }

    _onMeshAssetLoad(asset) {
        this._onMeshChanged(asset.resource);
    }

    _onMeshAssetUnload(asset) {
        this.mesh = null;
    }

    _onMeshAssetRemove(asset) {
        this._onMeshAssetUnload(asset);
    }

    _onMeshAssetChange(asset) {}

    _onMeshChanged(mesh) {
        if (mesh && !(mesh instanceof Mesh)) {
            // if mesh is a pc.Model, use the first meshInstance
            if (mesh.meshInstances[0]) {
                mesh = mesh.meshInstances[0].mesh;
            } else {
                mesh = null;
            }
        }

        this._mesh = mesh;

        if (this.emitter) {
            this.emitter.mesh = mesh;
            this.emitter.resetMaterial();
            this.rebuild();
        }
    }

    _bindRenderAsset(asset) {
        asset.on('load', this._onRenderAssetLoad, this);
        asset.on('unload', this._onRenderAssetUnload, this);
        asset.on('remove', this._onRenderAssetRemove, this);

        if (asset.resource) {
            this._onRenderAssetLoad(asset);
        } else {
            // don't trigger an asset load unless the component is enabled
            if (!this.enabled || !this.entity.enabled) return;
            this.system.app.assets.load(asset);
        }
    }

    _unbindRenderAsset(asset) {
        asset.off('load', this._onRenderAssetLoad, this);
        asset.off('unload', this._onRenderAssetUnload, this);
        asset.off('remove', this._onRenderAssetRemove, this);

        this._evtSetMeshes?.off();
        this._evtSetMeshes = null;
    }

    _onRenderAssetLoad(asset) {
        this._onRenderChanged(asset.resource);
    }

    _onRenderAssetUnload(asset) {
        this._onRenderChanged(null);
    }

    _onRenderAssetRemove(asset) {
        this._onRenderAssetUnload(asset);
    }

    _onRenderChanged(render) {
        if (!render) {
            this._onMeshChanged(null);
            return;
        }

        this._evtSetMeshes?.off();
        this._evtSetMeshes = render.on('set:meshes', this._onRenderSetMeshes, this);

        if (render.meshes) {
            this._onRenderSetMeshes(render.meshes);
        }
    }

    _onRenderSetMeshes(meshes) {
        this._onMeshChanged(meshes && meshes[0]);
    }

    _requestDepth() {
        if (this._requestedDepth) return;
        if (!depthLayer) depthLayer = this.system.app.scene.layers.getLayerById(LAYERID_DEPTH);
        if (depthLayer) {
            depthLayer.incrementCounter();
            this._requestedDepth = true;
        }
    }

    _releaseDepth() {
        if (!this._requestedDepth) return;
        if (depthLayer) {
            depthLayer.decrementCounter();
            this._requestedDepth = false;
        }
    }

    onEnable() {
        const scene = this.system.app.scene;
        const layers = scene.layers;

        // load any assets that haven't been loaded yet
        for (let i = 0, len = ASSET_PROPERTIES.length; i < len; i++) {
            let asset = this[`_${ASSET_PROPERTIES[i]}`];
            if (asset) {
                if (!(asset instanceof Asset)) {
                    const id = parseInt(asset, 10);
                    if (id >= 0) {
                        asset = this.system.app.assets.get(asset);
                    } else {
                        continue;
                    }
                }

                if (asset && !asset.resource) {
                    this.system.app.assets.load(asset);
                }
            }
        }

        // WebGPU does not support particle systems, ignore them
        if (this.system.app.graphicsDevice.disableParticleSystem) {
            return;
        }

        if (!this.emitter) {
            this.emitter = new ParticleEmitter(this.system.app.graphicsDevice, {
                numParticles: this._numParticles,
                emitterExtents: this._emitterExtents,
                emitterExtentsInner: this._emitterExtentsInner,
                emitterRadius: this._emitterRadius,
                emitterRadiusInner: this._emitterRadiusInner,
                emitterShape: this._emitterShape,
                initialVelocity: this._initialVelocity,
                wrap: this._wrap,
                localSpace: this._localSpace,
                screenSpace: this._screenSpace,
                wrapBounds: this._wrapBounds,
                lifetime: this._lifetime,
                rate: this._rate,
                rate2: this._rate2,

                orientation: this._orientation,
                particleNormal: this._particleNormal,

                animTilesX: this._animTilesX,
                animTilesY: this._animTilesY,
                animStartFrame: this._animStartFrame,
                animNumFrames: this._animNumFrames,
                animNumAnimations: this._animNumAnimations,
                animIndex: this._animIndex,
                randomizeAnimIndex: this._randomizeAnimIndex,
                animSpeed: this._animSpeed,
                animLoop: this._animLoop,

                startAngle: this._startAngle,
                startAngle2: this._startAngle2,

                scaleGraph: this._scaleGraph,
                scaleGraph2: this._scaleGraph2,

                colorGraph: this._colorGraph,
                colorGraph2: this._colorGraph2,

                alphaGraph: this._alphaGraph,
                alphaGraph2: this._alphaGraph2,

                localVelocityGraph: this._localVelocityGraph,
                localVelocityGraph2: this._localVelocityGraph2,

                velocityGraph: this._velocityGraph,
                velocityGraph2: this._velocityGraph2,

                rotationSpeedGraph: this._rotationSpeedGraph,
                rotationSpeedGraph2: this._rotationSpeedGraph2,

                radialSpeedGraph: this._radialSpeedGraph,
                radialSpeedGraph2: this._radialSpeedGraph2,

                colorMap: this._colorMap,
                normalMap: this._normalMap,
                loop: this._loop,
                preWarm: this._preWarm,
                sort: this._sort,
                stretch: this._stretch,
                alignToMotion: this._alignToMotion,
                lighting: this._lighting,
                halfLambert: this._halfLambert,
                intensity: this._intensity,
                depthSoftening: this._depthSoftening,
                scene: this.system.app.scene,
                mesh: this._mesh,
                depthWrite: this._depthWrite,
                noFog: this._noFog,
                node: this.entity,
                blendType: this._blendType
            });

            this.emitter.meshInstance.node = this.entity;
            this.emitter.drawOrder = this._drawOrder;

            if (!this._autoPlay) {
                this.pause();
                this.emitter.meshInstance.visible = false;
            }
        }

        if (this.emitter.colorMap) {
            this.addMeshInstanceToLayers();
        }

        this._evtLayersChanged = scene.on('set:layers', this.onLayersChanged, this);

        if (layers) {
            this._evtLayerAdded = layers.on('add', this.onLayerAdded, this);
            this._evtLayerRemoved = layers.on('remove', this.onLayerRemoved, this);
        }

        if (this.enabled && this.entity.enabled && this._depthSoftening) {
            this._requestDepth();
        }
    }

    onDisable() {
        const scene = this.system.app.scene;
        const layers = scene.layers;

        this._evtLayersChanged?.off();
        this._evtLayersChanged = null;

        if (layers) {
            this._evtLayerAdded?.off();
            this._evtLayerAdded = null;
            this._evtLayerRemoved?.off();
            this._evtLayerRemoved = null;
        }

        if (this.emitter) {
            this.removeMeshInstanceFromLayers();
            if (this._depthSoftening) this._releaseDepth();

            // clear camera as it isn't updated while disabled and we don't want to hold
            // onto old reference
            this.emitter.camera = null;
        }
    }

    onBeforeRemove() {
        if (this.enabled) {
            this.enabled = false;
        }

        if (this.emitter) {
            this.emitter.destroy();
            this.emitter = null;
        }

        // clear all asset properties to remove any event listeners
        for (let i = 0; i < ASSET_PROPERTIES.length; i++) {
            const prop = ASSET_PROPERTIES[i];

            if (this[`_${prop}`]) {
                this[prop] = null;
            }
        }

        this.off();
    }

    /**
     * Resets particle state, doesn't affect playing.
     */
    reset() {
        if (this.emitter) {
            this.emitter.reset();
        }
    }

    /**
     * Disables the emission of new particles, lets existing to finish their simulation.
     */
    stop() {
        if (this.emitter) {
            this.emitter.loop = false;
            this.emitter.resetTime(this.emitter.lifetime);
            this.emitter.addTime(0, true);
        }
    }

    /**
     * Freezes the simulation.
     */
    pause() {
        this._paused = true;
    }

    /**
     * Unfreezes the simulation.
     */
    unpause() {
        this._paused = false;
    }

    /**
     * Enables/unfreezes the simulation.
     */
    play() {
        this._paused = false;
        if (this.emitter) {
            this.emitter.meshInstance.visible = true;
            this.emitter.loop = this._loop;
            this.emitter.resetTime();
        }
    }

    /**
     * Checks if simulation is in progress.
     *
     * @returns {boolean} True if the particle system is currently playing and false otherwise.
     */
    isPlaying() {
        if (this._paused || !this.emitter) {
            return false;
        }
        if (this.emitter.loop) {
            return true;
        }

        return this.emitter.simTimeTotal <= this.emitter.endTime;
    }

    /**
     * Called by the Editor when the component is selected, to allow custom in Editor behavior.
     *
     * @private
     */
    setInTools() {
        const { emitter } = this;
        if (emitter && !emitter.inTools) {
            emitter.inTools = true;
            this.rebuild();
        }
    }

    /**
     * Rebuilds all data used by this particle system.
     *
     * @private
     */
    rebuild() {
        const enabled = this.enabled;
        this.enabled = false;
        if (this.emitter) {
            this.emitter.rebuild(); // worst case: required to rebuild buffers/shaders
        }
        this.enabled = enabled;
    }
}

export { _properties, ParticleSystemComponent };
