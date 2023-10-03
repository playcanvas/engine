import { LAYERID_DEPTH } from '../../../scene/constants.js';
import { Mesh } from '../../../scene/mesh.js';
import { ParticleEmitter } from '../../../scene/particle-system/particle-emitter.js';

import { Asset } from '../../asset/asset.js';

import { Component } from '../component.js';

// properties that do not need rebuilding the particle system
const SIMPLE_PROPERTIES = [
    'emitterExtents',
    'emitterRadius',
    'emitterExtentsInner',
    'emitterRadiusInner',
    'loop',
    'initialVelocity',
    'animSpeed',
    'normalMap',
    'particleNormal'
];

// properties that need rebuilding the particle system
const COMPLEX_PROPERTIES = [
    'numParticles',
    'lifetime',
    'rate',
    'rate2',
    'startAngle',
    'startAngle2',
    'lighting',
    'halfLambert',
    'intensity',
    'wrap',
    'wrapBounds',
    'depthWrite',
    'noFog',
    'sort',
    'stretch',
    'alignToMotion',
    'preWarm',
    'emitterShape',
    'animTilesX',
    'animTilesY',
    'animStartFrame',
    'animNumFrames',
    'animNumAnimations',
    'animIndex',
    'randomizeAnimIndex',
    'animLoop',
    'colorMap',
    'localSpace',
    'screenSpace',
    'orientation'
];

const GRAPH_PROPERTIES = [
    'scaleGraph',
    'scaleGraph2',

    'colorGraph',
    'colorGraph2',

    'alphaGraph',
    'alphaGraph2',

    'velocityGraph',
    'velocityGraph2',

    'localVelocityGraph',
    'localVelocityGraph2',

    'rotationSpeedGraph',
    'rotationSpeedGraph2',

    'radialSpeedGraph',
    'radialSpeedGraph2'
];

const ASSET_PROPERTIES = [
    'colorMapAsset',
    'normalMapAsset',
    'meshAsset',
    'renderAsset'
];

let depthLayer;

