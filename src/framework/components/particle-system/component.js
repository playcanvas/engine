Object.assign(pc, function () {

    // properties that do not need rebuilding the particle system
    var SIMPLE_PROPERTIES = [
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
    var COMPLEX_PROPERTIES = [
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
        'animNumFrames',
        'animLoop',
        'colorMap',
        'localSpace',
        'orientation'
    ];

    var GRAPH_PROPERTIES = [
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

    var ASSET_PROPERTIES = [
        'colorMapAsset',
        'normalMapAsset',
        'meshAsset'
    ];

    var depthLayer;

    /**
     * @component
     * @constructor
     * @name pc.ParticleSystemComponent
     * @classdesc Used to simulate particles and produce renderable particle mesh on either CPU or GPU.
     * GPU simulation is generally much faster than its CPU counterpart, because it avoids slow CPU-GPU synchronization and takes advantage of many GPU cores.
     * However, it requires client to support reasonable uniform count, reading from multiple textures in vertex shader and OES_texture_float extension, including rendering into float textures.
     * Most mobile devices fail to satisfy these requirements, so it's not recommended to simulate thousands of particles on them. GPU version also can't sort particles, so enabling sorting forces CPU mode too.
     * Particle rotation is specified by a single angle parameter: default billboard particles rotate around camera facing axis, while mesh particles rotate around 2 different view-independent axes.
     * Most of the simulation parameters are specified with pc.Curve or pc.CurveSet. Curves are interpolated based on each particle's lifetime, therefore parameters are able to change over time.
     * Most of the curve parameters can also be specified by 2 minimum/maximum curves, this way each particle will pick a random value in-between.
     * @description Create a new ParticleSystemComponent
     * @param {pc.ParticleSystemComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity this Component is attached to
     * @extends pc.Component
     * @property {Boolean} autoPlay Controls whether the particle system plays automatically on creation. If set to false, it is necessary to call {@link pc.ParticleSystemComponent#play} for the particle system to play. Defaults to true.
     * @property {Boolean} loop Enables or disables respawning of particles.
     * @property {Boolean} preWarm If enabled, the particle system will be initialized as though it had already completed a full cycle. This only works with looping particle systems.
     * @property {Boolean} lighting If enabled, particles will be lit by ambient and directional lights.
     * @property {Boolean} halfLambert Enabling Half Lambert lighting avoids particles looking too flat in shadowed areas. It is a completely non-physical lighting model but can give more pleasing visual results.
     * @property {Boolean} alignToMotion Orient particles in their direction of motion.
     * @property {Boolean} depthWrite If enabled, the particles will write to the depth buffer. If disabled, the depth buffer is left unchanged and particles will be guaranteed to overwrite one another in the order in which they are rendered.
     * @property {Boolean} noFog Disable fogging
     * @property {Boolean} localSpace Binds particles to emitter transformation rather then world space.
     * @property {Number} numParticles Maximum number of simulated particles.
     * @property {Number} rate Minimal interval in seconds between particle births.
     * @property {Number} rate2 Maximal interval in seconds between particle births.
     * @property {Number} startAngle Minimal initial Euler angle of a particle.
     * @property {Number} startAngle2 Maximal initial Euler angle of a particle.
     * @property {Number} lifetime The length of time in seconds between a particle's birth and its death.
     * @property {Number} stretch A value in world units that controls the amount by which particles are stretched based on their velocity. Particles are stretched from their center towards their previous position.
     * @property {Number} intensity Color multiplier.
     * @property {Boolean} animLoop Controls whether the sprite sheet animation plays once or loops continuously.
     * @property {Number} animTilesX Number of horizontal tiles in the sprite sheet.
     * @property {Number} animTilesY Number of vertical tiles in the sprite sheet.
     * @property {Number} animNumFrames Number of sprite sheet frames to play. It is valid to set the number of frames to a value less than animTilesX multiplied by animTilesY.
     * @property {Number} animSpeed Sprite sheet animation speed. 1 = particle lifetime, 2 = twice during lifetime etc...
     * @property {Number} depthSoftening Controls fading of particles near their intersections with scene geometry. This effect, when it's non-zero, requires scene depth map to be rendered. Multiple depth-dependent effects can share the same map, but if you only use it for particles, bear in mind that it can double engine draw calls.
     * @property {Number} initialVelocity Defines magnitude of the initial emitter velocity. Direction is given by emitter shape.
     * @property {pc.Vec3} emitterExtents (Only for EMITTERSHAPE_BOX) The extents of a local space bounding box within which particles are spawned at random positions.
     * @property {pc.Vec3} emitterExtentsInner (Only for EMITTERSHAPE_BOX) The exception of extents of a local space bounding box within which particles are not spawned. Aligned to the center of EmitterExtents.
     * @property {Number} emitterRadius (Only for EMITTERSHAPE_SPHERE) The radius within which particles are spawned at random positions.
     * @property {Number} emitterRadiusInner (Only for EMITTERSHAPE_SPHERE) The inner radius within which particles are not spawned.
     * @property {pc.Vec3} wrapBounds The half extents of a world space box volume centered on the owner entity's position. If a particle crosses the boundary of one side of the volume, it teleports to the opposite side.
     * @property {pc.Asset} colorMapAsset The {@link pc.Asset} used to set the colorMap.
     * @property {pc.Asset} normalMapAsset The {@link pc.Asset} used to set the normalMap.
     * @property {pc.Asset} meshAsset The {@link pc.Asset} used to set the mesh.
     * @property {pc.Texture} colorMap The color map texture to apply to all particles in the system. If no texture is assigned, a default spot texture is used.
     * @property {pc.Texture} normalMap The normal map texture to apply to all particles in the system. If no texture is assigned, an approximate spherical normal is calculated for each vertex.
     * @property {pc.EMITTERSHAPE} emitterShape Shape of the emitter. Defines the bounds inside which particles are spawned. Also affects the direction of initial velocity.
     * <ul>
     * <li><strong>{@link pc.EMITTERSHAPE_BOX}</strong>: Box shape parameterized by emitterExtents. Initial velocity is directed towards local Z axis.</li>
     * <li><strong>{@link pc.EMITTERSHAPE_SPHERE}</strong>: Sphere shape parameterized by emitterRadius. Initial velocity is directed outwards from the center.</li>
     * </ul>
     * @property {pc.PARTICLESORT} sort Sorting mode. Forces CPU simulation, so be careful.
     * <ul>
     * <li><strong>{@link pc.PARTICLESORT_NONE}</strong>: No sorting, particles are drawn in arbitary order. Can be simulated on GPU.</li>
     * <li><strong>{@link pc.PARTICLESORT_DISTANCE}</strong>: Sorting based on distance to the camera. CPU only.</li>
     * <li><strong>{@link pc.PARTICLESORT_NEWER_FIRST}</strong>: Newer particles are drawn first. CPU only.</li>
     * <li><strong>{@link pc.PARTICLESORT_OLDER_FIRST}</strong>: Older particles are drawn first. CPU only.</li>
     * </ul>
     * @property {pc.Mesh} mesh Triangular mesh to be used as a particle. Only first vertex/index buffer is used. Vertex buffer must contain local position at first 3 floats of each vertex.
     * @property {pc.BLEND} blend Blending mode.
     * @property {pc.PARTICLEORIENTATION} orientation Sorting mode. Forces CPU simulation, so be careful.
     * <ul>
     * <li><strong>{@link pc.PARTICLEORIENTATION_SCREEN}</strong>: Particles are facing camera.</li>
     * <li><strong>{@link pc.PARTICLEORIENTATION_WORLD}</strong>: User defines world space normal (particleNormal) to set planes orientation.</li>
     * <li><strong>{@link pc.PARTICLEORIENTATION_EMITTER}</strong>: Similar to previous, but the normal is affected by emitter(entity) transformation.</li>
     * </ul>
     * @property {pc.Vec3} particleNormal (Only for PARTICLEORIENTATION_WORLD and PARTICLEORIENTATION_EMITTER) The exception of extents of a local space bounding box within which particles are not spawned. Aligned to the center of EmitterExtents.
     * @property {pc.CurveSet} localVelocityGraph Velocity relative to emitter over lifetime.
     * @property {pc.CurveSet} localVelocityGraph2 If not null, particles pick random values between localVelocityGraph and localVelocityGraph2.
     * @property {pc.CurveSet} velocityGraph World-space velocity over lifetime.
     * @property {pc.CurveSet} velocityGraph2 If not null, particles pick random values between velocityGraph and velocityGraph2.
     * @property {pc.CurveSet} colorGraph Color over lifetime.
     * @property {pc.Curve} rotationSpeedGraph Rotation speed over lifetime.
     * @property {pc.Curve} rotationSpeedGraph2 If not null, particles pick random values between rotationSpeedGraph and rotationSpeedGraph2.
     * @property {pc.Curve} radialSpeedGraph Radial speed over lifetime, velocity vector points from emitter origin to particle pos.
     * @property {pc.Curve} radialSpeedGraph2 If not null, particles pick random values between radialSpeedGraph and radialSpeedGraph2.
     * @property {pc.Curve} scaleGraph Scale over lifetime.
     * @property {pc.Curve} scaleGraph2 If not null, particles pick random values between scaleGraph and scaleGraph2.
     * @property {pc.Curve} alphaGraph Alpha over lifetime.
     * @property {pc.Curve} alphaGraph2 If not null, particles pick random values between alphaGraph and alphaGraph2.
     * @property {Array} layers An array of layer IDs ({@link pc.Layer#id}) to which this particle system should belong.
     * Don't push/pop/splice or modify this array, if you want to change it - set a new one instead.
     */
    var ParticleSystemComponent = function ParticleSystemComponent(system, entity) {
        pc.Component.call(this, system, entity);

        this.on("set_colorMapAsset", this.onSetColorMapAsset, this);
        this.on("set_normalMapAsset", this.onSetNormalMapAsset, this);
        this.on("set_meshAsset", this.onSetMeshAsset, this);
        this.on("set_mesh", this.onSetMesh, this);
        this.on("set_loop", this.onSetLoop, this);
        this.on("set_blendType", this.onSetBlendType, this);
        this.on("set_depthSoftening", this.onSetDepthSoftening, this);
        this.on("set_layers", this.onSetLayers, this);

        SIMPLE_PROPERTIES.forEach(function (prop) {
            this.on('set_' + prop, this.onSetSimpleProperty, this);
        }.bind(this));

        COMPLEX_PROPERTIES.forEach(function (prop) {
            this.on('set_' + prop, this.onSetComplexProperty, this);
        }.bind(this));

        GRAPH_PROPERTIES.forEach(function (prop) {
            this.on('set_' + prop, this.onSetGraphProperty, this);
        }.bind(this));

        this._requestedDepth = false;
    };
    ParticleSystemComponent.prototype = Object.create(pc.Component.prototype);
    ParticleSystemComponent.prototype.constructor = ParticleSystemComponent;

    Object.assign(ParticleSystemComponent.prototype, {
        addModelToLayers: function () {
            if (!this.data.model) return;
            var layer;
            for (var i = 0; i < this.layers.length; i++) {
                layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
                if (!layer) continue;
                layer.addMeshInstances(this.data.model.meshInstances);
                this.emitter._layer = layer;
            }
        },

        removeModelFromLayers: function (model) {
            if (!this.data.model) return;
            var layer;
            for (var i = 0; i < this.layers.length; i++) {
                layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
                if (!layer) continue;
                layer.removeMeshInstances(this.data.model.meshInstances);
            }
        },

        onSetLayers: function (name, oldValue, newValue) {
            if (!this.data.model) return;
            var i, layer;
            for (i = 0; i < oldValue.length; i++) {
                layer = this.system.app.scene.layers.getLayerById(oldValue[i]);
                if (!layer) continue;
                layer.removeMeshInstances(this.data.model.meshInstances);
            }
            if (!this.enabled || !this.entity.enabled) return;
            for (i = 0; i < newValue.length; i++) {
                layer = this.system.app.scene.layers.getLayerById(newValue[i]);
                if (!layer) continue;
                layer.addMeshInstances(this.data.model.meshInstances);
            }
        },

        onLayersChanged: function (oldComp, newComp) {
            this.addModelToLayers();
            oldComp.off("add", this.onLayerAdded, this);
            oldComp.off("remove", this.onLayerRemoved, this);
            newComp.on("add", this.onLayerAdded, this);
            newComp.on("remove", this.onLayerRemoved, this);
        },

        onLayerAdded: function (layer) {
            if (!this.data.model) return;
            var index = this.layers.indexOf(layer.id);
            if (index < 0) return;
            layer.addMeshInstances(this.data.model.meshInstances);
        },

        onLayerRemoved: function (layer) {
            if (!this.data.model) return;
            var index = this.layers.indexOf(layer.id);
            if (index < 0) return;
            layer.removeMeshInstances(this.data.model.meshInstances);
        },

        _bindColorMapAsset: function (asset) {
            asset.once('remove', this._onColorMapRemoved, this);

            if (asset.resource) {
                this.colorMap = asset.resource;
            } else {
                asset.once("load", this._onColorMapLoad, this);
                if (this.enabled && this.entity.enabled) {
                    this.system.app.assets.load(asset);
                }

            }
        },

        _unbindColorMapAsset: function (asset) {
            asset.off("remove", this._onColorMapRemoved, this);
            asset.off("load", this._onColorMapLoad, this);
        },

        _onColorMapLoad: function (asset) {
            this.colorMap = asset.resource;
        },

        _onColorMapRemoved: function (asset) {
            this.colorMapAsset = null;
        },

        onSetColorMapAsset: function (name, oldValue, newValue) {
            var self = this;
            var asset;
            var assets = this.system.app.assets;
            if (oldValue) {
                asset = assets.get(oldValue);
                if (asset) {
                    this._unbindColorMapAsset(asset);
                }
            }

            if (newValue) {
                if (newValue instanceof pc.Asset) {
                    this.data.colorMapAsset = newValue.id;
                    newValue = newValue.id;
                }

                asset = assets.get(newValue);
                if (asset) {
                    self._bindColorMapAsset(asset);
                } else {
                    assets.once("add:" + newValue, function (asset) {
                        self._bindColorMapAsset(asset);
                    });
                }
            } else {
                this.colorMap = null;
            }
        },

        _bindNormalMapAsset: function (asset) {
            asset.once('remove', this._onNormalMapRemoved, this);

            if (asset.resource) {
                this.normalMap = asset.resource;
            } else {
                asset.once("load", this._onNormalMapLoad, this);
                if (this.enabled && this.entity.enabled) {
                    this.system.app.assets.load(asset);
                }

            }
        },

        _unbindNormalMapAsset: function (asset) {
            asset.off("remove", this._onNormalMapRemoved, this);
            asset.off("load", this._onNormalMapLoad, this);
        },

        _onNormalMapLoad: function (asset) {
            this.normalMap = asset.resource;
        },

        _onNormalMapRemoved: function (asset) {
            this.normalMapAsset = null;
        },

        onSetNormalMapAsset: function (name, oldValue, newValue) {
            var self = this;
            var asset;
            var assets = this.system.app.assets;

            if (oldValue) {
                asset = assets.get(oldValue);
                if (asset) {
                    this._unbindNormalMapAsset(asset);
                }
            }

            if (newValue) {
                if (newValue instanceof pc.Asset) {
                    this.data.normalMapAsset = newValue.id;
                    newValue = newValue.id;
                }

                asset = assets.get(newValue);
                if (asset) {
                    self._bindNormalMapAsset(asset);
                } else {
                    assets.once("add:" + newValue, function (asset) {
                        self._bindNormalMapAsset(asset);
                    });
                }
            } else {
                this.normalMap = null;
            }
        },

        _bindMeshAsset: function (asset) {
            asset.on('remove', this._onMeshAssetRemoved, this);
            asset.on('load', this._onMeshAssetLoad, this);
        },

        _unbindMeshAsset: function (asset) {
            asset.off('remove', this._onMeshAssetRemoved, this);
            asset.off('load', this._onMeshAssetLoad, this);
        },

        _onMeshAssetLoad: function (asset) {
            this._onMeshChanged(asset.resource);
        },

        onSetMeshAsset: function (name, oldValue, newValue) {
            var asset;
            var assets = this.system.app.assets;

            if (oldValue) {
                asset = assets.get(oldValue);
                if (asset) {
                    this._unbindMeshAsset(asset);
                }
            }

            if (newValue) {
                if (newValue instanceof pc.Asset) {
                    this.data.meshAsset = newValue.id;
                    newValue = newValue.id;
                }

                asset = assets.get(newValue);
                if (asset) {
                    this._bindMeshAsset(asset);

                    if (asset.resource) {
                        this._onMeshChanged(asset.resource);
                    } else {
                        assets.load(asset);
                    }
                }
            } else {
                this._onMeshChanged(null);
            }
        },

        onSetMesh: function (name, oldValue, newValue) {
            // hack this for now
            // if the value being set is null, an asset or an asset id, then assume we are
            // setting the mesh asset, which will in turn update the mesh
            if (!newValue || newValue instanceof pc.Asset || typeof newValue === 'number') {
                this.meshAsset = newValue;
            } else {
                this._onMeshChanged(newValue);
            }
        },

        _onMeshChanged: function (mesh) {
            if (mesh && !(mesh instanceof pc.Mesh)) {
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
        },

        onMeshAssetRemoved: function (asset) {
            asset.off('remove', this.onMeshAssetRemoved, this);
            this.mesh = null;
        },

        onSetLoop: function (name, oldValue, newValue) {
            if (this.emitter) {
                this.emitter[name] = newValue;
                this.emitter.resetTime();
            }
        },

        onSetBlendType: function (name, oldValue, newValue) {
            if (this.emitter) {
                this.emitter[name] = newValue;
                this.emitter.material.blendType = newValue;
                this.emitter.resetMaterial();
                this.rebuild();
            }
        },

        _requestDepth: function () {
            if (this._requestedDepth) return;
            if (!depthLayer) depthLayer = this.system.app.scene.layers.getLayerById(pc.LAYERID_DEPTH);
            if (depthLayer) {
                depthLayer.incrementCounter();
                this._requestedDepth = true;
            }
        },

        _releaseDepth: function () {
            if (!this._requestedDepth) return;
            if (depthLayer) {
                depthLayer.decrementCounter();
                this._requestedDepth = false;
            }
        },

        onSetDepthSoftening: function (name, oldValue, newValue) {
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
        },

        onSetSimpleProperty: function (name, oldValue, newValue) {
            if (this.emitter) {
                this.emitter[name] = newValue;
                this.emitter.resetMaterial();
            }
        },

        onSetComplexProperty: function (name, oldValue, newValue) {
            if (this.emitter) {
                this.emitter[name] = newValue;
                this.reset();
                this.emitter.resetMaterial();
                this.rebuild();
            }
        },

        onSetGraphProperty: function (name, oldValue, newValue) {
            if (this.emitter) {
                this.emitter[name] = newValue;
                this.emitter.rebuildGraphs();
                this.emitter.resetMaterial();
            }
        },


        onEnable: function () {
            // get data store once
            var data = this.data;

            // load any assets that haven't been loaded yet
            for (var i = 0, len = ASSET_PROPERTIES.length; i < len; i++) {
                var asset = data[ASSET_PROPERTIES[i]];
                if (asset) {
                    if (!(asset instanceof pc.Asset)) {
                        var id = parseInt(asset, 10);
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

            if (!this.emitter) {
                var mesh = data.mesh;

                // mesh might be an asset id of an asset
                // that hasn't been loaded yet
                if (!(mesh instanceof pc.Mesh))
                    mesh = null;

                this.emitter = new pc.ParticleEmitter(this.system.app.graphicsDevice, {
                    numParticles: data.numParticles,
                    emitterExtents: data.emitterExtents,
                    emitterExtentsInner: data.emitterExtentsInner,
                    emitterRadius: data.emitterRadius,
                    emitterRadiusInner: data.emitterRadiusInner,
                    emitterShape: data.emitterShape,
                    initialVelocity: data.initialVelocity,
                    wrap: data.wrap,
                    localSpace: data.localSpace,
                    wrapBounds: data.wrapBounds,
                    lifetime: data.lifetime,
                    rate: data.rate,
                    rate2: data.rate2,

                    orientation: data.orientation,
                    particleNormal: data.particleNormal,

                    animTilesX: data.animTilesX,
                    animTilesY: data.animTilesY,
                    animNumFrames: data.animNumFrames,
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

                this.psys = new pc.Model();
                this.psys.graph = this.entity;
                this.psys.emitter = this.emitter;
                this.psys.meshInstances = [this.emitter.meshInstance];
                data.model = this.psys;
                this.emitter.psys = this.psys;

                if (!data.autoPlay) {
                    this.pause();
                    this.emitter.meshInstance.visible = false;
                }
            }

            if (data.model && this.emitter.colorMap) {
                this.addModelToLayers();
            }

            this.system.app.scene.on("set:layers", this.onLayersChanged, this);
            if (this.system.app.scene.layers) {
                this.system.app.scene.layers.on("add", this.onLayerAdded, this);
                this.system.app.scene.layers.on("remove", this.onLayerRemoved, this);
            }

            if (this.enabled && this.entity.enabled && data.depthSoftening) {
                this._requestDepth();
            }
        },

        onDisable: function () {
            this.system.app.scene.off("set:layers", this.onLayersChanged, this);
            if (this.system.app.scene.layers) {
                this.system.app.scene.layers.off("add", this.onLayerAdded, this);
                this.system.app.scene.layers.off("remove", this.onLayerRemoved, this);
            }

            if (this.data.model) {
                this.removeModelFromLayers();
                if (this.data.depthSoftening) this._releaseDepth();
            }

            if (this.emitter) {
                // clear camera as it isn't updated while disabled and we don't want to hold
                // onto old reference
                this.emitter.camera = null;
            }
        },

        /**
         * @function
         * @name pc.ParticleSystemComponent#reset
         * @description Resets particle state, doesn't affect playing.
         */
        reset: function () {
            if (this.emitter) {
                this.emitter.reset();
            }
        },

        /**
         * @function
         * @name pc.ParticleSystemComponent#stop
         * @description Disables the emission of new particles, lets existing to finish their simulation.
         */
        stop: function () {
            if (this.emitter) {
                this.emitter.loop = false;
                this.emitter.resetTime();
                this.emitter.addTime(0, true);
            }
        },

        /**
         * @function
         * @name pc.ParticleSystemComponent#pause
         * @description Freezes the simulation.
         */
        pause: function () {
            this.data.paused = true;
        },

        /**
         * @function
         * @name pc.ParticleSystemComponent#unpause
         * @description Unfreezes the simulation.
         */
        unpause: function () {
            this.data.paused = false;
        },

        /**
         * @function
         * @name pc.ParticleSystemComponent#play
         * @description Enables/unfreezes the simulation.
         */
        play: function () {
            this.data.paused = false;
            if (this.emitter) {
                this.emitter.meshInstance.visible = true;
                this.emitter.loop = this.data.loop;
                this.emitter.resetTime();
            }
        },

        /**
         * @function
         * @name pc.ParticleSystemComponent#isPlaying
         * @description Checks if simulation is in progress.
         * @returns {Boolean} true if the particle system is currently playing and false otherwise.
         */
        isPlaying: function () {
            if (this.data.paused) {
                return false;
            }
            if (this.emitter && this.emitter.loop) {
                return true;
            }

            // possible bug here what happens if the non looping emitter
            // was paused in the meantime?
            return Date.now() <= this.emitter.endTime;
        },

        /**
         * @private
         * @function
         * @name pc.ParticleSystemComponent#rebuild
         * @description Rebuilds all data used by this particle system.
         */
        rebuild: function () {
            var enabled = this.enabled;
            this.enabled = false;
            if (this.emitter) {
                this.emitter.rebuild(); // worst case: required to rebuild buffers/shaders
                this.emitter.meshInstance.node = this.entity;
                this.data.model.meshInstances = [this.emitter.meshInstance];
            }
            this.enabled = enabled;
        },

        onRemove: function () {
            var data = this.data;
            if (data.model) {
                this.entity.removeChild(data.model.getGraph());
                data.model.destroy();
                data.model = null;
            }

            if (this.emitter) {
                this.emitter.destroy();
                this.emitter = null;
            }

            // clear all asset properties to remove any event listeners
            for (var i = 0; i < ASSET_PROPERTIES.length; i++) {
                var prop = ASSET_PROPERTIES[i];

                if (data[prop]) {
                    this[prop] = null;
                }
            }

            this.off();
        }
    });


    return {
        ParticleSystemComponent: ParticleSystemComponent
    };
}());
