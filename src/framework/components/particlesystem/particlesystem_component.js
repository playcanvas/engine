pc.extend(pc.fw, function() {

    // if a property name is in this array then when that property changes
    // we don't need to rebuild the emitter.
    //
    // 'rate' and 'lifetime' properties are better reflected after rebuild
    // 'stretch' and 'wrapBounds' properties can be changed in realtime but not turned on/off, so let's just rebuild

    var NO_REBUILD_PROPERTIES = [
        'spawnBounds',
        'speedDiv',
        'constantSpeedDiv',
        'texture',
        'normalTexture'
    ];

    var ParticleSystemComponent = function ParticleSystemComponent(system, entity) {
        this.on("set", this.onSetParam, this);
    };
    ParticleSystemComponent = pc.inherits(ParticleSystemComponent, pc.fw.Component);

    pc.extend(ParticleSystemComponent.prototype, {

        onSetParam: function(name, oldValue, newValue) {
            if (name === "enabled") {
                return;
            }

            var texturePropertyName;

            if (name === 'textureAsset') {
                texturePropertyName = 'texture';
            } else if (name === 'normalTextureAsset') {
                texturePropertyName = 'normalTexture';
            }

            if (texturePropertyName) {
                if (newValue) {
                    var asset = (newValue instanceof pc.asset.Asset ? newValue : this.system.context.assets.getAssetById(newValue));
                    if (!asset) {
                        logERROR(pc.string.format('Trying to load particle system before asset {0} is loaded.', newValue));
                        return;
                    }

                    // try to load the cached asset first
                    var texture;
                    if (asset.resource) {
                        texture = asset.resource;
                        this.data[texturePropertyName] = texture;

                        if (this.emitter) {
                            this.emitter[texturePropertyName] = texture;
                            this.emitter.resetMaterial();
                        }
                    } else {
                        // texture is not in cache so load it dynamically
                        var options = {
                            parent: this.entity.getRequest()
                        };

                        this.system.context.assets.load(newValue, [], options).then(function (resources) {
                            texture = resources[0].resource;
                            this.data[texturePropertyName] = texture;
                            if (this.emitter) {
                                this.emitter[texturePropertyName] = texture;
                                this.emitter.resetMaterial();
                            }
                        }.bind(this));
                    }
                } else {
                    // no asset so clear texture property
                    this.data[texturePropertyName] = null;
                    if (this.emitter) {
                        this.emitter[texturePropertyName] = null;
                        this.emitter.resetMaterial();
                    }
                }

            } else {

                if (this.emitter) {
                    this.emitter[name] = newValue;

                    if (name === "oneShot") {
                        this.emitter.resetTime();
                    } else {
                        this.emitter.resetMaterial(); // some may require resetting shader constants

                        if (NO_REBUILD_PROPERTIES.indexOf(name) < 0) {
                            this.rebuild();
                        }
                    }
                }
            }
        },

        onEnable: function() {
            if (!this.emitter) {
                this.emitter = new pc.scene.ParticleEmitter2(this.system.context.graphicsDevice, {
                    numParticles: this.data.numParticles,
                    spawnBounds: this.data.spawnBounds,
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
                    texture: this.data.texture,
                    normalTexture: this.data.normalTexture,
                    oneShot: this.data.oneShot,
                    speedDiv: this.data.speedDiv,
                    constantSpeedDiv: this.data.constantSpeedDiv,
                    sort: this.data.sort,
                    stretch: this.data.stretch,
                    lighting: this.data.lighting,
                    halfLambert: this.data.halfLambert,
                    maxEmissionTime: this.data.maxEmissionTime,
                    depthSoftening: this.data.depthSoftening,
                    camera: this.data.camera,
                    scene: this.system.context.scene,
                    mesh: this.data.mesh,
                    depthTest: this.data.depthTest,
                    gammaCorrect: this.data.gammaCorrect,
                    smoothness: this.data.smoothness
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
                    if (this.emitter.texture) {
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