/**
 * Used to simulate particles and produce renderable particle mesh on either CPU or GPU. GPU
 * simulation is generally much faster than its CPU counterpart, because it avoids slow CPU-GPU
 * synchronization and takes advantage of many GPU cores. However, it requires client to support
 * reasonable uniform count, reading from multiple textures in vertex shader and OES_texture_float
 * extension, including rendering into float textures. Most mobile devices fail to satisfy these
 * requirements, so it's not recommended to simulate thousands of particles on them. GPU version
 * also can't sort particles, so enabling sorting forces CPU mode too. Particle rotation is
 * specified by a single angle parameter: default billboard particles rotate around camera facing
 * axis, while mesh particles rotate around 2 different view-independent axes. Most of the
 * simulation parameters are specified with {@link Curve} or {@link CurveSet}. Curves are
 * interpolated based on each particle's lifetime, therefore parameters are able to change over
 * time. Most of the curve parameters can also be specified by 2 minimum/maximum curves, this way
 * each particle will pick a random value in-between.
 *
 * @property {boolean} autoPlay Controls whether the particle system plays automatically on
 * creation. If set to false, it is necessary to call {@link ParticleSystemComponent#play} for the
 * particle system to play. Defaults to true.
 * @property {boolean} loop Enables or disables respawning of particles.
 * @property {boolean} preWarm If enabled, the particle system will be initialized as though it had
 * already completed a full cycle. This only works with looping particle systems.
 * @property {boolean} lighting If enabled, particles will be lit by ambient and directional
 * lights.
 * @property {boolean} halfLambert Enabling Half Lambert lighting avoids particles looking too flat
 * in shadowed areas. It is a completely non-physical lighting model but can give more pleasing
 * visual results.
 * @property {boolean} alignToMotion Orient particles in their direction of motion.
 * @property {boolean} depthWrite If enabled, the particles will write to the depth buffer. If
 * disabled, the depth buffer is left unchanged and particles will be guaranteed to overwrite one
 * another in the order in which they are rendered.
 * @property {boolean} noFog Disable fogging.
 * @property {boolean} localSpace Binds particles to emitter transformation rather then world
 * space.
 * @property {boolean} screenSpace Renders particles in 2D screen space. This needs to be set when
 * particle system is part of hierarchy with {@link ScreenComponent} as its ancestor, and allows
 * particle system to integrate with the rendering of {@link ElementComponent}s. Note that an
 * entity with ParticleSystem component cannot be parented directly to {@link ScreenComponent}, but
 * has to be a child of a {@link ElementComponent}, for example {@link LayoutGroupComponent}.
 * @property {number} numParticles Maximum number of simulated particles.
 * @property {number} rate Minimal interval in seconds between particle births.
 * @property {number} rate2 Maximal interval in seconds between particle births.
 * @property {number} startAngle Minimal initial Euler angle of a particle.
 * @property {number} startAngle2 Maximal initial Euler angle of a particle.
 * @property {number} lifetime The length of time in seconds between a particle's birth and its
 * death.
 * @property {number} stretch A value in world units that controls the amount by which particles
 * are stretched based on their velocity. Particles are stretched from their center towards their
 * previous position.
 * @property {number} intensity Color multiplier.
 * @property {boolean} animLoop Controls whether the sprite sheet animation plays once or loops
 * continuously.
 * @property {number} animTilesX Number of horizontal tiles in the sprite sheet.
 * @property {number} animTilesY Number of vertical tiles in the sprite sheet.
 * @property {number} animNumAnimations Number of sprite sheet animations contained within the
 * current sprite sheet. The number of animations multiplied by number of frames should be a value
 * less than animTilesX multiplied by animTilesY.
 * @property {number} animNumFrames Number of sprite sheet frames in the current sprite sheet
 * animation. The number of animations multiplied by number of frames should be a value less than
 * animTilesX multiplied by animTilesY.
 * @property {number} animStartFrame The sprite sheet frame that the animation should begin playing
 * from. Indexed from the start of the current animation.
 * @property {number} animIndex When animNumAnimations is greater than 1, the sprite sheet
 * animation index determines which animation the particle system should play.
 * @property {number} randomizeAnimIndex Each particle emitted by the system will play a random
 * animation from the sprite sheet, up to animNumAnimations.
 * @property {number} animSpeed Sprite sheet animation speed. 1 = particle lifetime, 2 = twice
 * during lifetime etc...
 * @property {number} depthSoftening Controls fading of particles near their intersections with
 * scene geometry. This effect, when it's non-zero, requires scene depth map to be rendered.
 * Multiple depth-dependent effects can share the same map, but if you only use it for particles,
 * bear in mind that it can double engine draw calls.
 * @property {number} initialVelocity Defines magnitude of the initial emitter velocity. Direction
 * is given by emitter shape.
 * @property {import('../../../core/math/vec3.js').Vec3} emitterExtents (Only for EMITTERSHAPE_BOX)
 * The extents of a local space bounding box within which particles are spawned at random positions.
 * @property {import('../../../core/math/vec3.js').Vec3} emitterExtentsInner (Only for
 * EMITTERSHAPE_BOX) The exception of extents of a local space bounding box within which particles
 * are not spawned. Aligned to the center of EmitterExtents.
 * @property {number} emitterRadius (Only for EMITTERSHAPE_SPHERE) The radius within which
 * particles are spawned at random positions.
 * @property {number} emitterRadiusInner (Only for EMITTERSHAPE_SPHERE) The inner radius within
 * which particles are not spawned.
 * @property {import('../../../core/math/vec3.js').Vec3} wrapBounds The half extents of a world
 * space box volume centered on the owner entity's position. If a particle crosses the boundary of
 * one side of the volume, it teleports to the opposite side.
 * @property {Asset} colorMapAsset The {@link Asset} used to set the colorMap.
 * @property {Asset} normalMapAsset The {@link Asset} used to set the normalMap.
 * @property {Asset} meshAsset The {@link Asset} used to set the mesh.
 * @property {Asset} renderAsset The Render {@link Asset} used to set the mesh.
 * @property {Texture} colorMap The color map texture to apply to all particles in the system. If
 * no texture is assigned, a default spot texture is used.
 * @property {Texture} normalMap The normal map texture to apply to all particles in the system. If
 * no texture is assigned, an approximate spherical normal is calculated for each vertex.
 * @property {number} emitterShape Shape of the emitter. Defines the bounds inside which particles
 * are spawned. Also affects the direction of initial velocity.
 *
 * - {@link EMITTERSHAPE_BOX}: Box shape parameterized by emitterExtents. Initial velocity is
 * directed towards local Z axis.
 * - {@link EMITTERSHAPE_SPHERE}: Sphere shape parameterized by emitterRadius. Initial velocity is
 * directed outwards from the center.
 *
 * @property {number} sort Sorting mode. Forces CPU simulation, so be careful.
 *
 * - {@link PARTICLESORT_NONE}: No sorting, particles are drawn in arbitrary order. Can be
 * simulated on GPU.
 * - {@link PARTICLESORT_DISTANCE}: Sorting based on distance to the camera. CPU only.
 * - {@link PARTICLESORT_NEWER_FIRST}: Newer particles are drawn first. CPU only.
 * - {@link PARTICLESORT_OLDER_FIRST}: Older particles are drawn first. CPU only.
 *
 * @property {Mesh} mesh Triangular mesh to be used as a particle. Only first vertex/index buffer
 * is used. Vertex buffer must contain local position at first 3 floats of each vertex.
 * @property {number} blendType Controls how particles are blended when being written to the currently
 * active render target. Can be:
 *
 * - {@link BLEND_SUBTRACTIVE}: Subtract the color of the source fragment from the destination
 * fragment and write the result to the frame buffer.
 * - {@link BLEND_ADDITIVE}: Add the color of the source fragment to the destination fragment and
 * write the result to the frame buffer.
 * - {@link BLEND_NORMAL}: Enable simple translucency for materials such as glass. This is
 * equivalent to enabling a source blend mode of {@link BLENDMODE_SRC_ALPHA} and a destination
 * blend mode of {@link BLENDMODE_ONE_MINUS_SRC_ALPHA}.
 * - {@link BLEND_NONE}: Disable blending.
 * - {@link BLEND_PREMULTIPLIED}: Similar to {@link BLEND_NORMAL} expect the source fragment is
 * assumed to have already been multiplied by the source alpha value.
 * - {@link BLEND_MULTIPLICATIVE}: Multiply the color of the source fragment by the color of the
 * destination fragment and write the result to the frame buffer.
 * - {@link BLEND_ADDITIVEALPHA}: Same as {@link BLEND_ADDITIVE} except the source RGB is
 * multiplied by the source alpha.
 *
 * @property {number} orientation Sorting mode. Forces CPU simulation, so be careful.
 *
 * - {@link PARTICLEORIENTATION_SCREEN}: Particles are facing camera.
 * - {@link PARTICLEORIENTATION_WORLD}: User defines world space normal (particleNormal) to set
 * planes orientation.
 * - {@link PARTICLEORIENTATION_EMITTER}: Similar to previous, but the normal is affected by
 * emitter (entity) transformation.
 *
 * @property {import('../../../core/math/vec3.js').Vec3} particleNormal (Only for
 * PARTICLEORIENTATION_WORLD and PARTICLEORIENTATION_EMITTER) The exception of extents of a local
 * space bounding box within which particles are not spawned. Aligned to the center of
 * EmitterExtents.
 * @property {import('../../../core/math/curve-set.js').CurveSet} localVelocityGraph Velocity
 * relative to emitter over lifetime.
 * @property {import('../../../core/math/curve-set.js').CurveSet} localVelocityGraph2 If not null,
 * particles pick random values between localVelocityGraph and localVelocityGraph2.
 * @property {import('../../../core/math/curve-set.js').CurveSet} velocityGraph World-space
 * velocity over lifetime.
 * @property {import('../../../core/math/curve-set.js').CurveSet} velocityGraph2 If not null,
 * particles pick random values between velocityGraph and velocityGraph2.
 * @property {import('../../../core/math/curve-set.js').CurveSet} colorGraph Color over lifetime.
 * @property {import('../../../core/math/curve.js').Curve} rotationSpeedGraph Rotation speed over
 * lifetime.
 * @property {import('../../../core/math/curve.js').Curve} rotationSpeedGraph2 If not null,
 * particles pick random values between rotationSpeedGraph and rotationSpeedGraph2.
 * @property {import('../../../core/math/curve.js').Curve} radialSpeedGraph Radial speed over
 * lifetime, velocity vector points from emitter origin to particle pos.
 * @property {import('../../../core/math/curve.js').Curve} radialSpeedGraph2 If not null, particles
 * pick random values between radialSpeedGraph and radialSpeedGraph2.
 * @property {import('../../../core/math/curve.js').Curve} scaleGraph Scale over lifetime.
 * @property {import('../../../core/math/curve.js').Curve} scaleGraph2 If not null, particles pick
 * random values between scaleGraph and scaleGraph2.
 * @property {import('../../../core/math/curve.js').Curve} alphaGraph Alpha over lifetime.
 * @property {import('../../../core/math/curve.js').Curve} alphaGraph2 If not null, particles pick
 * random values between alphaGraph and alphaGraph2.
 * @property {number[]} layers An array of layer IDs ({@link Layer#id}) to which this particle
 * system should belong. Don't push/pop/splice or modify this array, if you want to change it - set
 * a new one instead.
 * @augments Component
 * @category Graphics
 */
