pc.extend(pc.fw, function() {

    // properties that do not need rebuilding the particle system
    var SIMPLE_PROPERTIES = [
        'spawnBounds',
        'colorMap',
        'normalMap',
        'oneShot'
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
        'depthTest',
        'depthSoftening',
        'sort',
        'stretch',
        'preWarm',
        'maxEmissionTime',
        'camera'
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
                if (oldValue && !newValue) {
                    //this.emitter.oneShotEndTime = this.emitter.totalTime;
                    this.reset();
                    this.emitter.resetMaterial();
                    this.enabled = true;
                    this.rebuild();
                }
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
                    rate2: this.data.rate2,

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
                    oneShot: this.data.oneShot,
                    preWarm: this.data.preWarm,
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
                    node: this.entity,
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
