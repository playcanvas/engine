pc.extend(pc, function() {

    // properties that do not need rebuilding the particle system
    var SIMPLE_PROPERTIES = [
        'emitterExtents',
        'emitterRadius',
        'loop',
        'initialVelocity',
        'animSpeed',
        'normalMap'
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
        'animFrames',
        'animLoop',
        'colorMap',
        'localSpace'
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
        'rotationSpeedGraph2'
    ];

    var ASSET_PROPERTIES = [
        'colorMapAsset',
        'normalMapAsset',
        'mesh'
    ];

    /**
     * @component
     * @name pc.ParticleSystemComponent
     * @description Create a new ParticleSystemComponent
     * @class Used to simulate particles and produce renderable particle mesh on either CPU or GPU.
     * GPU simulation is generally much faster than its CPU counterpart, because it avoids slow CPU-GPU synchronization and takes advantage of many GPU cores.
     * However, it requires client to support reasonable uniform count, reading from multiple textures in vertex shader and OES_texture_float extension, including rendering into float textures.
     * Most mobile devices fail to satisfy these requirements, so it's not recommended to simulate thousands of particles on them. GPU version also can't sort particles, so enabling sorting forces CPU mode too.
     * Particle rotation is specified by a single angle parameter: default billboard particles rotate around camera facing axis, while mesh particles rotate around 2 different view-independent axes.
     * Most of the simulation parameters are specified with pc.Curve or pc.CurveSet. Curves are interpolated based on each particle's lifetime, therefore parameters are able to change over time.
     * Most of the curve parameters can also be specified by 2 minimum/maximum curves, this way each particle will pick a random value in-between.
     * @param {pc.ParticleSystemComponent} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity this Component is attached to
     * @extends pc.Component
     * @property {Boolean} loop Enables or disables respawning of particles.
     * @property {Boolean} paused Pauses or unpauses the simulation.
     * @property {Boolean} preWarm If enabled, the particle system will be initialized as though it had already completed a full cycle. This only works with looping particle systems.
     * @property {Boolean} lighting If enabled, particles will be lit by ambient and directional lights.
     * @property {Boolean} halfLambert Enabling Half Lambert lighting avoids particles looking too flat in shadowed areas. It is a completely non-physical lighting model but can give more pleasing visual results.
     * @property {Boolean} alignToMotion Orient particles in their direction of motion.
     * @property {Boolean} depthWrite If enabled, the particles will write to the depth buffer. If disabled, the depth buffer is left unchanged and particles will be guaranteed to overwrite one another in the order in which they are rendered.
     * @property {Boolean} noFog Disable fogging
     * @property {Number} numParticles Maximum number of simulated particles.
     * @property {Number} rate Minimal interval in seconds between particle births.
     * @property {Number} rate2 Maximal interval in seconds between particle births.
     * @property {Number} startAngle Minimal inital Euler angle of a particle.
     * @property {Number} startAngle2 Maximal inital Euler angle of a particle.
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
     * @property {Number} emitterRadius (Only for EMITTERSHAPE_SPHERE) The radius within which particles are spawned at random positions.
     * @property {pc.Vec3} wrapBounds The half extents of a world space box volume centered on the owner entity's position. If a particle crosses the boundary of one side of the volume, it teleports to the opposite side.
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
     * @property {pc.CurveSet} localVelocityGraph Velocity relative to emitter over lifetime.
     * @property {pc.CurveSet} localVelocityGraph2 If not null, particles pick random values between localVelocityGraph and localVelocityGraph2.
     * @property {pc.CurveSet} velocityGraph World-space velocity over lifetime.
     * @property {pc.CurveSet} velocityGraph2 If not null, particles pick random values between velocityGraph and velocityGraph2.
     * @property {pc.CurveSet} colorGraph Color over lifetime.
     * @property {pc.Curve} rotationSpeedGraph Rotation speed over lifetime.
     * @property {pc.Curve} rotationSpeedGraph2 If not null, particles pick random values between rotationSpeedGraph and rotationSpeedGraph2.
     * @property {pc.Curve} scaleGraph Scale over lifetime.
     * @property {pc.Curve} scaleGraph2 If not null, particles pick random values between scaleGraph and scaleGraph2.
     * @property {pc.Curve} alphaGraph Alpha over lifetime.
     * @property {pc.Curve} alphaGraph2 If not null, particles pick random values between alphaGraph and alphaGraph2.


     */
    var ParticleSystemComponent = function ParticleSystemComponent(system, entity) {
        this.on("set_colorMapAsset", this.onSetColorMapAsset, this);
        this.on("set_normalMapAsset", this.onSetNormalMapAsset, this);
        this.on("set_mesh", this.onSetMesh, this);
        this.on("set_loop", this.onSetLoop, this);
        this.on("set_blendType", this.onSetBlendType, this);
        this.on("set_depthSoftening", this.onSetDepthSoftening, this);

        SIMPLE_PROPERTIES.forEach(function (prop) {
            this.on('set_' + prop, this.onSetSimpleProperty, this);
        }.bind(this));

        COMPLEX_PROPERTIES.forEach(function (prop) {
            this.on('set_' + prop, this.onSetComplexProperty, this);
        }.bind(this));

        GRAPH_PROPERTIES.forEach(function (prop) {
            this.on('set_' + prop, this.onSetGraphProperty, this);
        }.bind(this));
    };

    ParticleSystemComponent = pc.inherits(ParticleSystemComponent, pc.Component);

    pc.extend(ParticleSystemComponent.prototype, {
        onSetColorMapAsset: function (name, oldValue, newValue) {
            var self = this;
            var asset;
            var assets = this.system.app.assets;
            if (oldValue) {
                asset = assets.get(oldValue);
                if (asset) {
                    asset.off('remove', this.onColorMapRemoved, this);
                }
            }

            if (newValue) {
                if (newValue instanceof pc.Asset) {
                    this.data.colorMapAsset = newValue.id;
                    newValue = newValue.id;
                }

                asset = assets.get(newValue);
                if (asset) {
                    asset.on('remove', this.onColorMapRemoved, this);
                    asset.ready(function (asset) {
                        self.colorMap = asset.resource;
                    });
                    if (self.enabled && self.entity.enabled) {
                        assets.load(asset);
                    }
                } else {
                    assets.once("add:" + newValue, function (asset) {
                        asset.on('remove', this.onColorMapRemoved, this);
                        asset.ready(function (asset) {
                            self.colorMap = asset.resource;
                        });

                        if (self.enabled && self.entity.enabled) {
                            assets.load(asset);
                        }
                    });
                }
            } else {
                this.colorMap = null;
            }
        },

        onColorMapRemoved: function (asset) {
            asset.off('remove', this.onColorMapRemoved, this);
            this.colorMapAsset = null;
        },

        onSetNormalMapAsset: function (name, oldValue, newValue) {
            var self = this;
            var asset;
            var assets = this.system.app.assets;

            if (oldValue) {
                asset = assets.get(oldValue);
                if (asset) {
                    asset.off('remove', this.onNormalMapRemoved, this);
                }
            }

            if (newValue) {
                if (newValue instanceof pc.Asset) {
                    this.data.normalMapAsset = newValue.id;
                    newValue = newValue.id;
                }

                asset = assets.get(newValue);
                if (asset) {
                    asset.on('remove', this.onNormalMapRemoved, this);
                    asset.ready(function (asset) {
                        self.normalMap = asset.resource;
                    });

                    if (self.enabled && self.entity.enabled) {
                        assets.load(asset);
                    }
                } else {
                    assets.once("add:" + newValue, function (asset) {
                        asset.on('remove', this.onNormalMapRemoved, this);
                        asset.ready(function (asset) {
                            self.normalMap = asset.resource;
                        });

                        if (self.enabled && self.entity.enabled) {
                            assets.load(asset);
                        }
                    });
                }
            } else {
                this.normalMap = null;
            }
        },

        onNormalMapRemoved: function (asset) {
            asset.off('remove', this.onNormalMapRemoved, this);
            this.normalMapAsset = null;
        },

        onSetMesh: function (name, oldValue, newValue) {
            var self = this;
            var asset;
            var assets = this.system.app.assets;

            if (oldValue && typeof(oldValue) === 'number') {
                asset = assets.get(oldValue);
                if (asset) {
                    asset.off('remove', this.onMeshRemoved, this);
                }
            }

            if (newValue) {
                if (newValue instanceof pc.Asset) {
                    this.data.mesh = newValue.id;
                    newValue = newValue.id;
                }

                if (typeof(newValue) === 'number') {
                    asset = assets.get(newValue);
                    if (asset) {
                        asset.on('remove', this.onMeshRemoved, this);
                        asset.ready(function (asset) {
                            self._onMeshChanged(asset.resource);
                        });

                        if (self.enabled && self.entity.enabled) {
                            assets.load(asset);
                        }
                    } else {
                        assets.once('add:' + newValue, function (asset) {
                            asset.on('remove', this.onMeshRemoved, this);
                            asset.ready(function (asset) {
                                self._onMeshChanged(asset.resource);
                            });

                            if (self.enabled && self.entity.enabled) {
                                assets.load(asset);
                            }
                        });
                    }
                } else {
                    // model resource
                    this._onMeshChanged(newValue);
                }
            } else {
                // null model
                this._onMeshChanged(null);
            }
        },

        _onMeshChanged: function (mesh) {
            if (mesh && ! (mesh instanceof pc.Mesh)) {
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

        onMeshRemoved: function (asset) {
            asset.off('remove', this.onMeshRemoved, this);
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

        onSetDepthSoftening: function (name, oldValue, newValue) {
            if (this.emitter) {
                if (oldValue!==newValue) {
                    if (newValue) {
                        this.emitter[name] = newValue;
                        if (this.enabled) this.emitter.onEnableDepth();
                    } else {
                        if (this.enabled) this.emitter.onDisableDepth();
                        this.emitter[name] = newValue;
                    }
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


        onEnable: function() {
            // load any assets that haven't been loaded yet
            for (var i = 0, len = ASSET_PROPERTIES.length; i < len; i++) {
                var asset = this.data[ASSET_PROPERTIES[i]];
                if (asset) {
                    if (! (asset instanceof pc.Asset)) {
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

            var firstRun = false;
            if (!this.emitter && !this.system._inTools) {

                var mesh = this.data.mesh;
                // mesh might be an asset id of an asset
                // that hasn't been loaded yet
                if (! (mesh instanceof pc.Mesh))
                    mesh = null;

                firstRun = true;
                this.emitter = new pc.ParticleEmitter(this.system.app.graphicsDevice, {
                    numParticles: this.data.numParticles,
                    emitterExtents: this.data.emitterExtents,
                    emitterRadius: this.data.emitterRadius,
                    emitterShape: this.data.emitterShape,
                    initialVelocity: this.data.initialVelocity,
                    wrap: this.data.wrap,
                    localSpace: this.data.localSpace,
                    wrapBounds: this.data.wrapBounds,
                    lifetime: this.data.lifetime,
                    rate: this.data.rate,
                    rate2: this.data.rate2,

                    animTilesX: this.data.animTilesX,
                    animTilesY: this.data.animTilesY,
                    animNumFrames: this.data.animNumFrames,
                    animSpeed: this.data.animSpeed,
                    animLoop: this.data.animLoop,

                    startAngle: this.data.startAngle,
                    startAngle2: this.data.startAngle2,

                    scaleGraph: this.data.scaleGraph,
                    scaleGraph2: this.data.scaleGraph2,

                    colorGraph: this.data.colorGraph,
                    colorGraph2: this.data.colorGraph2,

                    alphaGraph: this.data.alphaGraph,
                    alphaGraph2: this.data.alphaGraph2,

                    localVelocityGraph: this.data.localVelocityGraph,
                    localVelocityGraph2: this.data.localVelocityGraph2,

                    velocityGraph: this.data.velocityGraph,
                    velocityGraph2: this.data.velocityGraph2,

                    rotationSpeedGraph: this.data.rotationSpeedGraph,
                    rotationSpeedGraph2: this.data.rotationSpeedGraph2,

                    colorMap: this.data.colorMap,
                    normalMap: this.data.normalMap,
                    loop: this.data.loop,
                    preWarm: this.data.preWarm,
                    sort: this.data.sort,
                    stretch: this.data.stretch,
                    alignToMotion: this.data.alignToMotion,
                    lighting: this.data.lighting,
                    halfLambert: this.data.halfLambert,
                    intensity: this.data.intensity,
                    depthSoftening: this.data.depthSoftening,
                    scene: this.system.app.scene,
                    mesh: mesh,
                    depthWrite: this.data.depthWrite,
                    noFog: this.data.noFog,
                    node: this.entity,
                    blendType: this.data.blendType
                });

                this.emitter.meshInstance.node = this.entity;

                this.psys = new pc.Model();
                this.psys.graph = this.entity;
                this.psys.emitter = this.emitter;
                this.psys.meshInstances = [this.emitter.meshInstance];
                this.data.model = this.psys;
                this.emitter.psys = this.psys;

                if (!this.data.autoPlay) {
                    this.pause();
                    this.emitter.meshInstance.visible = false;
                }
            }

            if (this.data.model) {
                if (!this.system.app.scene.containsModel(this.data.model)) {
                    if (this.emitter.colorMap) {
                        this.system.app.scene.addModel(this.data.model);
                        if (!firstRun) this.emitter.onEnableDepth();
                    }
                }
            }

            ParticleSystemComponent._super.onEnable.call(this);
        },

        onDisable: function() {
            ParticleSystemComponent._super.onDisable.call(this);
            if (this.data.model) {
                if (this.system.app.scene.containsModel(this.data.model)) {
                    this.system.app.scene.removeModel(this.data.model);
                    this.emitter.onDisableDepth();
                }
            }
        },

        /**
        * @function
        * @name pc.ParticleSystemComponent#reset
        * @description Resets particle state, doesn't affect playing.
        */
        reset: function() {
            if (this.emitter) {
                this.emitter.reset();
            }
        },

        /**
        * @function
        * @name pc.ParticleSystemComponent#stop
        * @description Disables the emission of new particles, lets existing to finish their simulation.
        */
        stop: function() {
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
        pause: function() {
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
        play: function() {
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
        */
        isPlaying: function() {
            if (this.data.paused) {
                return false;
            } else {
                if (this.emitter && this.emitter.loop) {
                    return true;
                } else {
                    // possible bug here what happens if the non looping emitter
                    // was paused in the meantime?
                    return Date.now() <= this.emitter.endTime;
                }
            }
        },

        /**
        * @private
        * @function
        * @name pc.ParticleSystemComponent#rebuild
        * @description Rebuilds all data used by this particle system.
        */
        rebuild: function() {
            var enabled = this.enabled;
            this.enabled = false;
            if (this.emitter) {
                this.emitter.rebuild(); // worst case: required to rebuild buffers/shaders
                this.emitter.meshInstance.node = this.entity;
                this.data.model.meshInstances = [this.emitter.meshInstance];
            }
            this.enabled = enabled;
        },
    });


    return {
        ParticleSystemComponent: ParticleSystemComponent
    };
}());