class ParticleSystemComponent extends Component {
    /** @private */
    _requestedDepth = false;

    /** @private */
    _drawOrder = 0;

    /**
     * Create a new ParticleSystemComponent.
     *
     * @param {import('./system.js').ParticleSystemComponentSystem} system - The ComponentSystem
     * that created this Component.
     * @param {import('../../entity.js').Entity} entity - The Entity this Component is attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        this.on('set_colorMapAsset', this.onSetColorMapAsset, this);
        this.on('set_normalMapAsset', this.onSetNormalMapAsset, this);
        this.on('set_meshAsset', this.onSetMeshAsset, this);
        this.on('set_mesh', this.onSetMesh, this);
        this.on('set_renderAsset', this.onSetRenderAsset, this);
        this.on('set_loop', this.onSetLoop, this);
        this.on('set_blendType', this.onSetBlendType, this);
        this.on('set_depthSoftening', this.onSetDepthSoftening, this);
        this.on('set_layers', this.onSetLayers, this);

        SIMPLE_PROPERTIES.forEach((prop) => {
            this.on(`set_${prop}`, this.onSetSimpleProperty, this);
        });

        COMPLEX_PROPERTIES.forEach((prop) => {
            this.on(`set_${prop}`, this.onSetComplexProperty, this);
        });

        GRAPH_PROPERTIES.forEach((prop) => {
            this.on(`set_${prop}`, this.onSetGraphProperty, this);
        });
    }

    set drawOrder(drawOrder) {
        this._drawOrder = drawOrder;
        if (this.emitter) {
            this.emitter.drawOrder = drawOrder;
        }
    }

    get drawOrder() {
        return this._drawOrder;
    }

    addMeshInstanceToLayers() {
        if (!this.emitter) return;
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
            if (!layer) continue;
            layer.addMeshInstances([this.emitter.meshInstance]);
            this.emitter._layer = layer;
        }
    }

    removeMeshInstanceFromLayers() {
        if (!this.emitter) return;
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
            if (!layer) continue;
            layer.removeMeshInstances([this.emitter.meshInstance]);
        }
    }

    onSetLayers(name, oldValue, newValue) {
        if (!this.emitter) return;
        for (let i = 0; i < oldValue.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(oldValue[i]);
            if (!layer) continue;
            layer.removeMeshInstances([this.emitter.meshInstance]);
        }
        if (!this.enabled || !this.entity.enabled) return;
        for (let i = 0; i < newValue.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(newValue[i]);
            if (!layer) continue;
            layer.addMeshInstances([this.emitter.meshInstance]);
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
        const index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        layer.addMeshInstances([this.emitter.meshInstance]);
    }

    onLayerRemoved(layer) {
        if (!this.emitter) return;
        const index = this.layers.indexOf(layer.id);
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

    _onColorMapAssetChange(asset) {
    }

    onSetColorMapAsset(name, oldValue, newValue) {
        const assets = this.system.app.assets;
        if (oldValue) {
            const asset = assets.get(oldValue);
            if (asset) {
                this._unbindColorMapAsset(asset);
            }
        }

        if (newValue) {
            if (newValue instanceof Asset) {
                this.data.colorMapAsset = newValue.id;
                newValue = newValue.id;
            }

            const asset = assets.get(newValue);
            if (asset) {
                this._bindColorMapAsset(asset);
            } else {
                assets.once('add:' + newValue, (asset) => {
                    this._bindColorMapAsset(asset);
                });
            }
        } else {
            this.colorMap = null;
        }
    }

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

    _onNormalMapAssetChange(asset) {
    }

    onSetNormalMapAsset(name, oldValue, newValue) {
        const assets = this.system.app.assets;

        if (oldValue) {
            const asset = assets.get(oldValue);
            if (asset) {
                this._unbindNormalMapAsset(asset);
            }
        }

        if (newValue) {
            if (newValue instanceof Asset) {
                this.data.normalMapAsset = newValue.id;
                newValue = newValue.id;
            }

            const asset = assets.get(newValue);
            if (asset) {
                this._bindNormalMapAsset(asset);
            } else {
                assets.once('add:' + newValue, (asset) => {
                    this._bindNormalMapAsset(asset);
                });
            }
        } else {
            this.normalMap = null;
        }
    }

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

    _onMeshAssetChange(asset) {
    }

    onSetMeshAsset(name, oldValue, newValue) {
        const assets = this.system.app.assets;

        if (oldValue) {
            const asset = assets.get(oldValue);
            if (asset) {
                this._unbindMeshAsset(asset);
            }
        }

        if (newValue) {
            if (newValue instanceof Asset) {
                this.data.meshAsset = newValue.id;
                newValue = newValue.id;
            }

            const asset = assets.get(newValue);
            if (asset) {
                this._bindMeshAsset(asset);
            }
        } else {
            this._onMeshChanged(null);
        }
    }

    onSetMesh(name, oldValue, newValue) {
        // hack this for now
        // if the value being set is null, an asset or an asset id, then assume we are
        // setting the mesh asset, which will in turn update the mesh
        if (!newValue || newValue instanceof Asset || typeof newValue === 'number') {
            this.meshAsset = newValue;
        } else {
            this._onMeshChanged(newValue);
        }
    }

    _onMeshChanged(mesh) {
        if (mesh && !(mesh instanceof Mesh)) {
            // if mesh is a pc.Model, use the first meshInstance
            if (mesh.meshInstances[0]) {
                mesh = mesh.meshInstances[0].mesh;
            } else {
                mesh = null;
            }
        }

        this.data.mesh = mesh;

        if (this.emitter) {
            this.emitter.mesh = mesh;
            this.emitter.resetMaterial();
            this.rebuild();
        }
    }

    onSetRenderAsset(name, oldValue, newValue) {
        const assets = this.system.app.assets;

        if (oldValue) {
            const asset = assets.get(oldValue);
            if (asset) {
                this._unbindRenderAsset(asset);
            }
        }

        if (newValue) {
            if (newValue instanceof Asset) {
                this.data.renderAsset = newValue.id;
                newValue = newValue.id;
            }

            const asset = assets.get(newValue);
            if (asset) {
                this._bindRenderAsset(asset);
            }
        } else {
            this._onRenderChanged(null);
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

        if (asset.resource) {
            asset.resource.off('set:meshes', this._onRenderSetMeshes, this);
        }
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

        render.off('set:meshes', this._onRenderSetMeshes, this);
        render.on('set:meshes', this._onRenderSetMeshes, this);

        if (render.meshes) {
            this._onRenderSetMeshes(render.meshes);
        }
    }

    _onRenderSetMeshes(meshes) {
        this._onMeshChanged(meshes && meshes[0]);
    }

    onSetLoop(name, oldValue, newValue) {
        if (this.emitter) {
            this.emitter[name] = newValue;
            this.emitter.resetTime();
        }
    }

    onSetBlendType(name, oldValue, newValue) {
        if (this.emitter) {
            this.emitter[name] = newValue;
            this.emitter.material.blendType = newValue;
            this.emitter.resetMaterial();
            this.rebuild();
        }
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

    onSetDepthSoftening(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            if (newValue) {
                if (this.enabled && this.entity.enabled) this._requestDepth();
                if (this.emitter) this.emitter[name] = newValue;
            } else {
                if (this.enabled && this.entity.enabled) this._releaseDepth();
                if (this.emitter) this.emitter[name] = newValue;
            }
            if (this.emitter) {
                this.reset();
                this.emitter.resetMaterial();
                this.rebuild();
            }
        }
    }

    onSetSimpleProperty(name, oldValue, newValue) {
        if (this.emitter) {
            this.emitter[name] = newValue;
            this.emitter.resetMaterial();
        }
    }

    onSetComplexProperty(name, oldValue, newValue) {
        if (this.emitter) {
            this.emitter[name] = newValue;
            this.emitter.resetMaterial();
            this.rebuild();
            this.reset();
        }
    }

    onSetGraphProperty(name, oldValue, newValue) {
        if (this.emitter) {
            this.emitter[name] = newValue;
            this.emitter.rebuildGraphs();
            this.emitter.resetMaterial();
        }
    }

    onEnable() {
        // get data store once
        const data = this.data;

        // load any assets that haven't been loaded yet
        for (let i = 0, len = ASSET_PROPERTIES.length; i < len; i++) {
            let asset = data[ASSET_PROPERTIES[i]];
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
            let mesh = data.mesh;

            // mesh might be an asset id of an asset
            // that hasn't been loaded yet
            if (!(mesh instanceof Mesh))
                mesh = null;

            this.emitter = new ParticleEmitter(this.system.app.graphicsDevice, {
                numParticles: data.numParticles,
                emitterExtents: data.emitterExtents,
                emitterExtentsInner: data.emitterExtentsInner,
                emitterRadius: data.emitterRadius,
                emitterRadiusInner: data.emitterRadiusInner,
                emitterShape: data.emitterShape,
                initialVelocity: data.initialVelocity,
                wrap: data.wrap,
                localSpace: data.localSpace,
                screenSpace: data.screenSpace,
                wrapBounds: data.wrapBounds,
                lifetime: data.lifetime,
                rate: data.rate,
                rate2: data.rate2,

                orientation: data.orientation,
                particleNormal: data.particleNormal,

                animTilesX: data.animTilesX,
                animTilesY: data.animTilesY,
                animStartFrame: data.animStartFrame,
                animNumFrames: data.animNumFrames,
                animNumAnimations: data.animNumAnimations,
                animIndex: data.animIndex,
                randomizeAnimIndex: data.randomizeAnimIndex,
                animSpeed: data.animSpeed,
                animLoop: data.animLoop,

                startAngle: data.startAngle,
                startAngle2: data.startAngle2,

                scaleGraph: data.scaleGraph,
                scaleGraph2: data.scaleGraph2,

                colorGraph: data.colorGraph,
                colorGraph2: data.colorGraph2,

                alphaGraph: data.alphaGraph,
                alphaGraph2: data.alphaGraph2,

                localVelocityGraph: data.localVelocityGraph,
                localVelocityGraph2: data.localVelocityGraph2,

                velocityGraph: data.velocityGraph,
                velocityGraph2: data.velocityGraph2,

                rotationSpeedGraph: data.rotationSpeedGraph,
                rotationSpeedGraph2: data.rotationSpeedGraph2,

                radialSpeedGraph: data.radialSpeedGraph,
                radialSpeedGraph2: data.radialSpeedGraph2,

                colorMap: data.colorMap,
                normalMap: data.normalMap,
                loop: data.loop,
                preWarm: data.preWarm,
                sort: data.sort,
                stretch: data.stretch,
                alignToMotion: data.alignToMotion,
                lighting: data.lighting,
                halfLambert: data.halfLambert,
                intensity: data.intensity,
                depthSoftening: data.depthSoftening,
                scene: this.system.app.scene,
                mesh: mesh,
                depthWrite: data.depthWrite,
                noFog: data.noFog,
                node: this.entity,
                blendType: data.blendType
            });

            this.emitter.meshInstance.node = this.entity;
            this.emitter.drawOrder = this.drawOrder;

            if (!data.autoPlay) {
                this.pause();
                this.emitter.meshInstance.visible = false;
            }
        }

        if (this.emitter.colorMap) {
            this.addMeshInstanceToLayers();
        }

        this.system.app.scene.on('set:layers', this.onLayersChanged, this);
        if (this.system.app.scene.layers) {
            this.system.app.scene.layers.on('add', this.onLayerAdded, this);
            this.system.app.scene.layers.on('remove', this.onLayerRemoved, this);
        }

        if (this.enabled && this.entity.enabled && data.depthSoftening) {
            this._requestDepth();
        }
    }

    onDisable() {
        this.system.app.scene.off('set:layers', this.onLayersChanged, this);
        if (this.system.app.scene.layers) {
            this.system.app.scene.layers.off('add', this.onLayerAdded, this);
            this.system.app.scene.layers.off('remove', this.onLayerRemoved, this);
        }

        if (this.emitter) {
            this.removeMeshInstanceFromLayers();
            if (this.data.depthSoftening) this._releaseDepth();

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

            if (this.data[prop]) {
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
            this.emitter.resetTime();
            this.emitter.addTime(0, true);
        }
    }

    /**
     * Freezes the simulation.
     */
    pause() {
        this.data.paused = true;
    }

    /**
     * Unfreezes the simulation.
     */
    unpause() {
        this.data.paused = false;
    }

    /**
     * Enables/unfreezes the simulation.
     */
    play() {
        this.data.paused = false;
        if (this.emitter) {
            this.emitter.meshInstance.visible = true;
            this.emitter.loop = this.data.loop;
            this.emitter.resetTime();
        }
    }

    /**
     * Checks if simulation is in progress.
     *
     * @returns {boolean} True if the particle system is currently playing and false otherwise.
     */
    isPlaying() {
        if (this.data.paused) {
            return false;
        }
        if (this.emitter && this.emitter.loop) {
            return true;
        }

        // possible bug here what happens if the non looping emitter
        // was paused in the meantime?
        return Date.now() <= this.emitter.endTime;
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
            this.emitter.meshInstance.node = this.entity;
        }
        this.enabled = enabled;
    }
}

export { ParticleSystemComponent };
