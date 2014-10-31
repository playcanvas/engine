pc.extend(pc.fw, function() {

    // properties that do not need rebuilding the particle system
    var SIMPLE_PROPERTIES = [
        'spawnBounds',
        'speedDiv',
        'constantSpeedDiv',
        'colorMap',
        'normalMap',
        'oneShot'
    ];

    // properties that need rebuilding the particle system
    var COMPLEX_PROPERTIES = [
        'numParticles',
        'lifetime',
        'rate',
        'smoothness',
        'lighting',
        'halfLambert',
        'intensity',
        'wrap',
        'wrapBounds',
        'depthTest',
        'depthSoftening',
        'sort',
        'stretch',
        'preWarm',
        'maxEmissionTime',
        'camera'
    ];

    var GRAPH_PROPERTIES = [
        'localOffsetGraph',
        'offsetGraph',
        'angleGraph',
        'scaleGraph',
        'colorGraph',
        'alphaGraph',
        'localPosDivGraph',
        'posDivGraph',
        'scaleDivGraph',
        'angleDivGraph',
        'alphaDivGraph',

        'velocityGraph',
        'localVelocityGraph',
        'rotationSpeedGraph'
    ];

    var ParticleSystemComponent = function ParticleSystemComponent(system, entity) {
        this.on("set_colorMapAsset", this.onSetColorMapAsset, this);
        this.on("set_normalMapAsset", this.onSetNormalMapAsset, this);
        this.on("set_mesh", this.onSetMesh, this);
        this.on("set_oneShot", this.onSetOneShot, this);
        this.on("set_blendType", this.onSetBlendType, this);

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

    ParticleSystemComponent = pc.inherits(ParticleSystemComponent, pc.fw.Component);

    pc.extend(ParticleSystemComponent.prototype, {

        onSetColorMapAsset: function (name, oldValue, newValue) {
            if (newValue) {
                this._loadAsset(newValue, function (resource) {
                    this.colorMap = resource;
                }.bind(this));
            } else {
                this.colorMap = null;
            }
        },

        onSetNormalMapAsset: function (name, oldValue, newValue) {
            if (newValue) {
                this._loadAsset(newValue, function (resource) {
                    this.normalMap = resource;
                }.bind(this));
            } else {
                this.normalMap = null;
            }
        },

        _loadAsset: function (assetId, callback) {
            var asset = (assetId instanceof pc.asset.Asset ? assetId : this.system.context.assets.getAssetById(assetId));
            if (!asset) {
                logERROR(pc.string.format('Trying to load particle system before asset {0} is loaded.', assetId));
                return;
            }

            // try to load the cached asset first
            var resource;
            if (asset.resource) {
                callback(asset.resource);

            } else {
                // resource is not in cache so load it dynamically
                var options = {
                    parent: this.entity.getRequest()
                };

                this.system.context.assets.load(asset, [], options).then(function (resources) {
                    callback(resources[0]);
                });
            }
        },

        onSetMesh: function (name, oldValue, newValue) {
            if (newValue) {
                if (newValue instanceof pc.asset.Asset || pc.type(newValue) === 'number') {
                    // asset
                    this._loadAsset(newValue, function (model) {
                        this._onMeshChanged(model);
                    }.bind(this));
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
            if (mesh) {
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

        onSetOneShot: function (name, oldValue, newValue) {
            if (this.emitter) {
                this.emitter[name] = newValue;
                this.emitter.resetTime();
            }
        },

        onSetBlendType: function (name, oldValue, newValue) {
            if (this.emitter) {
                this.emitter[name] = newValue;
                this.emitter.material.blendType = newValue;
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
            if (!this.emitter && !this.system._inTools) {

                // try to get a valid camera
                if (!this.data.camera) {
                    var camera = this.system.context.systems.camera.cameras[0];
                    if (camera) {
                        this.data.camera = camera.entity;
                    }
                }

                this.emitter = new pc.scene.ParticleEmitter2(this.system.context.graphicsDevice, {
                    numParticles: this.data.numParticles,
                    spawnBounds: this.data.spawnBounds,
                    wrap: this.data.wrap,
                    wrapBounds: this.data.wrapBounds,
                    lifetime: this.data.lifetime,
                    rate: this.data.rate,
                    localOffsetGraph: this.data.localOffsetGraph,
                    offsetGraph: this.data.offsetGraph,
                    angleGraph: this.data.angleGraph,
                    scaleGraph: this.data.scaleGraph,
                    colorGraph: this.data.colorGraph,
                    alphaGraph: this.data.alphaGraph,
                    localPosDivGraph: this.data.localPosDivGraph,
                    posDivGraph: this.data.posDivGraph,
                    scaleDiv: this.data.scaleDiv,
                    angleDivGraph: this.data.angleDivGraph,
                    alphaDivGraph: this.data.alphaDivGraph,
                    colorMap: this.data.colorMap,
                    normalMap: this.data.normalMap,
                    oneShot: this.data.oneShot,
                    preWarm: this.data.preWarm,
                    speedDiv: this.data.speedDiv,
                    constantSpeedDiv: this.data.constantSpeedDiv,
                    sort: this.data.sort,
                    stretch: this.data.stretch,
                    lighting: this.data.lighting,
                    halfLambert: this.data.halfLambert,
                    intensity: this.data.intensity,
                    maxEmissionTime: this.data.maxEmissionTime,
                    depthSoftening: this.data.depthSoftening,
                    camera: this.data.camera,
                    scene: this.system.context.scene,
                    mesh: this.data.mesh,
                    depthTest: this.data.depthTest,
                    smoothness: this.data.smoothness,
                    node: this.entity,

                    localVelocityGraph: this.data.localVelocityGraph,
                    velocityGraph: this.data.velocityGraph,
                    rotationSpeedGraph: this.data.rotationSpeedGraph,
                    blendType: this.data.blendType
                });

                this.emitter.meshInstance.node = this.entity;

                this.psys = new pc.scene.Model();
                this.psys.graph = this.entity;
                this.psys.emitter = this.emitter;
                this.psys.meshInstances = [this.emitter.meshInstance];
                this.data.model = this.psys;
                this.emitter.psys = this.psys;

                // called after oneShot emitter is finished. As you can dynamically change oneShot parameter, it should be always initialized
				this.emitter.onFinished = function() {
					this.enabled = false;
				}.bind(this);
            }


            ParticleSystemComponent._super.onEnable.call(this);
            if (this.data.model) {
                if (!this.system.context.scene.containsModel(this.data.model)) {
                    if (this.emitter.colorMap) {
                        this.system.context.scene.addModel(this.data.model);
                    }
                }
            }
        },

        onDisable: function() {
            ParticleSystemComponent._super.onDisable.call(this);
            if (this.data.model) {
                if (this.system.context.scene.containsModel(this.data.model)) {
                    this.system.context.scene.removeModel(this.data.model);
                }
            }
        },

        reset: function() {
            this.emitter.reset();
        },

        rebuild: function() {
            var enabled = this.enabled;
            this.enabled = false;
            this.emitter.rebuild(); // worst case: required to rebuild buffers/shaders
            this.emitter.meshInstance.node = this.entity;
            this.data.model.meshInstances = [this.emitter.meshInstance];
            this.enabled = enabled;
        },
    });


    return {
        ParticleSystemComponent: ParticleSystemComponent
    };
}());
